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
  // FR-162: exactly-once chiều GỬI. Replay + already_sent = câu trả lời này
  // ĐÃ tới tay khách ở lần giao trước — provider giao trùng thì im, đừng bắn
  // đúp bong bóng. already_sent còn trống (lần trước gửi hụt / chưa kịp gửi)
  // thì đi tiếp: đây chính là đường retry outbound.
  if (out?.replayed && out?.already_sent) return;
  const bubbles: string[] = Array.isArray(out?.replies) && out.replies.length
    ? out.replies
    : out?.reply
    ? [out.reply]
    : [];
  if (!bubbles.length) return;

  const accessToken = await secretOf(client, "ZALO_OA_ACCESS_TOKEN");
  if (!accessToken) return; // chưa cấu hình OA — chỉ ghi log (đã lưu messages)

  // FR-166 bất biến 10/12 — ĐIỂM NỐI LẠI.
  // Trước bản này, sập giữa chừng là lần sau phát lại TỪ ĐẦU: bong bóng 1 đã
  // tới tay khách rồi vẫn bị gửi lần nữa. `sent_bubbles` đếm số tấm ĐÃ tới
  // Zalo, ghi ngay sau từng tấm, nên lần thử sau đi tiếp đúng chỗ đang dở.
  // Zalo OA `message/cs` không có khoá idempotency phía nhà cung cấp, nên đếm
  // ở phía mình là cách an toàn mạnh nhất mà tích hợp hiện tại cho phép.
  let daGui = 0;
  if (zaloMsgId) {
    const { data: so } = await client.from("inbound_ledger")
      .select("sent_bubbles").eq("zalo_msg_id", zaloMsgId).maybeSingle();
    daGui = Math.min(so?.sent_bubbles ?? 0, bubbles.length);
  }

  // Quyết định 25/08: KHÔNG delay nhân tạo — bong bóng đầu đi ngay lập tức,
  // giữa các bong bóng chỉ chừa 300ms cho Zalo giao đúng thứ tự.
  let guiHut = 0; // FR-162: đếm bong bóng gửi hụt để ghi vào sổ inbound_ledger
  for (let i = daGui; i < bubbles.length; i++) {
    const bubble = bubbles[i];
    if (i > 0) await new Promise((r) => setTimeout(r, 300));
    let ok = await sendZalo(accessToken, zaloUserId, bubble);
    if (!ok) {
      // FR-162: OA nghẹn thoáng qua là chuyện có thật — thử lại ĐÚNG MỘT lần
      // sau 2s trước khi bỏ cuộc. Câu trả lời đã nằm trong inbound_ledger nên
      // kể cả bỏ cuộc, gọi lại chat-reply cùng msg_id là phát lại được.
      await new Promise((r) => setTimeout(r, 2000));
      ok = await sendZalo(accessToken, zaloUserId, bubble);
    }
    // Gửi hụt = khách ngồi chờ một câu không bao giờ tới. Đây là hỏng nặng
    // nhất phía B mà lại im nhất, vì mọi mã HTTP trên đường đều 200.
    if (!ok) {
      guiHut = bubbles.length - i; // số tấm CÒN LẠI chưa tới
      await ghiLoi(client, "zalo-webhook send", `bong bóng: ${bubble.slice(0, 80)}`);
      // DỪNG HẲN, không gửi nốt tấm sau: gửi tiếp thì khách nhận lộn thứ tự,
      // và điểm nối lại thành mơ hồ (tấm 2 tới mà tấm 1 chưa).
      break;
    }
    // Ghi NGAY sau từng tấm — sập ở dòng kế tiếp thì lần sau vẫn biết đã tới đâu.
    daGui = i + 1;
    if (zaloMsgId) {
      await client.from("inbound_ledger")
        .update({ sent_bubbles: daGui, updated_at: new Date().toISOString() })
        .eq("zalo_msg_id", zaloMsgId);
    }
  }

  // FR-162: chốt kết quả GỬI vào sổ — sent_at nghĩa là mọi bong bóng đã tới
  // Zalo; send_error là bằng chứng "AI đã chạy mà khách chưa nhận được", chỗ
  // duy nhất phân biệt nổi ca này với ca thành công (mọi HTTP đều 200).
  // Dòng sổ không tồn tại (msg_id null / sổ hỏng) thì update là no-op, kệ.
  if (zaloMsgId && bubbles.length) {
    const { error: soErr } = await client.from("inbound_ledger").update(
      guiHut
        ? { send_error: `${guiHut}/${bubbles.length} bong bóng gửi hụt`,
            updated_at: new Date().toISOString() }
        : { sent_at: new Date().toISOString(), send_error: null,
            updated_at: new Date().toISOString() },
    ).eq("zalo_msg_id", zaloMsgId);
    if (soErr) await ghiLoi(client, "zalo-webhook ledger send", soErr.message);
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

  // FR-166 — CỬA PHÁT LẠI cho đường cứu.
  // `inbound-sweep` gọi vào đây với `{replay_event_id}` để chạy lại đúng việc
  // đã bỏ dở. Cố ý KHÔNG viết một đường gửi riêng cho worker: hai đường gửi
  // song song là hai chỗ để hành vi trôi khỏi nhau, mà khâu gửi lại chính là
  // khâu chứa luật chống-gửi-đúp. Một đường, dùng chung.
  // Chỉ service_role gọi được — payload lấy từ sổ, không tin gì từ người gọi
  // ngoài chính cái id.
  // `catch` CHỈ bọc đúng `JSON.parse`. Bản trước bọc cả khối phát lại, nên một
  // exception từ `handleEvent` (model ném, mạng đứt, Zalo 500) bị nuốt SẠCH:
  // không ghi sổ, rồi rơi tuột xuống đường webhook thường và trả về 200.
  // `inbound-sweep` đọc 200 là "đã cứu xong" nên KHÔNG gọi `bao_hong_inbound`,
  // `attempts` không tăng, `next_retry_at` không đặt — nó phát lại đúng việc ấy
  // mỗi phút, suốt 24 giờ, và không ai thấy gì.
  let body: Record<string, unknown> | null = null;
  try {
    body = JSON.parse(raw);
  } catch { /* không phải JSON → đi tiếp đường webhook thường */ }

  if (body?.replay_event_id) {
    const isService = req.headers.get("authorization") ===
      `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
    if (!isService) return jsonResponse({ error: "forbidden" }, 403);

    const db = serviceClient();
    const { data: ev } = await db.from("inbound_events")
      .select("payload").eq("event_id", String(body.replay_event_id)).maybeSingle();
    if (!ev?.payload) return jsonResponse({ error: "khong thay su kien" }, 404);

    try {
      await handleEvent(JSON.stringify(ev.payload));
    } catch (e) {
      // Cứu hụt thì phải NÓI THẬT. Trả 200 ở đây là nói dối đường cứu.
      await ghiLoi(db, "zalo-webhook replay", e);
      return jsonResponse({ error: "replay hong" }, 500);
    }
    return jsonResponse({ ok: true, replayed_event: body.replay_event_id });
  }

  // Verify chữ ký nếu đã cấu hình app secret (mac = sha256(appId+data+timeStamp+secret))
  const client = serviceClient();
  const appSecret = await secretOf(client, "ZALO_APP_SECRET");
  const appId = await secretOf(client, "ZALO_APP_ID");
  if (!appSecret || !appId) {
    // SOÁT BẢO MẬT 29/08/2026 — LỖ ĐANG MỞ, cần chủ dự án ra tay.
    // Hàm này buộc phải chạy verify_jwt=false (Zalo không gửi được JWT của
    // Supabase), nên CHỮ KÝ `X-ZEvent-Signature` là hàng rào DUY NHẤT. Chưa đặt
    // ZALO_APP_SECRET/ZALO_APP_ID thì khối verify bên dưới bị nhảy qua — đo
    // thật 29/08: POST một sự kiện bịa, không khoá không chữ ký, nhận 200.
    // Nghĩa là người lạ giả được tin nhắn đến với BẤT KỲ sender.id nào: đội lốt
    // Zalo ID của một chủ nhà để bơm fact vào tin của họ, hoặc bơm tin rác để
    // đốt tiền model.
    // CỐ Ý KHÔNG chặn cứng ở đây: chặn là bot chết ngay với người dùng thật,
    // mà đó là quyết định của chủ dự án chứ không phải của đợt soát. Thay vào
    // đó kêu to — `log_loi` có van 20 dòng/nguồn/giờ nên không ngập sổ, và
    // trang /admin sẽ thấy. CHỮA THẬT = đặt hai secret đó vào Vault.
    await ghiLoi(
      client,
      "zalo-webhook KHONG VERIFY",
      "Thiếu ZALO_APP_SECRET/ZALO_APP_ID — webhook đang nhận sự kiện KHÔNG kiểm chữ ký. " +
        "Ai cũng giả được tin nhắn đến. Đặt hai secret này vào Vault để đóng lỗ.",
    );
  }
  if (appSecret && appId) {
    const sig = req.headers.get("X-ZEvent-Signature") ?? "";
    const ts = JSON.parse(raw).timestamp ?? "";
    const mac = await sha256hex(`${appId}${raw}${ts}${appSecret}`);
    if (sig !== `mac=${mac}`) {
      console.log("zalo-webhook: sai chữ ký, từ chối");
      return new Response("invalid signature", { status: 401 });
    }
  }

  // FR-162: ghi SỰ KIỆN vào sổ `inbound_events` TRƯỚC khi ack — verify xong →
  // insert idempotent (PK event_id, giao trùng chỉ tăng delivery_count) →
  // commit → 200 → xử lý nền. Instance chết ngay sau ack thì vẫn còn nguyên
  // payload trong sổ để xử lý lại, không mất tin không dấu vết.
  // Ghi hụt thì vào bot_errors rồi VẪN ack + xử lý — sổ sự kiện là lưới an
  // toàn, không phải cổng chặn.
  try {
    const ev = JSON.parse(raw);
    const evMsgId = ev?.message?.msg_id ? String(ev.message.msg_id) : null;
    const evText = ev?.event_name === "user_send_text" || ev?.event_name === "user_send_image";
    if (evText && evMsgId) {
      const { error: seErr } = await client.rpc("ghi_su_kien_inbound", {
        p_event_id: evMsgId,
        p_zalo_user_id: String(ev?.sender?.id ?? ""),
        p_payload: ev,
      });
      if (seErr) await ghiLoi(client, "zalo-webhook ghi_su_kien", seErr.message);
    }
  } catch (e) {
    await ghiLoi(client, "zalo-webhook ghi_su_kien", e);
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
