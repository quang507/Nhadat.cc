// zalo-webhook — SRS-4.4: nhận event Zalo OA, trả 200 ngay (<1s), xử lý async.
// Bộ não hội thoại nằm ở chat-reply (NFR-12) — webhook chỉ verify, chuyển tiếp
// và gửi trả lời (1-2 bong bóng theo FR-130) qua OA API.
// Secrets: ZALO_OA_ACCESS_TOKEN (bắt buộc để trả lời), ZALO_APP_SECRET + ZALO_APP_ID
// (tuỳ chọn — có thì verify chữ ký X-ZEvent-Signature), đặt qua env hoặc Vault.
import {
  ghiLoi,
  jsonResponse,
  secretOf,
  sendZalo,
  sendZaloImage,
  serviceClient,
} from "../_shared/claude.ts";

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function handleEvent(raw: string): Promise<void> {
  const client = serviceClient();
  const ev = JSON.parse(raw);
  const isText = ev.event_name === "user_send_text";
  const isImage = ev.event_name === "user_send_image"; // FR-134: bot đọc ảnh
  if (!isText && !isImage) return;

  const zaloUserId = String(ev.sender?.id ?? "");
  const text = String(ev.message?.text ?? "").trim();
  const imageUrl = isImage ? String(ev.message?.attachments?.[0]?.payload?.url ?? "") : "";
  const zaloMsgId = ev.message?.msg_id ? String(ev.message.msg_id) : null;
  if (!zaloUserId || (!text && !imageUrl)) return;

  // Bộ não dùng chung (NFR-12): nhớ khách, hồ sơ nhu cầu FR-130, dedupe msg_id
  const brain = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/chat-reply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_user_id: zaloUserId,
      text,
      image_url: imageUrl || undefined,
      msg_id: zaloMsgId,
      channel: "zalo_oa",
    }),
  });
  const out = await brain.json().catch(() => ({}));
  // Bộ não từ chối (403 cổng FR-151, 429 trần model, lỗi model…) → khách KHÔNG
  // nhận được câu trả lời nào, mà webhook đã trả 200 cho Zalo từ lâu. Ghi sổ.
  if (out?.error) return await ghiLoi(client, "zalo-webhook brain", out.error, brain.status);
  const bubbles: string[] = Array.isArray(out?.replies) && out.replies.length
    ? out.replies
    : out?.reply
    ? [out.reply]
    : [];
  if (!bubbles.length) return;

  const accessToken = await secretOf(client, "ZALO_OA_ACCESS_TOKEN");
  if (!accessToken) return; // chưa cấu hình OA — chỉ ghi log (đã lưu messages)

  // Quyết định 25/08: KHÔNG delay nhân tạo — bong bóng đầu đi ngay lập tức,
  // giữa các bong bóng chỉ chừa 300ms cho Zalo giao đúng thứ tự.
  for (const [i, bubble] of bubbles.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 300));
    const ok = await sendZalo(accessToken, zaloUserId, bubble);
    // Gửi hụt = khách ngồi chờ một câu không bao giờ tới. Đây là hỏng nặng
    // nhất phía B mà lại im nhất, vì mọi mã HTTP trên đường đều 200.
    if (!ok) await ghiLoi(client, "zalo-webhook send", `bong bóng: ${bubble.slice(0, 80)}`);
  }

  // FR-143: bộ não trả về hình thật (kho ảnh theo mã + URL chính chủ gửi)
  const photos: string[] = Array.isArray(out?.photos) ? out.photos : [];
  for (const url of photos) {
    const ok = await sendZaloImage(accessToken, zaloUserId, url);
    if (!ok) await ghiLoi(client, "zalo-webhook send ảnh", url);
  }
}

Deno.serve(async (req) => {
  if (req.method === "GET") return new Response("nhadat.cc zalo-webhook OK");
  if (req.method !== "POST") return new Response("method", { status: 405 });

  const raw = await req.text();

  // Verify chữ ký nếu đã cấu hình app secret (mac = sha256(appId+data+timeStamp+secret))
  const client = serviceClient();
  const appSecret = await secretOf(client, "ZALO_APP_SECRET");
  const appId = await secretOf(client, "ZALO_APP_ID");
  if (appSecret && appId) {
    const sig = req.headers.get("X-ZEvent-Signature") ?? "";
    const ts = JSON.parse(raw).timestamp ?? "";
    const mac = await sha256hex(`${appId}${raw}${ts}${appSecret}`);
    if (sig !== `mac=${mac}`) {
      console.log("zalo-webhook: sai chữ ký, từ chối");
      return new Response("invalid signature", { status: 401 });
    }
  }

  // Trả 200 ngay, xử lý nền (SRS-4.4: <1s).
  // Chạy nền: không ai await cái này, nên exception ở đây rơi vào hư không.
  // (@ts-ignore phải nằm SÁT dòng lệnh, chèn comment vào giữa là nó hết tác dụng.)
  // @ts-ignore EdgeRuntime có trong môi trường Supabase
  EdgeRuntime.waitUntil(
    handleEvent(raw).catch((e) => ghiLoi(client, "zalo-webhook handleEvent", e)),
  );
  return jsonResponse({ ok: true });
});
