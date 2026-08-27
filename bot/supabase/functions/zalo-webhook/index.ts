// zalo-webhook — SRS-4.4: nhận event Zalo OA, trả 200 ngay (<1s), xử lý async.
// Bộ não hội thoại nằm ở chat-reply (NFR-12) — webhook chỉ verify, chuyển tiếp
// và gửi trả lời (1-2 bong bóng theo FR-130) qua OA API.
// Secrets: ZALO_APP_SECRET + ZALO_APP_ID (verify chữ ký X-ZEvent-Signature, và
// để FR-158 tự đổi token). Token gửi tin đọc qua zaloToken() — bảng bot_tokens
// trước, Vault ZALO_OA_ACCESS_TOKEN chỉ còn là hạt giống.
import {
  ghiLoi,
  jsonResponse,
  secretOf,
  sendZalo,
  sendZaloImage,
  serviceClient,
  zaloToken,
} from "../_shared/claude.ts";

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * So sánh chữ ký bằng THỜI GIAN HẰNG SỐ.
 *
 * `a !== b` của JS thoát ra ngay tại byte đầu tiên khác nhau. Chênh lệch thời
 * gian đó đo được qua mạng, và nó cho phép dò dần từng ký tự của mac hợp lệ:
 * gửi vài nghìn request rồi đo thời gian đáp là mò ra chữ ký mà không cần biết
 * app secret. Vòng dưới luôn duyệt hết mọi byte và gộp khác biệt bằng XOR —
 * thời gian chạy chỉ phụ thuộc ĐỘ DÀI, không phụ thuộc NỘI DUNG.
 */
function bangNhauHangSo(a: string, b: string): boolean {
  // Lệch độ dài thì thoát sớm là chấp nhận được: nó chỉ lộ độ dài, mà độ dài
  // của một chuỗi sha256 hex là hằng số ai cũng biết.
  if (a.length !== b.length) return false;
  let khac = 0;
  for (let i = 0; i < a.length; i++) khac |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return khac === 0;
}

/** Gọi bộ não dùng chung (NFR-12) bằng service_role — luôn qua cổng FR-151. */
async function goiBoNao(payload: Record<string, unknown>) {
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/chat-reply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return { out: await r.json().catch(() => ({})), status: r.status };
}

async function handleEvent(raw: string): Promise<void> {
  const client = serviceClient();
  const ev = JSON.parse(raw);
  const ten = String(ev.event_name ?? "");
  const isText = ten === "user_send_text";
  const isImage = ten === "user_send_image"; // FR-134: bot đọc ảnh

  // FR-160: sự kiện NGOÀI text/image không còn bị vứt lặng lẽ.
  // Trước bản này `if (!isText && !isImage) return;` nuốt sạch mọi thứ khác,
  // làm mất hai thứ đáng giá nhất mà kênh OA cho không:
  //   · `follow` mang theo tham số `ref` của deep-link — zaloLink() trong
  //     lib/format.ts nhét sẵn "?ref=#BDS-Q5-0115" vào mọi nút Chat Zalo. Đó
  //     ĐÚNG là ngữ cảnh FR-13/14: khách vừa bấm từ trang tin nào sang. Bỏ qua
  //     là bot chào trống không, bắt khách kể lại thứ họ vừa bấm.
  //   · `unfollow` là tín hiệu tiêu cực rõ ràng nhất người dùng phát ra được.
  //     Bỏ qua thì `nudge` vẫn đi hỏi thăm người đã bỏ theo dõi — vừa phiền
  //     người ta, vừa đốt lượt gửi vào một kênh đã đóng.
  if (!isText && !isImage) {
    const follower = String(ev.follower?.id ?? ev.user_id_by_app ?? ev.sender?.id ?? "");
    if (!follower) return;
    if (ten === "follow") {
      // `ref` nằm ở chỗ khác nhau tuỳ nguồn link — lấy hết rồi chọn cái có mặt.
      const ref = String(ev.follower?.ref ?? ev.info?.ref ?? ev.ref ?? "").trim();
      const { out } = await goiBoNao({
        external_user_id: follower,
        system_event: "follow",
        ref: ref || undefined,
        channel: "zalo_oa",
      });
      await guiBongBong(client, follower, out);
      return;
    }
    if (ten === "unfollow") {
      await goiBoNao({
        external_user_id: follower,
        system_event: "unfollow",
        channel: "zalo_oa",
      });
      return; // KHÔNG gửi gì — kênh vừa đóng, gửi là chắc chắn hụt
    }
    // Loại khác (user_seen_message, oa_send_text…) chưa dùng tới. Ghi một dòng
    // gọn để sau này biết OA thật sự bắn những gì, khỏi phải đoán.
    console.log(`zalo-webhook: bỏ qua event ${ten}`);
    return;
  }

  const zaloUserId = String(ev.sender?.id ?? "");
  const text = String(ev.message?.text ?? "").trim();
  const imageUrl = isImage ? String(ev.message?.attachments?.[0]?.payload?.url ?? "") : "";
  const zaloMsgId = ev.message?.msg_id ? String(ev.message.msg_id) : null;
  if (!zaloUserId || (!text && !imageUrl)) return;

  // Bộ não dùng chung (NFR-12): nhớ khách, hồ sơ nhu cầu FR-130, dedupe msg_id
  const { out, status } = await goiBoNao({
    external_user_id: zaloUserId,
    text,
    image_url: imageUrl || undefined,
    msg_id: zaloMsgId,
    channel: "zalo_oa",
  });
  // Bộ não từ chối (403 cổng FR-151, 429 trần model, lỗi model…) → khách KHÔNG
  // nhận được câu trả lời nào, mà webhook đã trả 200 cho Zalo từ lâu. Ghi sổ.
  if (out?.error) return await ghiLoi(client, "zalo-webhook brain", out.error, status);
  await guiBongBong(client, zaloUserId, out);
}

/** Đưa câu trả lời của bộ não ra OA: bong bóng chữ trước, ảnh sau. */
async function guiBongBong(
  client: ReturnType<typeof serviceClient>,
  userId: string,
  out: Record<string, unknown>,
): Promise<void> {
  const bubbles: string[] = Array.isArray(out?.replies) && out.replies.length
    ? out.replies as string[]
    : out?.reply
    ? [out.reply as string]
    : [];
  const photos: string[] = Array.isArray(out?.photos) ? out.photos as string[] : [];
  if (!bubbles.length && !photos.length) return;

  // FR-158: token SỐNG lấy từ bot_tokens. Đọc thẳng Vault như bản cũ là đọc
  // lại chuỗi đã chết sau 25 tiếng, và chết im lặng vì OA vẫn trả HTTP 200.
  const accessToken = await zaloToken(client);
  if (!accessToken) return; // chưa cấu hình OA — chỉ ghi log (đã lưu messages)

  // Quyết định 25/08: KHÔNG delay nhân tạo — bong bóng đầu đi ngay lập tức,
  // giữa các bong bóng chỉ chừa 300ms cho Zalo giao đúng thứ tự.
  for (const [i, bubble] of bubbles.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 300));
    const ok = await sendZalo(accessToken, userId, bubble);
    // Gửi hụt = khách ngồi chờ một câu không bao giờ tới. Đây là hỏng nặng
    // nhất phía B mà lại im nhất, vì mọi mã HTTP trên đường đều 200.
    if (!ok) await ghiLoi(client, "zalo-webhook send", `bong bóng: ${bubble.slice(0, 80)}`);
  }

  // FR-143: bộ não trả về hình thật (kho ảnh theo mã + URL chính chủ gửi)
  for (const url of photos) {
    const ok = await sendZaloImage(accessToken, userId, url);
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
    // JSON.parse ở đây từng là một đường nổ chưa ai bắt: body rác → throw →
    // 500, mà Zalo coi 500 là "gửi lại", nên rác cứ dội về mãi.
    let ts: unknown = "";
    try {
      ts = JSON.parse(raw).timestamp ?? "";
    } catch {
      return new Response("bad json", { status: 400 });
    }
    const mac = await sha256hex(`${appId}${raw}${ts}${appSecret}`);
    if (!bangNhauHangSo(sig, `mac=${mac}`)) {
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
