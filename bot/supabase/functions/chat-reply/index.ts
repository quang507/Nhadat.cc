// chat-reply — "bộ não" hội thoại B-side tách khỏi kênh (NFR-12).
// Kênh nào (OA webhook, bridge zca-js test, web chat sau này) cũng gọi vào đây.
// POST { external_user_id, text, msg_id?, channel? }
//   → { reply, replies[], conversation_id }
// Nhánh BUYER theo FR-130: hồ sơ nhu cầu tích luỹ (buyers.preferences), mỗi
// lượt hỏi đúng MỘT tiêu chí thiếu, trả lời tách tối đa 2 bong bóng.
import Anthropic from "npm:@anthropic-ai/sdk";
import { z } from "npm:zod@4";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  BUYER_FEWSHOT,
  BUYER_PROFILE_FIELDS,
  FACT_LABELS,
  HUMAN_CHAT_RULES,
  SELLER_SCRIPT_RULES,
  SLANG_NOTES,
  TONE_RULES,
} from "../_shared/prompts.ts";

// Fallback quy tắc khi model lỗi/hết quota (hướng parseVnd của NhaDat-Radar):
// bắt tối thiểu ngân sách + hẻm/mặt tiền bằng regex để hồ sơ không mất dữ liệu,
// và trả lời template thay vì im lặng hay đổ lỗi cho khách.
function regexProfileFallback(text: string): Record<string, string> {
  const t = text.toLowerCase();
  const delta: Record<string, string> = {};
  const money = /([\d][\d.,]*)\s*(tỷ|ty|tỏi|tr\b|triệu|củ)/.exec(t);
  if (money) {
    const unit = /tr|triệu|củ/.test(money[2]) ? "triệu" : "tỷ";
    delta.budget = `${money[1]} ${unit}`;
  }
  if (/hxh|hẻm xe hơi/.test(t)) delta.alley = "hẻm xe hơi";
  else if (/mặt tiền|\bmt\b/.test(t)) delta.alley = "mặt tiền";
  if (/\bthuê\b|cho thuê/.test(t)) delta.deal = "thue";
  else if (/\bmua\b/.test(t)) delta.deal = "ban";
  return delta;
}

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

// Hồ sơ + trả lời trong MỘT lượt gọi model (FR-130)
const BuyerTurn = z.object({
  profile: z.object({
    name: z.string().nullable().describe("Tên khách nếu khách vừa xưng tên"),
    honorific: z.enum(["anh", "chị"]).nullable(),
    deal: z.enum(["ban", "thue"]).nullable().describe("ban = khách muốn MUA, thue = muốn THUÊ"),
    area: z.string().nullable().describe("Khu vực khách tìm, nguyên văn kiểu nói"),
    budget: z.string().nullable().describe("Khoảng giá, nguyên văn kiểu nói ('tầm 5 tỷ')"),
    purpose: z.string().nullable().describe("Để ở / kinh doanh / đầu tư"),
    property_type: z.string().nullable(),
    bedrooms: z.number().nullable(),
    alley: z.string().nullable().describe("Hẻm xe hơi / mặt tiền / không quan trọng"),
    timeline: z.string().nullable(),
    notes: z.string().nullable().describe("Chi tiết đáng nhớ khác khách kể (trường học, cha mẹ già ở cùng…)"),
  }).describe("CHỈ ghi điều khách NÓI RÕ trong hội thoại. Không suy diễn. Chưa biết để null."),
  replies: z.array(z.string()).min(1).max(2)
    .describe("1-2 bong bóng tin nhắn gửi khách, theo đúng nhịp nhắn giống người"),
});

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
        ? `Người bán vừa trả lời câu hỏi "${FACT_LABELS[pendingReq.question] ?? pendingReq.question}": "${text}". Soạn MỘT tin RẤT NGẮN (~30 từ): ghi nhận/khen tự nhiên câu trả lời (điểm mạnh thật của nhà nếu có), rồi hỏi tiếp ĐÚNG MỘT thông tin: ${FACT_LABELS[next.fact_key] ?? next.fact_key}. Kèm lý do vì-khách nếu tự nhiên. Không hỏi gì khác.`
        : `Người bán vừa trả lời câu hỏi cuối: "${text}". Soạn MỘT tin NGẮN cảm ơn, báo tin rao giờ đã đầy đủ thông tin, tụi em sẽ báo ngay khi có khách quan tâm. Kết thúc bằng một câu hỏi nhẹ xem anh chị còn muốn bổ sung gì không.`;
      const r2 = await anthropic2.messages.create({
        model: MODEL, max_tokens: 512,
        output_config: { effort: "medium" },
        system: [{
          type: "text",
          text: TONE_RULES + "\n\n" + SELLER_SCRIPT_RULES,
          cache_control: { type: "ephemeral" },
        }],
        messages: [{ role: "user", content: prompt }],
      });
      const sellerReply = r2.content.find((b) => b.type === "text")?.text?.trim() ?? null;

      if (next && sellerReply) {
        await client.from("info_requests").insert({
          listing_id: pendingReq.listing_id, question: next.fact_key, status: "pending",
        });
      }
      return new Response(
        JSON.stringify({
          reply: sellerReply,
          replies: sellerReply ? [sellerReply] : [],
          role: "seller",
          saved_fact: pendingReq.question,
        }),
        { headers: { "Content-Type": "application/json; charset=utf-8" } },
      );
    }
    // Seller nhắn nhưng không có câu chờ → rơi xuống luồng hội thoại thường
  }

  // Nhớ người trò chuyện (FR-21/26) + hồ sơ nhu cầu (FR-130).
  // Get-or-create buyer + conversation qua RPC advisory-lock (FR-131 —
  // 3 tin gõ vụn đến đồng thời không được tạo trùng buyer/conversation).
  const { data: bc, error: bcErr } = await client
    .rpc("ensure_buyer_conversation", {
      p_zalo_user_id: externalUserId,
      p_channel: channel,
    }).single();
  if (bcErr || !bc) {
    return new Response(JSON.stringify({ error: bcErr?.message ?? "ensure_buyer_conversation" }), { status: 500 });
  }
  const buyer = { id: bc.b_id as string, name: bc.b_name as string | null };
  const convId = bc.c_id as string;
  const prefs: Record<string, unknown> = (bc.b_prefs as Record<string, unknown>) ?? {};

  // Dedupe theo msg_id (retry không tạo tin đôi)
  const { data: insMsg, error: msgErr } = await client.from("messages").insert({
    conversation_id: convId, sender: "buyer", body: text, zalo_msg_id: msgId,
  }).select("id").single();
  if (msgErr?.code === "23505") {
    // Retry của kênh (cùng msg_id) — đã trả lời rồi, đừng trả lời lần hai
    return new Response(JSON.stringify({ reply: null, replies: [], deduped: true }), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
  if (msgErr) {
    return new Response(JSON.stringify({ error: msgErr.message }), { status: 500 });
  }
  await client.from("conversations")
    .update({ last_message_at: new Date().toISOString() }).eq("id", convId);

  // FR-131: gộp tin gõ vụn — đợi ~4.5s; nếu khách đã nhắn tiếp trong lúc đợi
  // thì nhường lượt (tin cuối chùm sẽ trả lời trên toàn bộ ngữ cảnh gộp).
  await new Promise((r) => setTimeout(r, 4500));
  const { data: newest } = await client
    .from("messages").select("id")
    .eq("conversation_id", convId).eq("sender", "buyer")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (newest && insMsg && newest.id !== insMsg.id) {
    return new Response(JSON.stringify({ reply: null, replies: [], superseded: true }), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  // Kho lọc theo hồ sơ: mua/thuê, phường (nếu bắt được), số PN
  let khoQ = client
    .from("listings")
    .select("code, ward, location_raw, price_raw, area_m2, bedrooms")
    .eq("deal", prefs.deal === "thue" ? "thue" : "ban")
    .not("price_raw", "is", null).neq("price_raw", "")
    .order("created_at", { ascending: false }).limit(6);
  const wardNum = typeof prefs.area === "string"
    ? /ph(?:ường|uong)?\s*\.?\s*(\d{1,2})|(?:^|\W)p\.?\s*(\d{1,2})/i.exec(prefs.area)
    : null;
  if (wardNum) khoQ = khoQ.ilike("ward", `%${wardNum[1] ?? wardNum[2]}%`);
  if (typeof prefs.bedrooms === "number") khoQ = khoQ.gte("bedrooms", prefs.bedrooms);

  const [{ data: history }, { data: listings }] = await Promise.all([
    client.from("messages").select("sender, body")
      .eq("conversation_id", convId).order("created_at", { ascending: false }).limit(12),
    khoQ,
  ]);
  const ordered = (history ?? []).reverse();
  const convo = ordered
    .map((m) => `${m.sender === "buyer" ? "KHÁCH" : "EM"}: ${m.body}`).join("\n");
  const kho = (listings ?? [])
    .map((l) =>
      `#${l.code} · ${l.location_raw ?? ""} ${l.ward ?? ""} · ${l.price_raw} · ${l.area_m2 ?? "?"}m2${l.bedrooms ? ` · ${l.bedrooms}PN` : ""}`)
    .join("\n");

  // Chống hỏi cung: 2 tin gần nhất của bot đều là câu hỏi → lượt này đưa giá trị
  const botMsgs = ordered.filter((m) => m.sender === "bot");
  const interrogated = botMsgs.length >= 2 &&
    botMsgs.slice(-2).every((m) => m.body.trimEnd().endsWith("?"));

  // Hồ sơ ĐÃ BIẾT / CÒN THIẾU theo thứ tự ưu tiên UF-04
  const known = BUYER_PROFILE_FIELDS
    .filter(([k]) => prefs[k] != null && prefs[k] !== "")
    .map(([k, label]) => `- ${label}: ${prefs[k]}`).join("\n");
  const missing = BUYER_PROFILE_FIELDS
    .filter(([k]) => prefs[k] == null || prefs[k] === "")
    .map(([, label]) => `- ${label}`).join("\n");
  const minimumMet = prefs.area != null && prefs.budget != null;

  const apiKey = await secret(client, "ANTHROPIC_API_KEY");
  const anthropic = new Anthropic({ apiKey: apiKey! });
  let out: { profile: Record<string, unknown>; replies: string[] } | null = null;
  try {
    const resp = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: "medium", format: zodOutputFormat(BuyerTurn) },
      system: [{
        type: "text",
        text: TONE_RULES + "\n\n" + HUMAN_CHAT_RULES + "\n\n" + SLANG_NOTES + "\n\n" + BUYER_FEWSHOT +
          "\n\nBất biến: tối đa 3 listing một tin; không khẳng định còn/hết hay pháp lý khi chưa xác minh — nói 'để em hỏi lại chủ nhà'; tin chủ động kết thúc bằng MỘT câu hỏi. Chỉ dùng listing trong KHO dưới đây, không bịa.\n\nKHO HIỆN CÓ:\n" +
          (kho || "(trống)"),
        cache_control: { type: "ephemeral" },
      }],
      messages: [{
        role: "user",
        content:
          `HỒ SƠ ĐÃ BIẾT về khách${buyer.name ? ` (tên: ${buyer.name})` : ""}:\n${known || "(chưa biết gì)"}\n\n` +
          `CÒN THIẾU (thứ tự ưu tiên hỏi, mỗi lượt chỉ hỏi MỘT):\n${missing || "(đã đủ)"}\n\n` +
          (minimumMet
            ? "Đã đủ tiêu chí tối thiểu (khu vực + giá) — được gợi ý căn khớp hồ sơ.\n"
            : "CHƯA đủ tiêu chí tối thiểu (khu vực + giá) — chưa gợi ý căn trừ khi khách hỏi thẳng một căn.\n") +
          (interrogated
            ? "Hai tin trước em đều đã đặt câu hỏi — lượt này ĐƯA GIÁ TRỊ trước (gợi ý/thông tin), hỏi thật nhẹ hoặc không hỏi.\n"
            : "") +
          `\nHội thoại tới giờ:\n${convo}\n\nSoạn lượt trả lời tiếp theo của EM và cập nhật hồ sơ:`,
      }],
    });
    if (resp.stop_reason !== "refusal" && resp.parsed_output) {
      out = resp.parsed_output as typeof out;
    }
  } catch (e) {
    console.error("chat-reply model:", (e as Error)?.message);
  }

  // Fallback quy tắc: model hỏng ≠ khách nói không rõ — đừng đổ lỗi cho khách,
  // vẫn bóc được ngân sách/hẻm bằng regex và hỏi tiếp tiêu chí thiếu kế tiếp.
  if (!out) {
    const delta = regexProfileFallback(text);
    const nextMissing = BUYER_PROFILE_FIELDS
      .find(([k]) => (prefs[k] == null || prefs[k] === "") && delta[k] == null);
    out = {
      profile: delta,
      replies: [
        nextMissing
          ? `Dạ em ghi nhận rồi ạ. ${buyer.name ? `Anh/chị ${buyer.name}` : "Anh/chị"} cho em xin thêm ${nextMissing[1]} để em lọc đúng căn nha?`
          : "Dạ em ghi nhận rồi ạ. Em xem kỹ rồi báo lại anh/chị liền nha, anh/chị chờ em xíu!",
      ],
    };
  }

  // Gộp hồ sơ: chỉ ghi đè trường model bóc được (không xoá điều đã biết)
  const delta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(out.profile)) {
    if (v !== null && v !== "" && k !== "name") delta[k] = v;
  }
  if (Object.keys(delta).length > 0) {
    await client.from("buyers")
      .update({ preferences: { ...prefs, ...delta } }).eq("id", buyer.id);
  }
  if (out.profile.name && !buyer.name) {
    await client.from("buyers").update({ name: out.profile.name }).eq("id", buyer.id);
  }

  const replies = out.replies.map((r) => r.trim()).filter(Boolean);
  for (const r of replies) {
    await client.from("messages").insert({
      conversation_id: convId, sender: "bot", body: r,
    });
  }

  return new Response(
    JSON.stringify({ reply: replies.join("\n"), replies, conversation_id: convId }),
    { headers: { "Content-Type": "application/json; charset=utf-8" } },
  );
});
