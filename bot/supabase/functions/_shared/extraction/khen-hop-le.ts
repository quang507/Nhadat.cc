// khen-hop-le.ts — kiểm TẤT ĐỊNH câu khen AI viết dưới bản nháp (SRS-5.1zzzzzl). Tách khỏi `ai/khen-nhap.ts` để kiểm offline không
// cần SDK (luật `bot/tests/ranh-gioi.mjs`: tầng bóc tách không import AI).
import { trichCoTrongTin } from "./kiem-bang-chung.ts";

/**
 * Kiểm tất định câu khen: một câu (≤ 200 ký tự, không xuống dòng, không "?"), có ít nhất một cụm dựa vào và MỌI cụm chép nguyên văn từ
 * bản tin, mọi con số trong câu có trong bản tin. Không qua → null (bản nháp không có câu khen).
 */
export function khenHopLe(khen: string | null | undefined, duaTren: string[], banTin: string): string | null {
  const k = (khen ?? "").replace(/\s+/g, " ").trim();
  if (k.length < 10 || k.length > 200 || /[?\n]/.test(khen ?? "") || /—/.test(k)) return null;
  const cum = (duaTren ?? []).map((x) => (x ?? "").trim()).filter(Boolean);
  if (!cum.length || cum.some((x) => !trichCoTrongTin(x, banTin))) return null;
  const soTin = new Set((banTin.match(/\d+(?:[.,]\d+)?/g) ?? []).map((s) => s.replace(",", ".")));
  if ((k.match(/\d+(?:[.,]\d+)?/g) ?? []).some((s) => !soTin.has(s.replace(",", ".")))) return null;
  return k;
}

/**
 * SRS-5.1zzzzzn: lời nhận ảnh giấy tờ model viết (`phan-loai-anh.ts` `loi_nhan`). Qua khi: 10–220 ký tự, không "?" (lời báo, không hỏi), không
 * gạch dài, mọi con số trong lời là diện tích đọc trên giấy hoặc diện tích đang ghi (không số nào khác — chặn lộ số thửa / số tờ / số giấy tờ).
 * Không qua → null (nơi gọi dùng câu soạn sẵn).
 */
export function loiNhanGiayToHopLe(loi: string | null | undefined, soM2: number | null | undefined, dangGhiM2: number | null | undefined): string | null {
  const k = (loi ?? "").replace(/\s+/g, " ").trim();
  if (k.length < 10 || k.length > 220 || /\?/.test(k) || /—/.test(k)) return null;
  const choPhep = new Set([soM2, dangGhiM2].filter((x): x is number => typeof x === "number" && x > 0).map((x) => String(x)));
  // "132m2" — chữ số 2 của đơn vị không phải con số.
  const so = (k.replace(/(\d)\s*m2(?![\p{L}\d])/giu, "$1m²").match(/\d+(?:[.,]\d+)?/g) ?? []).map((s) => String(Number(s.replace(",", "."))));
  if (so.some((s) => !choPhep.has(s))) return null;
  return k;
}
