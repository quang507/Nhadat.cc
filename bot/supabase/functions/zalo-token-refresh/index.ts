// zalo-token-refresh — FR-158: đổi refresh_token lấy access_token mới cho OA.
// Chạy theo cron `zalo-token-tick` (12 tiếng/nhịp, migration 20260827j).
// POST {} → { ok, expires_in } | { error }
//
// VÌ SAO PHẢI CÓ: access token OA sống 25 TIẾNG. Không có ai đổi thì đúng một
// ngày sau khi cấp tay, mọi `sendZalo()` trả error != 0 — bot câm với khách,
// mà mã HTTP trên cả đường đi vẫn 200 nên không còi nào kêu (NFR-18).
//
// Zalo XOAY refresh_token: mỗi lần đổi thành công là chuỗi cũ CHẾT. Vậy nên
// hàm này ghi cặp mới vào `bot_tokens` NGAY, và chỉ coi là xong sau khi ghi
// được — đổi thành công mà ghi hụt là mất chìa khoá, phải vào Zalo Developers
// cấp tay lại từ đầu.
import { ghiLoi, jsonResponse, secretOf, serviceClient } from "../_shared/claude.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const db = serviceClient();

  const appId = await secretOf(db, "ZALO_APP_ID");
  const appSecret = await secretOf(db, "ZALO_APP_SECRET");
  if (!appId || !appSecret) {
    // Chưa cấu hình OA thì đây KHÔNG phải lỗi — dự án đang chạy đường bridge.
    return jsonResponse({ ok: false, skipped: "chưa có ZALO_APP_ID/ZALO_APP_SECRET" });
  }

  // Chìa khoá còn sống nằm ở bảng; lần chạy đầu tiên thì lấy hạt giống ở Vault.
  const { data: cur } = await db.from("bot_tokens")
    .select("refresh_token").eq("name", "zalo_oa").maybeSingle();
  const refreshToken = (cur as { refresh_token?: string } | null)?.refresh_token ??
    await secretOf(db, "ZALO_OA_REFRESH_TOKEN");
  if (!refreshToken) {
    await ghiLoi(db, "zalo-token-refresh", "không có refresh_token (bảng bot_tokens lẫn Vault ZALO_OA_REFRESH_TOKEN đều trống)");
    return jsonResponse({ error: "thiếu refresh_token" }, 412);
  }

  let body: Record<string, unknown> = {};
  try {
    // v4 nhận form-urlencoded, secret đi ở HEADER (không phải body) — đặt nhầm
    // chỗ thì Zalo trả -201 "app secret không hợp lệ" chứ không nói rõ vì sao.
    const r = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        secret_key: appSecret,
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        app_id: appId,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(20_000),
    });
    body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`HTTP ${r.status} ${JSON.stringify(body).slice(0, 200)}`);
  } catch (e) {
    await ghiLoi(db, "zalo-token-refresh gọi Zalo", e);
    await db.from("bot_tokens").upsert({
      name: "zalo_oa", last_error: String(e), updated_at: new Date().toISOString(),
    }, { onConflict: "name" });
    return jsonResponse({ error: String(e) }, 502);
  }

  const access = typeof body.access_token === "string" ? body.access_token : null;
  const nextRefresh = typeof body.refresh_token === "string" ? body.refresh_token : null;
  if (!access) {
    // Zalo trả 200 kèm { error: -xxx } khi refresh_token đã chết. Đây là ĐƯỜNG
    // CỤT thật sự: không ai đổi hộ được nữa, phải người vào Zalo Developers cấp
    // lại. Ghi sổ thật to để /admin thấy, đừng nuốt.
    const detail = JSON.stringify(body).slice(0, 300);
    await ghiLoi(db, "zalo-token-refresh", `Zalo không trả access_token: ${detail}. PHẢI cấp lại tay ở Zalo Developers rồi nạp vào bot_tokens.`);
    await db.from("bot_tokens").upsert({
      name: "zalo_oa", last_error: detail, updated_at: new Date().toISOString(),
    }, { onConflict: "name" });
    return jsonResponse({ error: "Zalo từ chối refresh_token", detail }, 502);
  }

  // expires_in Zalo trả bằng GIÂY, và trả dưới dạng CHUỖI ("90000"). Number()
  // thẳng là ra NaN nếu quên — hạn thành Invalid Date và zaloToken() kêu nhầm.
  const expiresIn = Number(body.expires_in) > 0 ? Number(body.expires_in) : 25 * 3600;
  const { error: wErr } = await db.from("bot_tokens").upsert({
    name: "zalo_oa",
    access_token: access,
    // Zalo không phải lúc nào cũng trả refresh_token mới; không có thì GIỮ
    // chuỗi cũ, tuyệt đối đừng ghi null đè lên chìa khoá đang dùng được.
    ...(nextRefresh ? { refresh_token: nextRefresh } : {}),
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    last_error: null,
  }, { onConflict: "name" });
  if (wErr) {
    // Đổi được mà ghi hụt = vừa đốt mất refresh_token cũ và không giữ được cái
    // mới. Ghi sổ kèm nguyên văn lỗi, đây là tình huống phải người vào tay.
    await ghiLoi(db, "zalo-token-refresh ghi bảng", `${wErr.message} — CHÌA KHOÁ MỚI CHƯA ĐƯỢC LƯU, refresh_token cũ đã chết. Cấp lại tay ngay.`);
    return jsonResponse({ error: wErr.message }, 500);
  }

  return jsonResponse({ ok: true, expires_in: expiresIn, rotated: !!nextRefresh });
});
