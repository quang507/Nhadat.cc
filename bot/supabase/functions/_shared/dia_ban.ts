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

export function bocQuan(kd: string): string | null {
  for (const [re, ten] of QUAN_TEN) if (re.test(kd)) return ten;
  const m = QUAN_SO.exec(kd);
  if (m) {
    const n = parseInt(m[1] ?? m[2] ?? "", 10);
    if (n >= 1 && n <= 12) return `Quận ${n}`;
  }
  return null;
}
