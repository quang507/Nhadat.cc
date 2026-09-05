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

/**
 * SEC-02 — `secretOf` gộp hai chuyện khác hẳn nhau vào cùng một `null`:
 * "secret CHƯA ĐẶT" và "ĐỌC HỤT secret" (Vault lỗi, DB quá tải, timeout, hết
 * kết nối). Cổng cũ coi cả hai là "mở", nên một lần DB nghẹn là bảy edge
 * function thành công khai — đúng lúc hệ thống yếu nhất. Hàm này tách hai
 * trạng thái ra để nơi gọi xử khác nhau: chưa đặt thì còn cân nhắc được,
 * đọc hụt thì luôn phải chặn.
 */
export async function docBiMat(
  db: SupabaseClient,
  name: string,
): Promise<{ giaTri: string | null; loi: string | null }> {
  const fromEnv = Deno.env.get(name);
  if (fromEnv) return { giaTri: fromEnv, loi: null };
  const { data, error } = await db.rpc("get_secret", { secret_name: name });
  if (error) return { giaTri: null, loi: error.message };
  return { giaTri: (data as string) ?? null, loi: null };
}

/**
 * SEC-11 — so hai chuỗi bí mật trong thời gian không phụ thuộc nội dung.
 * `===` trên chuỗi thoát ngay ở byte đầu khác nhau, nên đo thời gian phản hồi
 * qua nhiều nghìn request là dò dần được từng byte. `BRIDGE_SECRET` là bí mật
 * dài hạn nên kẻ tấn công có thừa thời gian. Băm cả hai vế rồi so từng byte
 * của bản băm: độ dài luôn bằng nhau (32 byte) nên vòng lặp không rò gì.
 */
export async function bangNhau(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const ax = new Uint8Array(x);
  const bx = new Uint8Array(y);
  let khac = 0;
  for (let i = 0; i < ax.length; i++) khac |= ax[i] ^ bx[i];
  return khac === 0;
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

/**
 * Đồng hồ đo tiền (migration 20260901b) — ghi số CHỮ thật của một lượt gọi bộ
 * não vào `bot_usage` của ngày hôm nay.
 *
 * Vì sao cần, khi đã có `bump_model_quota` đếm lượt: tiền tính theo chữ chứ
 * không theo lượt, và bốn loại chữ có bốn giá lệch nhau tới 50 lần. Không đo
 * thì mọi câu trả lời cho "tốn bao nhiêu, scale lên có chịu nổi không" đều là
 * ước tính từ số ký tự, sai số lớn.
 *
 * Cặp số đáng nhìn nhất là cache_write so với cache_read: write cao mà read
 * thấp nghĩa là lượt nào cũng trượt bộ nhớ tạm — đang trả THÊM tiền để không
 * được gì, và phải đổi nhịp nhớ tạm (xem khối bình luận ở chỗ cache_control
 * trong chat-reply).
 *
 * KHÔNG BAO GIỜ NÉM, cùng lý do với ghiLoi: mọi nơi gọi hàm này đều đã có sẵn
 * câu trả lời cho khách trong tay. Đồng hồ hỏng thì thôi, không được phép kéo
 * câu trả lời đó xuống nhánh dự phòng.
 *
 * Nối ở cả bốn nơi gọi model: `chat-reply`, `nudge`, `ask-seller`, `ctv-report`
 * (FR-171 e, 02/09/2026). Thêm một chỗ gọi model mới mà quên gọi hàm này là số
 * trong bảng lại thành sàn.
 */
export async function doTien(
  db: SupabaseClient,
  usage: {
    input_tokens?: number | null;
    output_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  } | null | undefined,
): Promise<void> {
  if (!usage) return;
  try {
    await db.rpc("cong_token", {
      p_in: usage.input_tokens ?? 0,
      p_out: usage.output_tokens ?? 0,
      p_cache_write: usage.cache_creation_input_tokens ?? 0,
      p_cache_read: usage.cache_read_input_tokens ?? 0,
    });
  } catch (e) {
    // Nối dây vào sổ (FR-152) — một `catch` im lặng ở đây là một đồng hồ chết
    // mà không ai biết, rồi số liệu tiền lặng lẽ sai.
    await ghiLoi(db, "do tien", e);
  }
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
