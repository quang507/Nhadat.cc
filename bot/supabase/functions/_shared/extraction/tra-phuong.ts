// tra-phuong.ts — FR-209 (15/09/2026): tra PHƯỜNG MỚI từ TÊN ĐƯỜNG qua Nominatim.
//
// Chủ dự án 15/09 (Zalo thật): "căn hộ 5 tầng… đường Lê Văn Việt mới làm lại… số
// nhà tôi là số 449" → bot đáp "Quận 5 (chưa rõ quận)" rồi hỏi "phường mấy" —
// "nếu có địa chỉ và tên đường rồi thì tự search phường quận được không chứ".
//
// Nominatim (OSM) sau 07/2025 trả PHƯỜNG MỚI (`address.suburb = "Phường Tăng
// Nhơn Phú"`) mà KHÔNG có quận — OSM đã bỏ ranh giới quận. Quận cũ lấy từ bảng
// `wards` (NQ 1685/NQ-UBTVQH15). Chủ dự án chốt OPEN-27 nửa sau cùng ngày: LƯU
// TÊN PHƯỜNG MỚI "cho nó dùng được Nominatim"; bot HỎI XÁC NHẬN trước khi ghi.
//
// File này THUẦN (không fetch, không RPC — bot/tests/ranh-gioi.mjs canh): dựng
// URL, đọc JSON Nominatim, soạn câu hỏi xác nhận. Gọi mạng nằm ở chat-reply.

export type PhuongNominatim = { ten: string; loai: "phuong" | "xa" | "dac_khu"; ten_day_du: string };

const boDau = (s: string): string =>
  s.normalize("NFC").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");

/** Bỏ chữ "đường/phố" đứng đầu: "đường Lê Văn Việt" → "Lê Văn Việt" (Nominatim tra tên trần chắc hơn). */
export function chuanTenDuong(duong: string | null | undefined): string {
  return (duong ?? "").replace(/^\s*(?:đường|duong|phố|pho|đ\.)\s+(?!(?:số|so)?\s*\d)/iu, "").replace(/\s+/g, " ").trim();
}

/** Tên đường đủ để tra: có ≥ 2 chữ cái, không phải "đường số 7" (trùng khắp thành phố). */
export function duongTraDuoc(duong: string | null | undefined): boolean {
  const d = chuanTenDuong(duong);
  if (!/[\p{L}]{2}/u.test(d)) return false;
  return !/^(?:đường|duong)?\s*(?:số|so)?\s*\d+[a-z]?$/i.test(d);
}

/**
 * URL tra Nominatim cho một tên đường ở TP.HCM. Ghim `countrycodes=vn`, xin
 * `addressdetails=1` để đọc `address.suburb`; `limit=1` — đường dài đi qua nhiều
 * phường thì Nominatim trả đoạn "quan trọng" nhất, câu hỏi xác nhận đỡ cho phần
 * còn lại (chủ nhà gật hay sửa).
 */
export function urlTraPhuong(duong: string): string {
  const q = `${chuanTenDuong(duong)}, Thành phố Hồ Chí Minh`;
  return `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=vn&q=${encodeURIComponent(q)}`;
}

// Tiền tố + tên, ở BẤT KỲ đâu trong câu: "không, phường long trường" (câu sửa của chủ
// nhà) cũng phải ra "long trường". Tên dừng ở dấu câu; "phường nào/mấy" không phải tên.
// `\b` của JS không hiểu chữ có dấu ("gì", "đó") → dùng (?![\p{L}]).
const TIEN_TO_RE = /(?:^|[\s,.;:!?(])(phường|phuong|xã|xa|đặc khu|dac khu)\s+(?!(?:nào|nao|mấy|may|gì|gi|đó|do|này|nay)(?![\p{L}]))([^,.;:!?\n()]{1,40})/iu;
// Câu CÓ DẤU thì chỉ nhận tiền tố có dấu: "nhà xa trung tâm", "phương án" không phải xã/phường.
// Dạng không dấu ("phuong tan dinh", "xa cu chi") chỉ dành cho người gõ trần cả câu.
const TIEN_TO_CO_DAU_RE = /(?:^|[\s,.;:!?(])(phường|xã|đặc khu)\s+(?!(?:nào|mấy|gì|đó|này)(?![\p{L}]))([^,.;:!?\n()]{1,40})/iu;
const CO_DAU_RE = /[\u0300-\u036f]|đ/i;

/** "Phường Tăng Nhơn Phú" → { ten: "Tăng Nhơn Phú", loai: "phuong" }; không tiền tố → null. */
export function tachTienToPhuong(s: string | null | undefined): PhuongNominatim | null {
  const goc = (s ?? "").trim();
  const coDau = CO_DAU_RE.test(goc.normalize("NFD"));
  const m = (coDau ? TIEN_TO_CO_DAU_RE : TIEN_TO_RE).exec(goc);
  if (!m) return null;
  const tt = boDau(m[1]).toLowerCase();
  const loai = tt === "phuong" ? "phuong" : tt === "xa" ? "xa" : "dac_khu";
  // 15/09/2026 (bắn thử 07:21 UTC): "xã Tân Kiên đó em" → cột phường ghi nguyên "xã Tân
  // Kiên đó em". Chữ đệm cuối câu (đó/nha/ạ/em/anh/chị…) không phải tên — cắt đi.
  const ten = m[2].replace(/\s+/g, " ").trim()
  // Chỉ chữ đệm CÓ DẤU hoặc không thể là tên: "chi"/"a"/"do" không dấu thì để yên ("Xã Củ Chi").
    .replace(/(?:\s+(?:đó|đấy|đây|nha|nhé|nhe|nhen|hen|ạ|á|em|anh|chị|ơi|luôn|rồi|nè|đúng không|phải không))+$/iu, "");
  // Tên phường mới là CHỮ ("Tăng Nhơn Phú"); có số ("8 quận 5") là phường cũ đánh số → đường chuan_hoa_phuong.
  if (!/[\p{L}]{2}/u.test(ten) || /\d/.test(ten)) return null;
  const tienTo = loai === "phuong" ? "Phường" : loai === "xa" ? "Xã" : "Đặc khu";
  return { ten, loai, ten_day_du: `${tienTo} ${ten}` };
}

/**
 * Đọc phường từ JSON Nominatim (mảng kết quả jsonv2). Chỉ nhận khi kết quả nằm
 * trong TP.HCM (address.city / state có "Hồ Chí Minh") và là đường/địa điểm chứ
 * không phải cả thành phố; ô phường có thể nằm ở suburb / quarter / city_district
 * / town / village tuỳ cách OSM gắn thẻ.
 */
export function docPhuongNominatim(json: unknown): PhuongNominatim | null {
  if (!Array.isArray(json) || !json.length) return null;
  const r = json[0] as Record<string, unknown>;
  const addr = (r.address ?? {}) as Record<string, unknown>;
  const tp = boDau(String(addr.city ?? addr.state ?? addr.province ?? "")).toLowerCase();
  if (!/ho chi minh/.test(tp)) return null;
  if (/^(city|state|province|country|municipality|region)$/.test(String(r.addresstype ?? r.type ?? ""))) return null;
  for (const k of ["suburb", "quarter", "city_district", "town", "village", "neighbourhood"]) {
    const p = tachTienToPhuong(typeof addr[k] === "string" ? (addr[k] as string) : null);
    if (p) return p;
  }
  return null;
}

/** Câu hỏi xác nhận trước khi ghi (chủ dự án 15/09: "bot hỏi xác nhận trước khi ghi"). */
export function cauXacNhanPhuong(mau: string, cachGoi: string, duong: string, tenDayDu: string, quanCu: string): string {
  const Ac = cachGoi.charAt(0).toUpperCase() + cachGoi.slice(1);
  return mau
    .replace(/\{ac\}/g, cachGoi).replace(/\{Ac\}/g, Ac)
    .replace(/\{duong\}/g, duong.trim()).replace(/\{phuong\}/g, tenDayDu).replace(/\{quan\}/g, quanCu);
}
