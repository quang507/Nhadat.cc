// FR-174 (03/09/2026): địa bàn mở — Sài Gòn (TP.HCM, phường mới) + Long An.
// Bóc QUẬN/HUYỆN từ một chuỗi ĐÃ BỎ DẤU (câu rao, địa chỉ). Trả về chuỗi ghi
// vào `listings.district` (hiển thị và geocode dùng thẳng), null nếu không thấy
// — người gọi tự quyết mặc định (chat-reply: "Quận 5", cụm khởi điểm).
//
// Tên quận/huyện theo địa giới CŨ (INS-12: dân vẫn gọi vậy); Long An ghi
// "<huyện>, Long An" để Nominatim tìm ra và người đọc hiểu ngay. Ưu tiên tên
// riêng trước số ("q4" trong "quận 4" thắng "P4" của phường — hai regex khác
// nhau nên không dẫm).
const QUAN_TEN: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bthu duc\b/, "TP Thủ Đức"],
  [/\btan binh\b/, "Quận Tân Bình"],
  [/\bbinh thanh\b/, "Quận Bình Thạnh"],
  [/\bphu nhuan\b/, "Quận Phú Nhuận"],
  [/\bgo vap\b/, "Quận Gò Vấp"],
  [/\btan phu\b/, "Quận Tân Phú"],
  [/\bbinh tan\b/, "Quận Bình Tân"],
  [/\bnha be\b/, "Huyện Nhà Bè"],
  [/\bbinh chanh\b/, "Huyện Bình Chánh"],
  [/\bhoc mon\b/, "Huyện Hóc Môn"],
  [/\bcu chi\b/, "Huyện Củ Chi"],
  [/\bcan gio\b/, "Huyện Cần Giờ"],
  // 10/09/2026: Bà Rịa – Vũng Tàu sáp nhập TP.HCM từ 07/2025; chân dung "căn hộ
  // nghỉ dưỡng Vũng Tàu" (chat Gemini 21/06 lượt 57–60) phải có địa bàn.
  [/\bvung tau\b/, "Vũng Tàu"],
  [/\bba ria\b/, "Bà Rịa"],
  [/\bphu my\b/, "Phú Mỹ"],
  [/\blong hai\b/, "Long Hải"],
  [/\bho tram\b/, "Hồ Tràm"],
  [/\bben luc\b/, "Bến Lức, Long An"],
  [/\bduc hoa\b/, "Đức Hoà, Long An"],
  [/\bcan giuoc\b/, "Cần Giuộc, Long An"],
  [/\bcan duoc\b/, "Cần Đước, Long An"],
  [/\btan an\b/, "Tân An, Long An"],
  [/\bthu thua\b/, "Thủ Thừa, Long An"],
  [/\btan tru\b/, "Tân Trụ, Long An"],
  [/\bduc hue\b/, "Đức Huệ, Long An"],
  [/\blong an\b/, "Long An"],
];
// "quận 4", "quan4", "q.4", "Q4" — không nhầm với "P4" (phường) hay "4 tỷ".
const QUAN_SO = /\bquan\s*\.?\s*(\d{1,2})\b|(?:^|[^a-z0-9])q\.?\s*(\d{1,2})(?![0-9])/;

// "quán 2 tầng" KHÔNG phải "quận 2". Bắt 10/09/2026 bằng kịch bản hành vi tầng
// ba: chủ nhà nhắn "nhà mở quán 2 tầng được nha em" → cột quận nhảy từ Quận 10
// sang Quận 2. Gọi hàm này bằng chuỗi ĐÃ BỎ DẤU nên nó không còn phân biệt được
// "quán" với "quận" — chữ thật thì phân biệt được, nên nhận thêm bản THÔ.
//
// Hai cửa chặn, vì bản thô không phải lúc nào cũng có dấu (dân nhắn Zalo hay gõ
// trần):
//   1. bản thô có "quán" ngay trước con số  → không phải quận;
//   2. sau con số là ĐƠN VỊ ĐẾM (tầng, lầu, phòng, m2, tỷ…) → đó là số lượng.
const QUAN_TRONG_THO = /qu[áàảãạăâ]n(?=[^\p{L}]{0,3}\d)/iu;
const SAU_SO_LA_DON_VI = /^\s*(tang|lau|tam|tret|phong|pn|wc|met|m2|m|ty|ti|toi|trieu|tr|nam|nguoi|cai|can|chiec)\b/;

export function bocQuan(kd: string, tho?: string): string | null {
  for (const [re, ten] of QUAN_TEN) if (re.test(kd)) return ten;
  if (tho && QUAN_TRONG_THO.test(tho)) return null;
  const m = QUAN_SO.exec(kd);
  if (m && SAU_SO_LA_DON_VI.test(kd.slice(m.index + m[0].length))) return null;
  if (m) {
    const n = parseInt(m[1] ?? m[2] ?? "", 10);
    if (n >= 1 && n <= 12) return `Quận ${n}`;
  }
  return null;
}
