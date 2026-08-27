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
