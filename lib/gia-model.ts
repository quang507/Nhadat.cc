// Bảng giá model — MỘT NGUỒN cho /admin (04/10/2026, SRS-5.1zv). Đô trên MỘT TRIỆU chữ-máy, giá niêm yết Anthropic
// (bảng cached 25/09/2026 trong skill claude-api; kiểm lại khi đổi model). Để trong code, không nhét vào DB: giá đổi thì
// sửa một chỗ, số chữ đã ghi trong `bot_usage_model` vẫn đúng mãi.
//
// Trước bản này /admin dùng một cặp hằng số GIA_VAO=5 / GIA_RA=25 (giá Opus) cho MỌI token → cao hơn thật 1,7× khi bot
// chạy Sonnet 4.6, 5× khi chạy Haiku 4.5, và tính tiền cho cả lượt Groq/Gemini vốn không đụng credit Anthropic.

export type GiaModel = { vao: number; ra: number; nhan: string };

/** Khớp theo tiền tố ID model (ID thật có đuôi ngày, vd `claude-haiku-4-5-20251001`). Thứ tự: cụ thể trước. */
const BANG_GIA: Array<[RegExp, GiaModel]> = [
  [/^claude-haiku-4-5/, { vao: 1, ra: 5, nhan: "Haiku 4.5" }],
  [/^claude-sonnet-4-6/, { vao: 3, ra: 15, nhan: "Sonnet 4.6" }],
  [/^claude-sonnet-4-5/, { vao: 3, ra: 15, nhan: "Sonnet 4.5" }],
  [/^claude-sonnet-5-5/, { vao: 2, ra: 10, nhan: "Sonnet 5.5" }],
  [/^claude-sonnet-5/, { vao: 2, ra: 10, nhan: "Sonnet 5" }],
  [/^claude-opus-5-5/, { vao: 4, ra: 20, nhan: "Opus 5.5" }],
  [/^claude-opus-(5|4-[6-8])/, { vao: 5, ra: 25, nhan: "Opus" }],
  // Đường dự phòng (FR-194): bậc miễn phí, không trừ credit Anthropic → 0 đô, nhưng vẫn hiện số chữ để biết nó chạy bao nhiêu.
  [/^(Groq|Gemini):/, { vao: 0, ra: 0, nhan: "dự phòng (Groq/Gemini)" }],
];

/** Hệ số bộ nhớ tạm: ghi cache nhớ 1 giờ = 2× giá vào (chat-reply dùng `ttl: "1h"`); đọc cache = 0,1× giá vào. */
export const HE_SO_NAP = 2;
export const HE_SO_DOC = 0.1;

/** Giá của một model; `null` = chưa có trong bảng (kể cả `khac` của dòng cũ) → không quy ra đô, không đoán. */
export function giaCua(model: string | null | undefined): GiaModel | null {
  const m = (model ?? "").trim();
  if (!m) return null;
  for (const [re, g] of BANG_GIA) if (re.test(m)) return g;
  return null;
}

export type DongToken = {
  model: string;
  in_tokens: number;
  out_tokens: number;
  cache_write_tokens: number;
  cache_read_tokens: number;
};

/** Đô của một dòng (ngày × model); `null` khi model chưa có giá. */
export function tienDong(t: DongToken): number | null {
  const g = giaCua(t.model);
  if (!g) return null;
  return (t.in_tokens * g.vao + t.out_tokens * g.ra + t.cache_write_tokens * g.vao * HE_SO_NAP + t.cache_read_tokens * g.vao * HE_SO_DOC) / 1_000_000;
}

/** Tổng đô của nhiều dòng — chỉ cộng dòng có giá; `chuaRo` = số dòng bỏ qua vì chưa rõ model/giá. */
export function tongTien(rows: DongToken[]): { tien: number; chuaRo: number } {
  let tien = 0, chuaRo = 0;
  for (const r of rows) { const d = tienDong(r); if (d === null) chuaRo++; else tien += d; }
  return { tien, chuaRo };
}
