// chat-reply — "bộ não" hội thoại B-side tách khỏi kênh (NFR-12).
// Kênh nào (OA webhook, bridge zca-js test, web chat sau này) cũng gọi vào đây.
// POST { external_user_id, text, msg_id?, channel? } → { reply, conversation_id }
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { FACT_LABELS, TONE_RULES } from "../_shared/prompts.ts";

const MODEL = "claude-opus-5";

function db(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function secret(client: SupabaseClient, name: string): Promise<string | null> {
  const fromEnv = Deno.env.get(name);
  if (fromEnv) return fromEnv;
  const { data } = await client.rpc("get_secret", { secret_name: name });
  return (data as string) ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const body = await req.json().catch(() => ({}));
  const externalUserId = String(body.external_user_id ?? "").trim();
  const text = String(body.text ?? "").trim();
  const msgId = body.msg_id ? String(body.msg_id) : null;
  const channel = String(body.channel ?? "zalo_oa");
  if (!externalUserId || !text) {
    return new Response(JSON.stringify({ error: "external_user_id và text bắt buộc" }), { status: 400 });
  }

  const client = db();

  // NGƯỜI BÁN nhắn? (FR-129 — hỏi nhỏ giọt): nếu khớp sellers.zalo_user_id và
  // đang có câu hỏi chờ, coi tin nhắn là CÂU TRẢ LỜI → lưu fact, hỏi câu kế.
  const { data: sellerRow } = await client
    .from("sellers").select("id, name")
    .eq("zalo_user_id", externalUserId).maybeSingle();
  if (sellerRow) {
    const { data: pendingReq } = await client
      .from("info_requests")
      .select("id, listing_id, question, listings!inner(seller_id, code)")
      .eq("listings.seller_id", sellerRow.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle();

    if (pendingReq) {
      await client.from("listing_facts").insert({
        listing_id: pendingReq.listing_id,
        question: pendingReq.question,
        answer: text,
        source: "seller_chat",
      });
      await client.from("info_requests").update({
        status: "answered", answer: text, answered_at: new Date().toISOString(),
      }).eq("id", pendingReq.id);

      // Câu kế tiếp (chưa pending) theo ưu tiên
      const { data: nextFacts } = await client
        .from("listing_missing_facts")
        .select("fact_key, priority")
        .eq("listing_id", pendingReq.listing_id)
        .order("priority").limit(3);
      const { data: stillPending } = await client
        .from("info_requests").select("question")
        .eq("listing_id", pendingReq.listing_id).eq("status", "pending");
      const pendSet = new Set((stillPending ?? []).map((r) => r.question));
      const next = (nextFacts ?? []).find((f) => !pendSet.has(f.fact_key));

      const apiKey2 = await secret(client, "ANTHROPIC_API_KEY");
      const anthropic2 = new Anthropic({ apiKey: apiKey2! });
      const prompt = next
        ? `Người bán vừa trả lời câu hỏi "${FACT_LABELS[pendingReq.question] ?? pendingReq.question}": "${text}". Soạn MỘT tin RẤT NGẮN (1-2 câu): cảm ơn/ghi nhận tự nhiên, rồi hỏi tiếp ĐÚNG MỘT thông tin: ${FACT_LABELS[next.fact_key] ?? next.fact_key}. Không hỏi gì khác.`
        : `Người bán vừa trả lời câu hỏi cuối: "${text}". Soạn MỘT tin NGẮN cảm ơn, báo tin rao giờ đã đầy đủ thông tin, tụi em sẽ báo ngay khi có khách quan tâm. Kết thúc bằng một câu hỏi nhẹ xem anh chị còn muốn bổ sung gì không.`;
      const r2 = await anthropic2.messages.create({
        model: MODEL, max_tokens: 512,
        output_config: { effort: "medium" },
        system: [{ type: "text", text: TONE_RULES, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: prompt }],
      });
      const sellerReply = r2.content.find((b) => b.type === "text")?.text?.trim() ?? null;

      if (next && sellerReply) {
        await client.from("info_requests").insert({
          listing_id: pendingReq.listing_id, question: next.fact_key, status: "pending",
        });
      }
      return new Response(
        JSON.stringify({ reply: sellerReply, role: "seller", saved_fact: pendingReq.question }),
        { headers: { "Content-Type": "application/json; charset=utf-8" } },
      );
    }
    // Seller nhắn nhưng không có câu chờ → rơi xuống luồng hội thoại thường
  }

  // Nhớ người trò chuyện (FR-21/26)
  let { data: buyer } = await client
    .from("buyers").select("id, name").eq("zalo_user_id", externalUserId).maybeSingle();
  if (!buyer) {
    const ins = await client.from("buyers")
      .insert({ zalo_user_id: externalUserId }).select("id, name").single();
    buyer = ins.data!;
  }
  await client.from("buyers")
    .update({ last_contact_at: new Date().toISOString() }).eq("id", buyer.id);

  let { data: conv } = await client
    .from("conversations").select("id").eq("buyer_id", buyer.id)
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (!conv) {
    const ins = await client.from("conversations")
      .insert({ buyer_id: buyer.id, channel }).select("id").single();
    conv = ins.data!;
  }

  // Dedupe theo msg_id (retry không tạo tin đôi)
  const { error: msgErr } = await client.from("messages").insert({
    conversation_id: conv.id, sender: "buyer", body: text, zalo_msg_id: msgId,
  });
  if (msgErr && msgErr.code !== "23505") {
    return new Response(JSON.stringify({ error: msgErr.message }), { status: 500 });
  }
  await client.from("conversations")
    .update({ last_message_at: new Date().toISOString() }).eq("id", conv.id);

  // Ngữ cảnh: 12 tin gần nhất + 6 listing mới (MVP — NLU thật theo SRS-4.5 sau)
  const [{ data: history }, { data: listings }] = await Promise.all([
    client.from("messages").select("sender, body")
      .eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(12),
    client.from("listings").select("code, ward, location_raw, price_raw, area_m2")
      .eq("deal", "ban").not("price_raw", "is", null).neq("price_raw", "")
      .order("created_at", { ascending: false }).limit(6),
  ]);
  const convo = (history ?? []).reverse()
    .map((m) => `${m.sender === "buyer" ? "KHÁCH" : "EM"}: ${m.body}`).join("\n");
  const kho = (listings ?? [])
    .map((l) => `#${l.code} · ${l.location_raw ?? ""} ${l.ward ?? ""} · ${l.price_raw} · ${l.area_m2 ?? "?"}m2`)
    .join("\n");

  const apiKey = await secret(client, "ANTHROPIC_API_KEY");
  const anthropic = new Anthropic({ apiKey: apiKey! });
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    output_config: { effort: "medium" },
    system: [{
      type: "text",
      text: TONE_RULES +
        "\n\nBất biến: tối đa 3 listing một tin; không khẳng định còn/hết hay pháp lý khi chưa xác minh — nói 'để em hỏi lại chủ nhà'; kết thúc bằng MỘT câu hỏi. Chỉ dùng listing trong KHO dưới đây, không bịa.\n\nKHO HIỆN CÓ:\n" + kho,
      cache_control: { type: "ephemeral" },
    }],
    messages: [{
      role: "user",
      content: `Hội thoại tới giờ:\n${convo}\n\nSoạn tin trả lời tiếp theo của EM (chỉ nội dung tin nhắn, không giải thích):`,
    }],
  });
  const reply = resp.content.find((b) => b.type === "text")?.text?.trim() ?? null;
  if (reply && resp.stop_reason !== "refusal") {
    await client.from("messages").insert({
      conversation_id: conv.id, sender: "bot", body: reply,
    });
  }

  return new Response(JSON.stringify({ reply, conversation_id: conv.id }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
});
