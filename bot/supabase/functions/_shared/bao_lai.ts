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

import { donViGiaDep } from "./extraction/luat-tien.ts";
import { SPEC_COLS, thongSoNgan, type SpecRow } from "./thong_so.ts";
import { tenNhan } from "./extraction/nhan.ts";

export type CheDoBaoLai = "tat" | "thay_doi" | "day_du";

/** Dấu mở bong bóng báo lại. Cố ý khác 📋 (tiêu đề bản nháp) và 📝 (ghi nhận lúc rao).
 *  21/09/2026 (chủ dự án): 💾 "Vừa lưu / Đã lưu" và 🤖 "AI đọc thêm" GỘP thành MỘT bong bóng "🤖 Đã lưu";
 *  fact AI đọc (nguồn ai_kiem) nằm chung danh sách, không tách dòng. */
export const DAU_BAO_LAI = "🤖";

export const COT_BAO_LAI =
  `id, code, property_type, deal, status, location_raw, ward, district, area_m2, price_raw, price_vnd, bedrooms, boc_tach, floor, furnishing, nhan, projects(name), ${SPEC_COLS}`;

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
  /** JSON bóc tách; `quan_mac_dinh: true` = quận chưa ai nói, cột đang giữ mặc định. */
  boc_tach?: Record<string, unknown> | null;
  /** Tầng căn hộ nằm (chung cư) — khác `floors` (số tầng nhà). */
  floor?: number | null;
  furnishing?: string | null;
  /** Dự án tin đã GẮN (project_id → projects.name), không phải tên đoán từ chữ. */
  projects?: { name?: string | null } | null;
  /** Nhãn tìm kiếm của tin (FR-211) — toàn bộ, không chỉ nhãn lượt này. */
  nhan?: string[] | null;
};

export type FactBaoLai = { question: string; answer: string | null; created_at?: string | null; source?: string | null };

/** Nguồn fact do AI đọc ra (FR-208 bước 2). Từ 21/09/2026 gộp chung vào bong bóng "🤖 Đã lưu". */
export const NGUON_AI = "ai_kiem";
/** Dấu cũ của dòng "AI đọc thêm" (nay trùng DAU_BAO_LAI — một bong bóng). */
export const DAU_AI_DOC = "🤖";

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
// Nhãn in trên 🤖 khác nhãn câu hỏi: FACT_LABELS.view = "view căn hộ" (câu hỏi căn hộ) mà nhà phố cũng có view
// (bắn thật 23/09: "view căn hộ: công viên" cho nhà phố). Đè trước FACT_LABELS.
const NHAN_BAO_LAI: Record<string, string> = { view: "view" };
const NHAN_THEM: Record<string, string> = {
  du_an_ten: "tên dự án",
  loai_giao_dich: "loại giao dịch",
  dien_tich_san: "diện tích sàn", // 16/09/2026: bong bóng 💾 từng in "dien tich san"
};
// Đáp án là giá trị enum (`listings.deal`) — in cho người đọc.
const CHU_DAP_AN: Record<string, Record<string, string>> = {
  loai_giao_dich: { ban: "bán", cho_thue: "cho thuê" },
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
  // 11/09/2026 (Zalo thật): "sao cái nào cũng ghi Q5" — Quận 5 mà là MẶC ĐỊNH (chưa
  // ai nói quận) thì nói thẳng ra, đừng để người đọc tưởng hệ thống đọc được Quận 5.
  // 20260917a: không còn mặc định Quận 5 — quận trống thì in "(chưa rõ quận)"; cờ cũ giữ để đọc tin cũ.
  const quanMacDinh = !l.district || (l.district === "Quận 5" && l.boc_tach?.quan_mac_dinh === true);
  const dc = gonDiaChi(l.location_raw, l.ward, quanMacDinh ? (l.district ? `${l.district} (chưa rõ quận)` : "(chưa rõ quận)") : l.district);
  if (dc) p.push(dc);
  // 14/09/2026 (bắn thật): căn hộ Sunrise City đã gắn project_id, tầng 15, full nội
  // thất nằm trong DB mà 💾 không nói — tóm tắt chỉ biết cột nhà phố.
  if (l.projects?.name) p.push(`dự án ${l.projects.name}`);
  if (l.area_m2 !== null && l.area_m2 !== undefined && l.area_m2 !== "") p.push(`${so(l.area_m2)}m²`);
  const ts = thongSoNgan(l).replace(/^ · /, "");
  if (ts) p.push(ts);
  if (l.floor != null) p.push(`tầng ${l.floor}`);
  if (l.furnishing) p.push(`nội thất ${({ full: "đầy đủ", co_ban: "cơ bản", khong: "không (nhà trống)" } as Record<string, string>)[l.furnishing] ?? l.furnishing}`);
  if (l.bedrooms) p.push(`${l.bedrooms} phòng ngủ`);
  // Có chữ giá mà không ra số = parse_vnd không đọc được → web lọc giá sẽ không thấy tin.
  // 22/09/2026 (bắn thật): khách gõ "4 ty 3" thì 🤖 in "giá 4 ty 3" tới khi sửa — chỉ ĐỌC cho đẹp đơn vị
  // (ty/ti/toi → tỷ, trieu/tr → triệu), không đụng `price_raw` trong DB.
  if (l.price_raw) p.push(l.price_vnd ? `giá ${donViGiaDep(l.price_raw)}` : `giá "${l.price_raw}" (chưa đọc ra số)`);
  // 23/09/2026 (bắn thật FR-215): fact "nhan" chỉ giữ nhãn THÊM ở một lượt — lượt 2 thêm "đã hoàn công" thì 🤖 mất
  // "view công viên" của lượt 1. In cột `listings.nhan` (đủ mọi nhãn) thay cho fact đó.
  if (l.nhan?.length) p.push(`nhãn: ${tenNhan(l.nhan)}`);

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

// ── 14/09/2026: báo NGAY SAU tin khách, đúng thứ TIN ĐÓ vừa lưu ────────────
// Chủ dự án: "nhắn tin lại cho khách liền sau tin nhắn đó đã bóc tách (thật vào
// db) gì luôn". Bản trước chỉ in TÓM TẮT CỘT của tin, gắn vào CUỐI bong bóng cuối
// và chỉ khi cột đổi — nên cọc / thời hạn thuê / phí quản lý (chỉ nằm ở fact)
// không bao giờ hiện, câu "à nhầm, 6 tỷ 5" chìm sau câu hỏi, và người mua không
// được báo gì. Nay tầng trên đọc lại DB: fact có `created_at` ≥ giờ ghi tin khách
// (cùng đồng hồ DB), hồ sơ người mua đọc lại sau khi gộp; hàm dưới chỉ dựng chữ.

/** Dấu cũ của dòng "📦 Tin giờ" (tóm tắt tin ở các lượt sau). 21/09/2026 (chủ dự án): bỏ — lượt sau in một
 *  dòng "🤖 Đã lưu:" đầy đủ y như lượt tạo tin. Giữ hằng để `tomTatTrongCau` còn đọc được câu bot cũ trong sổ. */
export const DAU_TIN_GIO = "📦 Tin giờ:";

/** "🤖 Đã lưu: giá: "6 tỷ 5" · phường: "Phường 9"" — fact lượt này (mới nhất trước), null khi không có. */
export function vuaLuuBan(facts: FactBaoLai[], nhan: Record<string, string>): string | null {
  const moiNhat = new Map<string, string>();
  for (const f of facts) {
    const a = (f.answer ?? "").replace(/\s+/g, " ").trim();
    if (!a || BO_QUA.has(f.question) || moiNhat.has(f.question)) continue;
    moiNhat.set(f.question, a);
  }
  if (!moiNhat.size) return null;
  // 23/09/2026 (chủ dự án: "ghi thật đầy đủ"): trần 12 khoá / 50 ký tự từng cắt mất fact và đuôi câu trả lời.
  const ds = [...moiNhat].reverse().slice(0, 40).map(([k, v]) => {
    const ten = (NHAN_BAO_LAI[k] ?? nhan[k] ?? NHAN_THEM[k] ?? k.replace(/_/g, " ")).replace(/\s*\(.*\)\s*$/, "");
    const chu = CHU_DAP_AN[k]?.[v] ?? v;
    return `${ten}: "${chu.length > 120 ? chu.slice(0, 119) + "…" : chu}"`;
  });
  return `${DAU_BAO_LAI} Đã lưu: ${ds.join(" · ")}`;
}

/** "🤖 AI đọc thêm (đã kiểm): hướng: "Đông Nam" · pháp lý: "sổ hồng riêng"" — fact nguồn `ai_kiem` lượt này. */
export function aiDocThem(facts: FactBaoLai[], nhan: Record<string, string>): string | null {
  const v = vuaLuuBan(facts.filter((f) => f.source === NGUON_AI), nhan);
  return v ? v.replace(`${DAU_BAO_LAI} Đã lưu: `, `${DAU_AI_DOC} AI đọc thêm (đã kiểm): `) : null;
}

// Fact mà tóm tắt CỘT đã nói (qua cột tương ứng) — lượt tạo tin chỉ kèm phần còn lại.
const DA_CO_TRONG_TOM_TAT = new Set([
  "dien_tich", "dien_tich_dat", "dien_tich_tim_tuong", "gia", "phuong", "vi_tri", "so_phong_ngu", "ket_cau",
  "do_rong_hem", "phap_ly", "so_wc", "mat_tien", "huong", "loai_bds", "tang", "noi_that", "gap",
  "nhan", // tóm tắt cột in cả `listings.nhan`
]);

/** Lượt TẠO tin: "Kèm: view: "view sông" · lý do bán: "cần tiền"" — fact lượt này tóm tắt cột chưa nói. */
export function kemLuotTao(facts: FactBaoLai[], nhan: Record<string, string>): string | null {
  // 21/09/2026 (gộp 🤖 vào 💾): fact AI đọc từng luôn được nêu ở "Kèm" để chủ nhà thấy mà sửa. Từ tối 21/09
  // (bắn thật kiem-tbt) dòng 🤖 đã là toàn bộ cột, nên fact AI có cột ("3 phòng ngủ") in lại ở Kèm là
  // nói hai lần; chỉ còn nêu fact mà tóm tắt cột không nói, bất kể nguồn.
  const con = facts.filter((f) => !DA_CO_TRONG_TOM_TAT.has(f.question));
  const v = vuaLuuBan(con, nhan);
  return v ? v.replace(`${DAU_BAO_LAI} Đã lưu: `, "Kèm: ") : null;
}

// Khoá hồ sơ người mua là việc NỘI BỘ của bot — không báo.
const MUA_NOI_BO = new Set(["ten_tro_ly", "xung_ho", "photo_offset", "hoi_vai", "gan_tien_ich_loc"]);
const MUA_NHAN_THEM: Record<string, string> = {
  gan_tien_ich: "muốn ở gần", notes: "hoàn cảnh", gap: "cần gấp", name: "tên",
  phap_ly: "pháp lý mong muốn", // 23/09/2026: "ưu tiên sổ hồng riêng" không còn nằm ở "hoàn cảnh".
};

/**
 * "💾 Đã lưu nhu cầu: khu vực: Quận 5 · khoảng giá: 7 tỷ" — các khoá hồ sơ ĐỔI
 * giữa `truoc` (đầu lượt) và `sau` (đọc lại DB sau khi gộp). Không đổi gì → null.
 */
export function vuaLuuMua(
  truoc: Record<string, unknown> | null | undefined,
  sau: Record<string, unknown> | null | undefined,
  truong: Array<[string, string]>,
): string | null {
  if (!sau) return null;
  const nhanTruong = Object.fromEntries(truong.map(([k, v]) => [k, v.replace(/\s*\(.*\)\s*$/, "")]));
  const giaTri = (k: string, v: unknown): string => {
    if (k === "deal") return v === "thue" ? "thuê" : v === "ban" ? "mua" : String(v);
    if (typeof v === "boolean") return v ? "có" : "không";
    return String(v).replace(/\s+/g, " ").trim();
  };
  const ds: string[] = [];
  const thuTu = [...truong.map(([k]) => k), ...Object.keys(sau).filter((k) => !truong.some(([t]) => t === k))];
  for (const k of thuTu) {
    if (MUA_NOI_BO.has(k)) continue;
    const v = sau[k];
    if (v == null || v === "" || (typeof v === "object")) continue;
    if (JSON.stringify(truoc?.[k] ?? null) === JSON.stringify(v)) continue;
    const ten = nhanTruong[k] ?? MUA_NHAN_THEM[k];
    if (!ten) continue;
    const s = giaTri(k, v);
    ds.push(`${ten}: ${s.length > 60 ? s.slice(0, 59) + "…" : s}`);
  }
  return ds.length ? `${DAU_BAO_LAI} Đã lưu nhu cầu: ${ds.join(" · ")}` : null;
}

/** Tóm tắt tin (không dấu mở) nằm trong một câu bot có 💾, để so "tin có đổi không". */
export function tomTatTrongCau(body: string | null | undefined): string | null {
  if (!body) return null;
  const m = [...body.matchAll(new RegExp(`(?:${DAU_BAO_LAI} Đã lưu(?: tin [^:(]*)?(?: \\([^)]*\\))?:|${DAU_TIN_GIO}) ([^\\n]*)`, "gu"))];
  return m.length ? m[m.length - 1][1].trim() : null;
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
  if (body.startsWith(DAU_BAO_LAI) || body.startsWith(DAU_AI_DOC)) return "";
  const i = body.indexOf(`\n${DAU_BAO_LAI}`);
  const j = body.indexOf(`\n${DAU_AI_DOC}`);
  const cat = [i, j].filter((x) => x >= 0);
  return cat.length ? body.slice(0, Math.min(...cat)) : body;
}
