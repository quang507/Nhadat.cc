// boc-cau-rao.ts — đọc CÂU RAO lúc tạo tin (tầng tiền định: không model, không RPC).
//
// 14/09/2026 (bắn 14 tin rao bán): các luật dưới đây từng nằm rải trong chat-reply dưới
// dạng một dòng regex "chữ đầu tiên khớp là xong", và mỗi chỗ ghi SAI DB theo một kiểu:
//   · "bán nhà mặt tiền …, đang cho thuê 45 triệu/tháng, giá 32 tỷ" → tin CHO THUÊ giá
//     45 triệu (chữ "cho thuê" ở đâu cũng lật deal; con số tiền ĐẦU TIÊN là giá);
//   · "sang nhượng mặt bằng … thuê 60 triệu/tháng" → tin BÁN giá 60 triệu/tháng;
//   · "diện tích 62,5m²" → không có diện tích (chỉ biết "m2");
//   · "5x20, giá 95 triệu/m2" → không ra giá (chỉ nhân khi câu có "…m2");
//   · "phường Hiệp Bình Chánh" → không có phường (chỉ biết phường SỐ);
//   · "nhà phố quận 7 đường Huỳnh Tấn Phát" → gắn dự án "Căn Hộ Cao Cấp Huỳnh Tấn Phát".
import { TIEN_CD, TIEN_T_KEP } from "./luat-tien.ts";

const boDau = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

// "sang nhượng MẶT BẰNG / quán" là thuê lại chỗ kinh doanh; "sang nhượng CĂN HỘ … HĐMB, giá 5
// tỷ" là BÁN (e2e T42-02) — nên "sang nhượng" chỉ tính thuê khi đi với chỗ kinh doanh.
const VIEC_THUE = /\b(?:cho thue|cho muon)\b|\b(?:sang nhuong|sang lai|nhuong lai|sang)\s+(?:lai\s+)?(?:mat bang|mb|quan|shop|kiot|ki ot|cua hang|tiem|spa)\b/;
const VIEC_BAN = /\b(?:ban|can ban|de lai|nhuong lai nha|thanh ly)\b/;
// "đang cho thuê 45 triệu", "hiện đang cho thuê", "có hợp đồng thuê" — THU NHẬP của căn bán.
const THU_NHAP_THUE = /\b(?:dang|hien|hien dang|co hop dong|hop dong|dang co khach)\s+(?:cho\s+)?thue\b/;

/** Câu rao là BÁN hay CHO THUÊ. Chuỗi vào đã bỏ dấu. */
export function dealCauRao(kd: string): "ban" | "cho_thue" {
  const thue = VIEC_THUE.exec(kd);
  if (!thue) return "ban";
  const ban = VIEC_BAN.exec(kd);
  if (!ban) return "cho_thue";
  // Có cả hai: căn đang cho thuê mà chủ BÁN, hoặc chữ "bán" đứng trước chữ "cho thuê".
  if (THU_NHAP_THUE.test(kd) || ban.index < thue.index) return "ban";
  return "cho_thue";
}

// Tiền KHÔNG phải giá rao: cọc, phí sang, hoa hồng, lương, doanh thu. 14/09 (đo bóng): có ranh giới
// từ — bản trước khớp "no" trong "nói" và "luong" trong "thương lượng", bỏ mất giá thật.
export const TRUOC_KHONG_PHAI_GIA = /\b(?:coc|dat coc|phi sang|tien sang|hoa hong|phi moi gioi|(?<!thuong )luong|doanh thu|thu nhap|tra truoc|vay)\b(?:\s+\d{1,2}\s*(?:thang|th))?\s*[^\d,;]{0,12}$/;
const TRUOC_LA_GIA = /(?:gia|tong|chot|ban|con|chi|muon ban)\s*(?:ban|chot|chao|mong muon|tong|thue|cho thue)?\s*:?\s*$/;
export const TRUOC_LA_THUE = /(?:dang|hien|hien dang|hop dong)\s+(?:cho\s+)?thue\s*(?:duoc|voi gia|gia|:)?\s*$/;

/**
 * Chọn đoạn GIÁ trong câu rao (còn dấu, số bằng chữ đã đổi ra chữ số). Trả đúng đoạn
 * chữ người gõ để `price_raw` giữ nguyên văn. Luật: bỏ tiền cọc / phí / hoa hồng; tin
 * BÁN thì bỏ tiền thuê đang thu ("đang cho thuê 45 triệu"); còn lại ưu tiên số đứng sau
 * chữ "giá / tổng / chốt", không có thì số đầu tiên.
 */
/**
 * Đuôi của cụm giá trong câu rao: giữ phần lẻ ("5 tỷ 8", "5 tỷ thương lượng") nhưng
 * dừng TRƯỚC một cụm số+m2 và trước chữ của thứ KHÁC (pháp lý, hẻm, thanh khoản…).
 * 15/09/2026 (bắn thật B1): "gia 6ty2 shr thanh khoan nhanh ko ban" → price_raw mang
 * nguyên đuôi rác lên web. Một nguồn cho chat-reply và bài kiểm.
 */
export const DUOI_GIA =
  "(?:(?!\\s*\\d+(?:[.,]\\d+)?\\s*m2)(?!\\s+(?:shr|shc|sổ|so\\b|thổ|tho\\b|hẻm|hem\\b|hxh|mặt tiền|mat tien|thanh khoản|thanh khoan|pháp lý|phap ly|dt\\b|diện tích|dien tich|ngang|dài|dai\\b|hướng|huong\\b|full|nội thất|noi that|\\d+\\s*x\\s*\\d+)(?![\\p{L}]))[^,.;\\n])*";

export function chonGiaRao(text: string, deal: "ban" | "cho_thue", duoi: string = DUOI_GIA): string | null {
  const re = new RegExp(`((?:[\\d][\\d.,]*\\s*(?:${TIEN_CD})|${TIEN_T_KEP})${duoi})`, "giu");
  const kd = boDau(text);
  const ung: Array<{ s: string; uuTien: boolean }> = [];
  for (const m of text.matchAll(re)) {
    const truoc = kd.slice(Math.max(0, m.index! - 30), m.index!);
    const sau = kd.slice(m.index! + m[0].length, m.index! + m[0].length + 12);
    if (TRUOC_KHONG_PHAI_GIA.test(truoc)) continue;
    const moiThang = /^\s*(?:\/|mot|1|moi)?\s*(?:thang|th)\b/.test(sau) || /\/\s*(?:thang|th)\b/.test(boDau(m[0]));
    if (deal === "ban" && (TRUOC_LA_THUE.test(truoc) || moiThang)) continue;
    ung.push({ s: m[1], uuTien: TRUOC_LA_GIA.test(truoc) });
  }
  return (ung.find((u) => u.uuTien) ?? ung[0])?.s ?? null;
}

/** Diện tích trong câu rao (đã bỏ dấu): "62,5m²", "70m2" → số; không có thì null. */
export function dienTichCauRao(kd: string): number | null {
  const m = /(\d{1,5}(?:[.,]\d+)?)\s*m(?:2|²)(?![\d])/.exec(kd);
  return m ? Number(m[1].replace(",", ".")) : null;
}

/** "5x20", "4.2m x 18m" → ngang × dài (m²); null nếu không có. Chỉ để NHÂN giá/m². */
export function ngangNhanDai(kd: string): number | null {
  const m = /(\d{1,2}(?:[.,]\d+)?)\s*m?\s*x\s*(\d{1,3}(?:[.,]\d+)?)\s*m?(?![\d²])/.exec(kd);
  if (!m) return null;
  const a = Number(m[1].replace(",", ".")), b = Number(m[2].replace(",", "."));
  return a >= 1.5 && a <= 40 && b >= 3 && b <= 150 ? Math.round(a * b * 10) / 10 : null;
}

/**
 * Phường TÊN CHỮ trong câu rao còn dấu: "phường Hiệp Bình Chánh TP Thủ Đức" → "Phường
 * Hiệp Bình Chánh". Chỉ nhận chữ VIẾT HOA đầu (tên riêng), tối đa 4 tiếng, dừng ở
 * TP / quận / dấu câu. Phường số thì chat-reply đã có `soPhuong`.
 */
export function phuongTenCauRao(text: string): string | null {
  const m = /(?:^|[\s,(])(?:[Pp]hường|PHƯỜNG|[Pp]\.)\s+(\p{Lu}\p{Ll}*(?![\p{L}])(?:\s+\p{Lu}\p{Ll}*(?![\p{L}])){0,3})/u.exec(text);
  if (!m) return null;
  const tu = m[1].split(/\s+/);
  const dung = tu.findIndex((w) => /^(TP|Tp|Thành|Quận|Q|Huyện|Thị|Tỉnh)$/u.test(w));
  const ten = (dung >= 0 ? tu.slice(0, dung) : tu).join(" ");
  return ten.length >= 3 ? `Phường ${ten}` : null;
}

const CHU_CHUNG_DU_AN = /^(?:(?:khu\s+)?can ho|chung cu|cao cap|khu dan cu|kdc|du an|toa nha|khu do thi|kdt|the|so|nha pho|biet thu|shophouse)\s+/;

/**
 * Tên dự án khớp được CHỈ vì trùng TÊN ĐƯỜNG trong câu: "nhà phố quận 7 đường Huỳnh
 * Tấn Phát" khớp "Căn Hộ Cao Cấp Huỳnh Tấn Phát" → không phải dự án. Câu có chữ dự
 * án / chung cư / căn hộ thì để nguyên kết quả khớp.
 */
export function duAnLaTenDuong(tenDuAn: string | null | undefined, text: string): boolean {
  if (!tenDuAn) return false;
  const kd = boDau(text);
  if (/\b(?:du an|chung cu|can ho|toa|block|kdc|khu dan cu|khu do thi)\b/.test(kd)) return false;
  let loi = boDau(tenDuAn).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 4 && CHU_CHUNG_DU_AN.test(loi); i++) loi = loi.replace(CHU_CHUNG_DU_AN, "");
  if (loi.length < 5) return false;
  return new RegExp(`\\b(?:duong|hem|hxh|mat tien|mt|pho)\\s+(?:\\d+[a-z]?(?:\\/\\d+)*\\s+)?${loi.replace(/ /g, "\\s+")}\\b`).test(kd);
}
