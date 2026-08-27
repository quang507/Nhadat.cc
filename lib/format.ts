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

/**
 * Nhãn tiếng Việt cho khoá `listing_facts.question` (FR-165).
 *
 * Khối "Đã xác minh với chủ nhà" trên trang tin trước đây in THẲNG khoá DB ra
 * màn hình: khách đọc được "do_rong_hem", "phap_ly", "dien_tich_tim_tuong".
 * Đó là tên cột rò ra mặt tiền — vừa khó đọc, vừa lộ cấu trúc dữ liệu, lại đi
 * ngược tone giọng "nói tiếng người" của docs/06.
 *
 * CỐ Ý KHÔNG dùng chung `FACT_LABELS` bên bot: bản của bot là câu HỎI, dài và
 * có ngoặc giải thích ("pháp lý (sổ hồng/sổ đỏ, hoàn công)") vì nó đi vào
 * prompt. Bản này là nhãn trên bảng thông số, phải ngắn.
 *
 * Danh sách khớp `required_facts.fact_key` (23 khoá, kiểm 27/08/2026). Thêm
 * khoá mới bên DB thì thêm ở đây; thiếu thì rơi về chính khoá đó, xấu nhưng
 * không vỡ trang.
 */
export const FACT_LABEL: Record<string, string> = {
  dien_tich: "Diện tích",
  dien_tich_dat: "Diện tích đất",
  dien_tich_tim_tuong: "Diện tích tim tường",
  do_rong_duong: "Đường trước đất",
  do_rong_hem: "Hẻm trước nhà",
  gia_dien_nuoc: "Giá điện nước",
  gio_giac: "Giờ giấc ra vào",
  hien_trang: "Hiện trạng",
  hinh_anh: "Hình ảnh",
  huong: "Hướng",
  ket_cau: "Kết cấu",
  loai_bds: "Loại hình",
  mat_tien: "Mặt tiền",
  nam_xay: "Năm xây",
  nganh_hang_phu_hop: "Ngành hàng phù hợp",
  noi_that: "Nội thất",
  phap_ly: "Pháp lý",
  phi_quan_ly: "Phí quản lý",
  quy_hoach: "Quy hoạch",
  san_vuon: "Sân vườn",
  so_phong_ngu: "Số phòng ngủ",
  tang: "Tầng",
  tho_cu: "Thổ cư",
  thoi_han_thue: "Thời hạn thuê",
};

/** Nhãn hiển thị của một fact; chưa khai thì trả về chính khoá. */
export function factLabel(key: string): string {
  return FACT_LABEL[key] ?? key;
}

/**
 * Thoát HTML cho những chỗ BUỘC phải dựng chuỗi HTML bằng tay.
 *
 * React tự thoát mọi thứ nhét vào JSX, nên gần như cả web không cần hàm này.
 * Ngoại lệ là popup Leaflet: `marker.bindPopup()` nhận một chuỗi HTML thô và
 * nhét thẳng vào DOM. Mọi giá trị đi vào đó đều là dữ liệu người khác gõ —
 * `price_raw` và `location_raw` chính là câu chính chủ nhắn qua Zalo, chưa qua
 * bất kỳ bộ lọc nào — nên phải tự thoát.
 *
 * Đừng dùng hàm này cho JSX: React đã thoát rồi, thoát hai lần thì khách đọc
 * được "9 tỉ &amp; bớt lộc" trên màn hình.
 */
export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
// raw.githubusercontent.com: chạy được chừng nào repo còn public, nhưng buộc
// ảnh của web phụ thuộc vào một thiết lập GitHub chẳng liên quan gì — set repo
// private một cái là raw trả 404 và ảnh vỡ sạch. Đường dẫn tương đối cắt hẳn
// ràng buộc đó, lại nhanh hơn (cùng origin, qua CDN của Vercel).
const IMG_BASE = "/img";
export function placeholderImg(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `${IMG_BASE}/house${(h % 5) + 1}.jpg`;
}
