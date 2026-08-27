// Hạ tầng dùng chung cho mọi edge function: client Supabase/Claude, đọc secret,
// gửi Zalo OA, đóng gói JSON response, và soạn text việc-nội-bộ.
// Mọi function PHẢI dùng ở đây thay vì tự viết lại — trước đây `db()`/`secret()`
// bị chép 5 bản, `sendZalo()` 2 bản, và text escalation trùng byte giữa `nudge`
// với `escalation-feed` (sửa một nơi quên nơi kia là lệch giọng bot ngay).
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const MODEL = "claude-opus-5";

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** Secret lấy từ env (supabase secrets) trước, không có thì đọc Vault. */
export async function secretOf(db: SupabaseClient, name: string): Promise<string | null> {
  const fromEnv = Deno.env.get(name);
  if (fromEnv) return fromEnv;
  const { data } = await db.rpc("get_secret", { secret_name: name });
  return (data as string) ?? null;
}

export async function anthropicClient(db: SupabaseClient): Promise<Anthropic> {
  const apiKey = await secretOf(db, "ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Không tìm thấy ANTHROPIC_API_KEY (env lẫn Vault)");
  return new Anthropic({ apiKey });
}

/**
 * FR-152 — ghi một lỗi tầng ứng dụng vào sổ bền `bot_errors` (hiện ở /admin).
 *
 * `console.error` KHÔNG đủ: log edge function bậc Free chỉ giữ 1 ngày, mà loại
 * lỗi nguy nhất ở đây lại trả 200 (catch nuốt exception rồi hàm chạy tiếp), nên
 * bot_health_tick — vốn chỉ soi mã HTTP — không thấy gì. Vẫn giữ console.error
 * để đọc realtime lúc đang debug, và ghi thêm vào sổ để mai còn tra được.
 *
 * KHÔNG BAO GIỜ NÉM. Mọi nơi gọi hàm này đều đang ở trong `catch` — ném ở đây
 * là biến một lỗi thành hai, mà lỗi thứ hai còn không ai bắt.
 */
export async function ghiLoi(
  db: SupabaseClient,
  source: string,
  detail: unknown,
  code?: number,
): Promise<void> {
  const text = detail instanceof Error
    ? (detail.message || String(detail))
    : String(detail ?? "");
  console.error(`${source}:`, text);
  try {
    await db.rpc("log_loi", { p_source: source, p_detail: text, p_code: code ?? null });
  } catch { /* sổ hỏng thì thôi, đừng kéo theo cả luồng chính */ }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/** Gửi một tin text qua Zalo OA. true = OA nhận (error === 0). */
export async function sendZalo(token: string, userId: string, text: string): Promise<boolean> {
  const r = await fetch("https://openapi.zalo.me/v3.0/oa/message/cs", {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: token },
    body: JSON.stringify({ recipient: { user_id: userId }, message: { text } }),
  });
  const j = await r.json().catch(() => ({}));
  return j?.error === 0;
}

/** FR-143: gửi ảnh qua OA bằng media template. */
export async function sendZaloImage(token: string, userId: string, url: string): Promise<boolean> {
  const r = await fetch("https://openapi.zalo.me/v3.0/oa/message/cs", {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: token },
    body: JSON.stringify({
      recipient: { user_id: userId },
      message: {
        attachment: {
          type: "template",
          payload: { template_type: "media", elements: [{ media_type: "image", url }] },
        },
      },
    }),
  });
  const j = await r.json().catch(() => ({}));
  return j?.error === 0;
}

/**
 * Text của một việc trong hàng đợi `reminders` khi đi ra ngoài (OA hoặc bridge).
 * Dùng CHUNG cho `nudge` (đường OA) và `escalation-feed` (đường bridge) — hai
 * đường phải nói y hệt nhau.
 * - kind `report` (FR-149): báo cáo CTV 17h → gửi NGUYÊN VĂN về Zalo admin.
 * - có seller_id (FR-144): đích là chính chủ → giọng CSKH lễ phép.
 * - còn lại: CTV/admin → thông báo nội bộ.
 */
export function escalationText(
  r: { kind: string; note: unknown; seller_id?: string | null },
): string {
  if (r.kind === "report") return String(r.note);
  return r.seller_id
    ? `Chào anh/chị, em bên nhadat.cc ạ. ${r.note}. Anh/chị bổ sung giúp em để em báo khách liền nha!`
    : `🔔 nhadat.cc: ${r.note}. Anh/chị check giúp rồi trả lời khách sớm nha.`;
}

/**
 * FR-158 — token Zalo OA tự làm mới.
 *
 * Access token của Zalo OA sống 25 tiếng. Trước bản này token nằm CHẾT trong
 * Vault (`ZALO_OA_ACCESS_TOKEN`): quá 25 tiếng là mọi lượt `sendZalo` trả
 * error != 0, bot câm với khách mà mã HTTP vẫn 200 — đúng kiểu hỏng im lặng.
 *
 * Giờ token sống nằm ở bảng `bot_tokens`, được `zalo-token-refresh` (cron 12h)
 * ghi đè. Vault chỉ còn là hạt giống cho lần chạy đầu.
 *
 * Đọc token PHẢI đi qua hàm này, đừng gọi thẳng `secretOf(db,
 * "ZALO_OA_ACCESS_TOKEN")` nữa — gọi thẳng là đọc lại hạt giống đã hết hạn.
 */
export async function zaloToken(db: SupabaseClient): Promise<string | null> {
  const { data } = await db.from("bot_tokens")
    .select("access_token, expires_at").eq("name", "zalo_oa").maybeSingle();
  const row = data as { access_token?: string; expires_at?: string } | null;
  if (row?.access_token) {
    // Còn hạn (chừa 10 phút biên) thì dùng; hết hạn vẫn thử — token cũ đôi khi
    // còn ân hạn, và im lặng vẫn tệ hơn một cú gửi hụt có ghi sổ.
    if (!row.expires_at || Date.parse(row.expires_at) - Date.now() > 10 * 60e3) {
      return row.access_token;
    }
    await ghiLoi(db, "zalo token", `access_token hết hạn lúc ${row.expires_at} — cron zalo-token-refresh có chạy không?`);
    return row.access_token;
  }
  return await secretOf(db, "ZALO_OA_ACCESS_TOKEN");
}

/**
 * FR-159 — kéo ảnh Zalo về kho của mình.
 *
 * Link ảnh Zalo trả trong webhook là CDN TẠM. Lưu thẳng link đó vào
 * `listing_facts` thì vài tuần sau nó trả 404: tin trên web mất ảnh, bot gửi
 * lại cho khách cũng ra ảnh vỡ, mà không có lỗi nào nổ ở đâu cả — dữ liệu chỉ
 * lặng lẽ mục đi.
 *
 * Tải về rồi đẩy lên bucket `listing-photos/<mã tin>/…` (đúng quy ước FR-148,
 * nên view `listing_photos_v` thấy được ngay và trang tin tự có ảnh).
 * Trả về URL công khai bền, hoặc `null` nếu hỏng — nơi gọi tự quyết định có
 * dùng link tạm làm đường lùi hay không.
 */
export async function luuAnhVaoKho(
  db: SupabaseClient,
  listingCode: string,
  url: string,
): Promise<string | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`tải ảnh HTTP ${r.status}`);
    const buf = new Uint8Array(await r.arrayBuffer());
    // Zalo không luôn trả Content-Type tử tế; đuôi lấy từ URL, không có thì .jpg
    const ext = /\.(jpe?g|png|webp|gif)(?:$|\?)/i.exec(url)?.[1]?.toLowerCase() ?? "jpg";
    const contentType = r.headers.get("content-type")?.split(";")[0] ||
      `image/${ext === "jpg" ? "jpeg" : ext}`;
    // Tên file có thời điểm → xếp theo tên là xếp theo thời gian gửi (view
    // listing_photos_v order by path), ảnh chủ nhà gửi sau nằm sau.
    const path = `${listingCode}/chat-${new Date().toISOString()
      .replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await db.storage.from("listing-photos")
      .upload(path, buf, { contentType, upsert: false });
    if (error) throw error;
    const { data } = db.storage.from("listing-photos").getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch (e) {
    await ghiLoi(db, "luuAnhVaoKho", e);
    return null;
  }
}
