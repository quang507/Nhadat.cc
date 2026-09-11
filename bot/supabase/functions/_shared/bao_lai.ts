// Báo lại cho người bán ĐÚNG thứ đang nằm trong DB — chủ dự án 11/09/2026
// (giai đoạn test): "chat một câu là nhắn đã thu thập được gì trong Supabase".
//
// Vì sao không dùng lại bong bóng "📝 Em ghi nhận": bong bóng đó ghép từ CHỮ
// khách vừa gõ (regex tầng TS), còn cột thật do trigger `listing_facts_sync_cols`
// đọc lại bằng regex tầng SQL — hai tầng đọc số khác nhau. Khách gõ "6x11" thì
// 📝 có thể nói 66m2 trong khi cột lưu 6 (đoạn chat Zalo 08/09). Bong bóng 💾
// ĐỌC LẠI dòng tin từ DB SAU KHI mọi nhánh đã ghi xong, nên nó nói đúng cái web
// sẽ hiện — và ở chế độ đầy đủ in cả câu trả lời gốc cạnh cột để soi chỗ lệch.
//
// Công tắc `app_config.bao_lai_da_luu` (đọc mỗi lượt, không nhớ tạm — đổi là
// có hiệu lực lượt kế, không cần deploy):
//   tat      — mặc định khi chưa có dòng. Không báo gì.
//   thay_doi — chỉ báo khi dữ liệu KHÁC lần báo trước; gắn vào cuối bong bóng
//              cuối, KHÔNG đẻ thêm bong bóng (luật tối đa 2 bong bóng), không
//              in mã tin (luật cấm đọc mã cho khách). Dùng được với khách thật.
//   day_du   — lượt nào cũng báo, bong bóng riêng, kèm mã tin, trạng thái và
//              câu trả lời gốc từng khoá. CHỈ cho giai đoạn test.
//
// Hàm ở đây THUẦN (không gọi DB) để kiểm được bằng node; phần đọc DB nằm ở
// `baoLaiDaLuu` trong chat-reply.

import { SPEC_COLS, thongSoNgan, type SpecRow } from "./thong_so.ts";

export type CheDoBaoLai = "tat" | "thay_doi" | "day_du";

/** Dấu mở bong bóng báo lại. Cố ý khác 📋 (tiêu đề bản nháp) và 📝 (ghi nhận lúc rao). */
export const DAU_BAO_LAI = "💾";

export const COT_BAO_LAI =
  `id, code, property_type, deal, status, location_raw, ward, district, area_m2, price_raw, price_vnd, bedrooms, ${SPEC_COLS}`;

export type DongBaoLai = SpecRow & {
  id?: string;
  code?: string | null;
  property_type?: string | null;
  deal?: string | null;
  status?: string | null;
  location_raw?: string | null;
  ward?: string | null;
  district?: string | null;
  area_m2?: number | string | null;
  price_raw?: string | null;
  price_vnd?: number | string | null;
  bedrooms?: number | null;
};

export type FactBaoLai = { question: string; answer: string | null; created_at?: string | null };

/** Giá trị lạ, rỗng, NULL → tắt. Thà im còn hơn bật nhầm cho khách thật. */
export function docCheDo(v: unknown): CheDoBaoLai {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "day_du" || s === "thay_doi" ? s : "tat";
}

const LOAI: Record<string, string> = {
  nha_pho: "Nhà phố", nha_cap4: "Nhà cấp 4", chung_cu: "Căn hộ", dat: "Đất",
  biet_thu: "Biệt thự", phong_tro: "Phòng trọ", mat_bang: "Mặt bằng",
  toa_nha: "Toà nhà / CHDV", dat_nong_nghiep: "Đất nông nghiệp",
  dat_kinh_doanh: "Đất kinh doanh", kho_xuong: "Kho xưởng",
};

const TRANG_THAI: Record<string, string> = {
  cho_thong_tin: "chưa đăng", dang_ban: "đang rao", dang_quan_tam: "đang rao",
  da_chot: "đã chốt", an: "đã gỡ",
};

// Câu chờ và ảnh không phải thông số: ảnh là URL kho, ba khoá kia là lượt duyệt/chấm/hẹn.
const BO_QUA = new Set(["hinh_anh", "duyet_tin", "danh_gia", "xac_nhan_lich", "con_ban"]);

// Khoá fact có thật trong DB mà FACT_LABELS (prompts.ts) chưa có nhãn — thấy khi
// chạy thử trên 7 tin thật 11/09: "du_an_ten" hiện nguyên tên khoá. Khoá lạ khác
// thì đổi "_" thành khoảng trắng, còn hơn in mã.
const NHAN_THEM: Record<string, string> = {
  du_an_ten: "tên dự án",
};

const boDau = (s: string): string =>
  s.toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[̀-ͯ]/g, "");

// "12 Trần Hưng Đạo, Phường 4" — bỏ mảnh trùng (location_raw hay đã chứa phường/quận).
function gonDiaChi(...manh: Array<string | null | undefined>): string {
  const ra: string[] = [];
  for (const m of manh) {
    for (const p of (m ?? "").split(",")) {
      const s = p.trim();
      if (s && !ra.some((x) => boDau(x) === boDau(s))) ra.push(s);
    }
  }
  return ra.join(", ");
}

// numeric của PostgREST có thể về dạng chuỗi "66.00" — in gọn thành "66".
const so = (x: number | string): string => String(Number(x));

/**
 * Một bong bóng mô tả dòng tin ĐANG nằm trong DB, hoặc null khi tắt.
 * `facts` phải xếp MỚI NHẤT trước (lấy câu trả lời mới nhất mỗi khoá).
 */
export function tomTatDaLuu(
  l: DongBaoLai | null,
  facts: FactBaoLai[],
  nhan: Record<string, string>,
  cheDo: CheDoBaoLai,
): string | null {
  if (cheDo === "tat") return null;
  if (!l) return `${DAU_BAO_LAI} Chưa có tin nào được lưu.`;

  const p: string[] = [];
  p.push(`${LOAI[l.property_type ?? ""] ?? "BĐS"} ${l.deal === "cho_thue" ? "cho thuê" : "bán"}`);
  const dc = gonDiaChi(l.location_raw, l.ward, l.district);
  if (dc) p.push(dc);
  if (l.area_m2 !== null && l.area_m2 !== undefined && l.area_m2 !== "") p.push(`${so(l.area_m2)}m²`);
  const ts = thongSoNgan(l).replace(/^ · /, "");
  if (ts) p.push(ts);
  if (l.bedrooms) p.push(`${l.bedrooms} phòng ngủ`);
  // Có chữ giá mà không ra số = parse_vnd không đọc được → web lọc giá sẽ không thấy tin.
  if (l.price_raw) p.push(l.price_vnd ? `giá ${l.price_raw}` : `giá "${l.price_raw}" (chưa đọc ra số)`);

  if (cheDo === "thay_doi") return `${DAU_BAO_LAI} Đã lưu: ${p.join(" · ")}`;

  const tt = TRANG_THAI[l.status ?? ""];
  const dau = `${DAU_BAO_LAI} Đã lưu${l.code ? ` tin ${l.code}` : ""}${tt ? ` (${tt})` : ""}: ${p.join(" · ")}`;

  const moiNhat = new Map<string, string>();
  for (const f of facts) {
    const a = (f.answer ?? "").replace(/\s+/g, " ").trim();
    if (!a || BO_QUA.has(f.question) || moiNhat.has(f.question)) continue;
    moiNhat.set(f.question, a);
  }
  if (!moiNhat.size) return dau;
  const tho = [...moiNhat].slice(0, 10).map(([k, v]) => {
    const ten = (nhan[k] ?? NHAN_THEM[k] ?? k.replace(/_/g, " ")).replace(/\s*\(.*\)\s*$/, "");
    return `${ten}: "${v.length > 40 ? v.slice(0, 39) + "…" : v}"`;
  });
  return `${dau}\nCâu trả lời gốc: ${tho.join(" · ")}`;
}

/** Phần 💾 trong một câu bot đã lưu (bong bóng riêng hoặc dòng gắn cuối), không có thì null. */
export function layBaoLai(body: string | null | undefined): string | null {
  if (!body) return null;
  if (body.startsWith(DAU_BAO_LAI)) return body;
  const i = body.indexOf(`\n${DAU_BAO_LAI}`);
  return i >= 0 ? body.slice(i + 1) : null;
}

/** Câu bot sau khi bỏ phần 💾 — lịch sử gửi model không được thấy bảng báo lại. */
export function boBaoLai(body: string | null | undefined): string | null {
  if (!body) return body ?? null;
  if (body.startsWith(DAU_BAO_LAI)) return "";
  const i = body.indexOf(`\n${DAU_BAO_LAI}`);
  return i >= 0 ? body.slice(0, i) : body;
}
