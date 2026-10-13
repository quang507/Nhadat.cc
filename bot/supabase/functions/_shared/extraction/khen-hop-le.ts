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
