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

// 11/09/2026 (lượt bắn 42 ca): "bán nhà ở Hà Nội quận Cầu Giấy 50m2 9 tỷ" →
// `bocQuan` trả null → chat-reply mặc định "Quận 5" → căn Hà Nội vào rổ Quận 5
// với mã BDS-NP-Q5-…. Nay nhận ra hai loại địa bàn mà `bocQuan` không biết:
//   · XA (ngoài hẳn vùng phục vụ): bot nói thật là chưa nhận, KHÔNG mở tin.
//   · LÂN CẬN: vẫn nhận, nhưng quận ghi đúng tên tỉnh, không bao giờ là Quận 5.
// Chuỗi vào ĐÃ BỎ DẤU. Chỉ gọi khi `bocQuan` đã trả null.
const VUNG_XA: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bha noi\b|\b(?:cau giay|dong da|ba dinh|hoan kiem|hai ba trung|thanh xuan|long bien|tay ho|tu liem|ha dong)\b/, "Hà Nội"],
  [/\bhai phong\b/, "Hải Phòng"],
  [/\bda nang\b|\bhoi an\b/, "Đà Nẵng"],
  [/\bthua thien hue\b|\btp hue\b|\bthanh pho hue\b/, "Huế"],
  [/\bnha trang\b|\bkhanh hoa\b|\bcam ranh\b/, "Khánh Hoà"],
  [/\bda lat\b|\blam dong\b|\bbao loc\b/, "Lâm Đồng"],
  [/\bcan tho\b/, "Cần Thơ"],
  [/\bquang ninh\b|\bha long\b/, "Quảng Ninh"],
  [/\bphu quoc\b|\bkien giang\b|\brach gia\b/, "Kiên Giang"],
  [/\bquy nhon\b|\bbinh dinh\b/, "Bình Định"],
  [/\bphan thiet\b|\bbinh thuan\b|\bmui ne\b/, "Bình Thuận"],
  [/\bbuon ma thuot\b|\bdak lak\b/, "Đắk Lắk"],
  [/\bnghe an\b|\bthanh hoa\b|\bquang nam\b|\bquang ngai\b/, "miền Trung / miền Bắc"],
];
const VUNG_LAN_CAN: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bbinh duong\b|\bthu dau mot\b|\bdi an\b|\bthuan an\b|\bben cat\b/, "Bình Dương"],
  [/\bdong nai\b|\bbien hoa\b|\bnhon trach\b|\blong thanh\b/, "Đồng Nai"],
  [/\btay ninh\b/, "Tây Ninh"],
  [/\btien giang\b|\bmy tho\b/, "Tiền Giang"],
  [/\bben tre\b/, "Bến Tre"],
];

/** Tên vùng ngoài danh sách `bocQuan` mà câu nhắc tới; `xa` = ngoài vùng phục vụ. */
export function vungNgoai(kd: string): { ten: string; xa: boolean } | null {
  for (const [re, ten] of VUNG_XA) if (re.test(kd)) return { ten, xa: true };
  for (const [re, ten] of VUNG_LAN_CAN) if (re.test(kd)) return { ten, xa: false };
  return null;
}

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
