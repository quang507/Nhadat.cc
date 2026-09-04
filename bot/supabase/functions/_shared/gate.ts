// Cổng bí mật dùng chung cho mọi edge function (soát bảo mật 29/08/2026,
// gộp về một chỗ 02/09/2026 — FR-171 k). Trước đây khối này chép SÁU bản gần
// giống nhau: sửa luật ở một function là năm function kia lệch mà không ai hay.
//
// Luật (giữ nguyên từng function đang có):
//   * Đọc BRIDGE_SECRET qua `secretOf` (env trước, Vault sau). Đọc hụt là cổng
//     MỞ — fail-open có chủ ý để gắn cổng trước khi có bí mật không làm gãy
//     cron — nhưng phải ghi `bot_errors` để /admin thấy (im lặng mới là nguy).
//   * Cho qua khi: `Authorization: Bearer <service_role key>` (server-to-server
//     như zalo-webhook → chat-reply), hoặc header `x-bridge-secret` khớp.
//   * Trượt → trả JSON lỗi với mã `ma` (403 mặc định; escalation-feed giữ 401
//     như từ đầu vì bridge đã quen mã đó).
// Trả `null` khi được qua, trả `Response` khi phải chặn — nơi gọi:
//   const chan = await congBiMat(req, client, "nudge"); if (chan) return chan;
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { ghiLoi, jsonResponse, secretOf } from "./claude.ts";

export async function congBiMat(
  req: Request,
  client: SupabaseClient,
  ten: string,
  ma = 403,
  loi = "forbidden",
): Promise<Response | null> {
  const bimat = await secretOf(client, "BRIDGE_SECRET");
  if (!bimat) {
    await ghiLoi(client, `${ten} CONG MO`,
      "Không đọc được BRIDGE_SECRET (env lẫn Vault) — cổng đang MỞ, ai cũng gọi được.");
    return null;
  }
  const laDichVu = req.headers.get("authorization") ===
    `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (laDichVu || req.headers.get("x-bridge-secret") === bimat) return null;
  return jsonResponse({ error: loi }, ma);
}
