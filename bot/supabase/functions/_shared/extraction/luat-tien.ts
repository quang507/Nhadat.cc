// LUẬT TIỀN — MỘT NGUỒN cho mọi chỗ phía TS đọc giá (tầng bốn, 11/09/2026).
//
// Chủ dự án: "gom các luật đang tồn tại hai ba bản song song về một nguồn".
//
// Trước bản này luật tiền có NĂM bản chép tay, và chúng lệch nhau đúng ở những
// chỗ đã cắn người thật:
//   · chat-reply `TIEN_KD`         biết "toi" = TỚI khi sau nó là số ("5 toi 6 ty")
//   · khop-cau-tra-loi (3 chỗ)     KHÔNG biết → "5 tới 6 tỷ" ghi giá "5 tới 6" (D1)
//   · lib/parse-query `DV`         nhánh "8ty2" chỉ nhận ty|ti → "2 tỏi 5" ra 2 tỷ (D6)
//   · hai bộ dò "câu có tiền không" quên luôn "toi"
//   · SQL `parse_vnd`              bản thứ năm, KHÔNG import được file này
// Sửa một chỗ quên bốn chỗ là hình lỗi lặp lại mười một lần trong bản review
// 10/09 ("luật đúng đã viết ra, nhưng chỉ áp một chỗ trong khi nó sống ở nhiều
// chỗ"). Nay mọi bản TS nhập từ đây; bản SQL thì không nhập được nên nó phải
// trả lời ĐÚNG CÙNG MỘT BẢNG CA (`bot/tests/luat/tien.json`) — bài
// `doi-chieu-tien.mjs` chạy cả hai bản trên bảng đó và đỏ khi chúng lệch nhau.
//
// File này không import gì: nó thuộc tầng bóc tách tiền định (luật
// `ranh-gioi.mjs`), và web (`lib/`) nhập thẳng nó qua đường `@/bot/...`.

/**
 * Đơn vị tiền trên chuỗi ĐÃ BỎ DẤU. "toi" là tỏi (tỷ) CHỈ khi sau nó KHÔNG có
 * số — "5 toi 6 ty" là "5 TỚI 6". "tr" là triệu nhưng không được nuốt "trệt"
 * (đã bỏ dấu thành "tret" — lookahead chặn mọi chữ cái đứng sau).
 */
export const TIEN_KD = "ty|ti|toi(?!\\s*\\d)|trieu|tr(?![a-z])|cu";

/**
 * Đơn vị tiền trên chuỗi CÒN DẤU. "tỏi" có dấu thì luôn là tỷ — người gõ đủ dấu
 * đã tự phân biệt "tỏi" với "tới" giùm mình, khỏi đoán theo con số đứng sau.
 */
export const TIEN_CD = "tỷ|tỉ|tỏi|triệu|ty|ti|toi(?!\\s*\\d)|trieu|tr(?![a-zA-ZÀ-ỹ])|cu";

/** Đơn vị vừa khớp là họ tỷ (1e9) hay họ triệu (1e6). */
export function laDonViTy(u: string): boolean {
  return /^(ty|ti|toi|tỷ|tỉ|tỏi)$/i.test(u.trim());
}

/** Câu (ĐÃ BỎ DẤU) có nhắc một lượng tiền không — số + đơn vị. */
export const CO_TIEN_KD = new RegExp(`\\d\\s*(?:${TIEN_KD})(?![a-z])`);

/**
 * Đọc MỘT con số tiền từ một câu — cùng luật với SQL `parse_vnd` (phiên dịch
 * từng dòng, xem `bot/supabase/schema.sql`). Tồn tại để bài đối chiếu có một
 * bản TS mà so với bản SQL trên cùng bảng ca; nơi nào ở TS cần MỘT con số giá
 * thì dùng hàm này thay vì viết regex riêng.
 *
 * Một chỗ phải dịch cẩn thận: `\M` của Postgres là "hết từ", mà chữ có dấu là
 * CHỮ — nên "1 trệt" không thành "1 triệu". JS `\b` coi "ệ" là ranh giới, nên
 * phải dùng lớp `\p{L}` thay vào, không thì hai bản lệch nhau đúng ở câu có dấu.
 */
export function docTien(p: string | null | undefined): number | null {
  if (!p || !p.trim()) return null;
  let t = p.toLowerCase();
  const ruoi = /rưỡi|rươi|ruoi/.test(t);
  t = t.replace(/tỏi|tỷ|tỉ|tị|tỹ/g, " _ty ");
  t = t.replace(/triệu|trieu|củ/g, " _trieu ");
  t = t.replace(/([0-9])\s*ty\s*([0-9])/g, "$1 _ty $2");
  t = t.replace(/([0-9])\s*t\s*([0-9])/g, "$1 _ty $2");
  t = t.replace(/([0-9])\s*ty(?![\p{L}\p{N}_])/gu, "$1 _ty ");
  t = t.replace(/([0-9])\s*tr(?![\p{L}\p{N}_])/gu, "$1 _trieu ");
  t = t.replace(/([0-9])\s*t(?![\p{L}\p{N}_])/gu, "$1 _ty ");

  // Phần lẻ sau đơn vị: "5 tỷ 5" = 5,5 tỷ · "3 tỷ 200" = 3,2 tỷ. Không nuốt
  // "5 tỷ 50m2" (diện tích) — cấm chữ số lẫn "m" đứng ngay sau.
  let m = /([0-9]+)\s*_ty\s*([0-9]{1,3})(?![0-9.,]|\s*m)/.exec(t);
  if (m) {
    return Number(m[1]) * 1e9 + (m[2].length === 1 ? Number(m[2]) * 1e8 : Number(m[2]) * 1e6);
  }
  m = /([0-9]+[.,]?[0-9]*)\s*_ty/.exec(t);
  if (m) {
    let v = parseFloat(m[1].replace(",", ".")) * 1e9;
    if (ruoi) v += 5e8;
    return Math.round(v);
  }
  m = /([0-9]+[.,]?[0-9]*)\s*_trieu/.exec(t);
  if (m) {
    let v = parseFloat(m[1].replace(",", ".")) * 1e6;
    if (ruoi) v += 5e5;
    return Math.round(v);
  }
  return null;
}
