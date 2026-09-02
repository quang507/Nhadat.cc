import { hashSeed } from "@/lib/geo";

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

// Nhãn loại BĐS (enum `property_type` của DB) — MỘT bảng cho thẻ tin, trang
// chi tiết và form admin; trước đây chép ba nơi, lệch một chữ là web nói hai
// giọng (FR-171 j).
export const TYPE_LABEL: Record<string, string> = {
  nha_pho: "Nhà phố",
  nha_cap4: "Nhà cấp 4",
  chung_cu: "Chung cư",
  dat: "Đất",
  biet_thu: "Biệt thự",
  phong_tro: "Phòng trọ",
  mat_bang: "Mặt bằng",
};

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
// raw.githubusercontent.com: chạy được chừng nào repo còn public, nhưng buộc
// ảnh của web phụ thuộc vào một thiết lập GitHub chẳng liên quan gì — set repo
// private một cái là raw trả 404 và ảnh vỡ sạch. Đường dẫn tương đối cắt hẳn
// ràng buộc đó, lại nhanh hơn (cùng origin, qua CDN của Vercel).
const IMG_BASE = "/img";
export function placeholderImg(seed: string): string {
  return `${IMG_BASE}/house${(hashSeed(seed) % 5) + 1}.jpg`;
}
