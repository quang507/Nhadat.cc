// zalo-webhook — SRS-4.4: nhận event Zalo OA, trả 200 ngay (<1s), xử lý async.
// MVP luồng B-side: ghi messages, bot trả lời theo tone §6.8 kèm ngữ cảnh listing.
// NLU đầy đủ (SRS-4.5) và matching interests làm ở vòng sau.
// Secrets: ZALO_OA_ACCESS_TOKEN (bắt buộc để trả lời), ZALO_APP_SECRET + ZALO_APP_ID
// (tuỳ chọn — có thì verify chữ ký X-ZEvent-Signature), đặt qua env hoặc Vault.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { TONE_RULES } from "../_shared/prompts.ts";

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

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function handleEvent(raw: string): Promise<void> {
  const client = db();
  const ev = JSON.parse(raw);
  if (ev.event_name !== "user_send_text") return; // MVP: chỉ tin văn bản

  const zaloUserId = String(ev.sender?.id ?? "");
  const text = String(ev.message?.text ?? "").trim();
  const zaloMsgId = ev.message?.msg_id ? String(ev.message.msg_id) : null;
  if (!zaloUserId || !text) return;

  // Nhớ người trò chuyện (FR-21/26)
  let { data: buyer } = await client
    .from("buyers").select("id, name").eq("zalo_user_id", zaloUserId).maybeSingle();
  if (!buyer) {
    const ins = await client.from("buyers")
      .insert({ zalo_user_id: zaloUserId }).select("id, name").single();
    buyer = ins.data!;
  }
  await client.from("buyers")
    .update({ last_contact_at: new Date().toISOString() }).eq("id", buyer.id);

  let { data: conv } = await client
    .from("conversations").select("id").eq("buyer_id", buyer.id)
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (!conv) {
    const ins = await client.from("conversations")
      .insert({ buyer_id: buyer.id }).select("id").single();
    conv = ins.data!;
  }

  // Dedupe theo zalo_msg_id (webhook retry không tạo tin đôi — docs/10 §10.2)
  const { error: msgErr } = await client.from("messages").insert({
    conversation_id: conv.id, sender: "buyer", body: text, zalo_msg_id: zaloMsgId,
  });
  if (msgErr?.code === "23505") return; // đã xử lý event này rồi
  await client.from("conversations")
    .update({ last_message_at: new Date().toISOString() }).eq("id", conv.id);

  const accessToken = await secret(client, "ZALO_OA_ACCESS_TOKEN");
  if (!accessToken) return; // chưa cấu hình OA — chỉ ghi log

  // Ngữ cảnh: 12 tin gần nhất + 6 listing mới làm kho gợi ý (MVP)
  const [{ data: history }, { data: listings }] = await Promise.all([
    client.from("messages").select("sender, body")
      .eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(12),
    client.from("listings").select("code, ward, location_raw, price_raw, area_m2, property_type")
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
  const reply = resp.content.find((b) => b.type === "text")?.text?.trim();
  if (!reply || resp.stop_reason === "refusal") return;

  const send = await fetch("https://openapi.zalo.me/v3.0/oa/message/cs", {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: accessToken },
    body: JSON.stringify({
      recipient: { user_id: zaloUserId },
      message: { text: reply },
    }),
  });
  const sendResult = await send.json().catch(() => ({}));
  console.log("zalo send:", JSON.stringify(sendResult));

  await client.from("messages").insert({
    conversation_id: conv.id, sender: "bot", body: reply,
  });
}

Deno.serve(async (req) => {
  if (req.method === "GET") return new Response("nhadat.cc zalo-webhook OK");
  if (req.method !== "POST") return new Response("method", { status: 405 });

  const raw = await req.text();

  // Verify chữ ký nếu đã cấu hình app secret (mac = sha256(appId+data+timeStamp+secret))
  const client = db();
  const appSecret = await secret(client, "ZALO_APP_SECRET");
  const appId = await secret(client, "ZALO_APP_ID");
  if (appSecret && appId) {
    const sig = req.headers.get("X-ZEvent-Signature") ?? "";
    const ts = JSON.parse(raw).timestamp ?? "";
    const mac = await sha256hex(`${appId}${raw}${ts}${appSecret}`);
    if (sig !== `mac=${mac}`) {
      console.log("zalo-webhook: sai chữ ký, từ chối");
      return new Response("invalid signature", { status: 401 });
    }
  }

  // Trả 200 ngay, xử lý nền (SRS-4.4: <1s)
  // @ts-ignore EdgeRuntime có trong môi trường Supabase
  EdgeRuntime.waitUntil(handleEvent(raw).catch((e) => console.error("handleEvent:", e)));
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
