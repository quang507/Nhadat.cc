// Ẩn danh hai chiều (FR-104): web không bao giờ lộ SĐT/Zalo trong mô tả gốc.
const PHONE_RE = /(\+?84|0)[\s.\-]?(\d[\s.\-]?){8,10}/g;
const SOCIAL_RE = /\b(zalo|z@lo|fb|facebook|viber|telegram)\b\s*:?\s*[\w.@/]*/gi;

export function sanitizeDescription(text: string | null): string {
  if (!text) return "";
  return text
    .replace(PHONE_RE, " [liên hệ qua Zalo nhadat.cc] ")
    .replace(SOCIAL_RE, " [liên hệ qua Zalo nhadat.cc] ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function formatPrice(priceVnd: number | null, priceRaw: string | null): string {
  if (priceVnd && priceVnd > 0) {
    const ty = priceVnd / 1_000_000_000;
    if (ty >= 1) {
      return `${ty.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`;
    }
    return `${Math.round(priceVnd / 1_000_000)} triệu`;
  }
  return priceRaw?.trim() || "Thương lượng";
}

export function formatArea(m2: number | null): string {
  return m2 ? `${Number(m2).toLocaleString("vi-VN")} m²` : "—";
}

// Deep-link Zalo mang ngữ cảnh (FR-13/14). Đang chạy acc CLONE trong lúc chờ
// OA duyệt: đặt NEXT_PUBLIC_ZALO_URL=https://zalo.me/<SĐT acc clone> trong env
// Vercel (hoặc sửa fallback dưới); OA duyệt xong đổi về link OA.
export const ZALO_OA_URL =
  process.env.NEXT_PUBLIC_ZALO_URL ?? "https://zalo.me/nhadatcc";
export function zaloLink(context?: string): string {
  return context ? `${ZALO_OA_URL}?ref=${encodeURIComponent(context)}` : ZALO_OA_URL;
}

// Ảnh placeholder xoay vòng theo mã tin (ảnh thật nằm OneDrive, chờ pipeline OPEN-18).
// Serve TỪ CHÍNH SITE (`public/img/` được Next.js phục vụ ở gốc). Bản cũ trỏ
// raw.githubusercontent.com — repo chuyển sang private ngày 26/08 là raw trả
// 404, tức MỌI ảnh trên web vỡ hết. Đường dẫn tương đối vừa miễn nhiễm chuyện
// đó vừa nhanh hơn (cùng origin, qua CDN của Vercel).
const IMG_BASE = "/img";
export function placeholderImg(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `${IMG_BASE}/house${(h % 5) + 1}.jpg`;
}
