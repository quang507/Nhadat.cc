// kiem-bang-chung.ts — FR-208: KIỂM đề xuất bóc tách của model bằng chính chữ khách gõ.
// Tầng bóc tách (tiền định): không model, không RPC — `bot/tests/ranh-gioi.mjs` canh.
//
// Vì sao: câu dặn "không bịa" không cấm được bịa (lượt bắn 14/09, model lờ câu dặn 5/9
// lần). Nên model phải kèm `trich_dan` — cụm chữ nguyên văn — và code kiểm ba lớp; trượt
// lớp nào là bỏ trường đó kèm lý do:
//   1. trích dẫn có NGUYÊN VĂN trong tin khách (so trên bản bỏ dấu, bỏ ký hiệu);
//   2. giá trị ĐỌC LẠI được từ đúng cụm đó bằng luật sẵn có (tiền, quận, số, chữ);
//   3. ngữ cảnh không phản (tiền sau "cọc / phí sang" không là giá; tin bán thì tiền
//      "đang cho thuê… /tháng" không là giá bán).
// Kiểm được trích dẫn thì bắt được BỊA; không bắt hết GÁN NHẦM Ô — lớp 3 và việc so với
// thứ luật đã ghi (`soSanhVoiDb`) là để thấy phần đó.
import { docTien, giaTheoM2 } from "./luat-tien.ts";
import { bocQuan, vungNgoai } from "../dia_ban.ts";
import { laGap } from "./khop-cau-tra-loi.ts";
import { dealCauRao, TRUOC_KHONG_PHAI_GIA, TRUOC_LA_THUE } from "./boc-cau-rao.ts";

const boDau = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
/** Bản so khớp: bỏ dấu, ký hiệu thành khoảng trắng (giữ số thập phân, "/", "x"). */
export const chuanSo = (s: string): string =>
  boDau(s).replace(/(\d),(\d)/g, "$1.$2").replace(/²/g, "2").replace(/[^a-z0-9./ ]+/g, " ").replace(/\s+/g, " ").trim();

export const KHOA_TIEN = ["gia", "tien_coc", "thu_nhap_thue"] as const;
export const KHOA_SO = [
  "dien_tich", "ngang", "dai", "no_hau", "do_rong_hem", "do_rong_duong", "cach_mat_tien",
  "so_phong_ngu", "so_wc", "so_tang", "tang",
] as const;
export const KHOA_CHU = [
  "duong", "du_an", "ma_can", "phap_ly", "huong", "noi_that", "ly_do_ban", "ket_cau",
  "thoi_han_thue", "phi_quan_ly", "view", "hien_trang",
] as const;
export const KHOA_KHAC = ["gia_m2", "loai_giao_dich", "loai_bds", "quan", "phuong", "gap", "thuong_luong"] as const;
export const MOI_KHOA = [...KHOA_TIEN, ...KHOA_SO, ...KHOA_CHU, ...KHOA_KHAC] as const;
export type Khoa = typeof MOI_KHOA[number];

export type DeXuat = { khoa: string; gia_tri: string; trich_dan: string; can?: number | null };
export type Bo = DeXuat & { ly_do: string };

const LOAI_BDS: Record<string, RegExp> = {
  chung_cu: /\b(can ho|chung cu|cc|penthouse|duplex|officetel|studio)\b/,
  nha_pho: /\b(nha|nha pho|np)\b/,
  nha_cap4: /\b(cap 4|cap bon|c4)\b/,
  dat: /\b(dat|lo dat|dat nen|nen dat)\b/,
  biet_thu: /\b(biet thu|villa)\b/,
  phong_tro: /\b(tro|phong tro|nha tro|day tro)\b/,
  mat_bang: /\b(mat bang|mb|kiot|ki ot|shophouse)\b/,
  toa_nha: /\b(toa nha|chdv|can ho dich vu|khach san|building)\b/,
  dat_nong_nghiep: /\b(nong nghiep|dat vuon|dat lua|cln|dat ray)\b/,
  dat_kinh_doanh: /\b(skc|tmd|dat thuong mai|dat kinh doanh|dat san xuat)\b/,
  kho_xuong: /\b(kho|xuong|nha xuong)\b/,
};
const laCo = (v: string) => /^(co|true|yes|1|gap|co gap|co thuong luong)$/.test(chuanSo(v));
const laKhong = (v: string) => /^(khong|ko|false|no|0|khong gap|khong thuong luong)$/.test(chuanSo(v));

/** Mọi con số đọc được trong cụm ("2m5" → 2.5 trừ khi là "m2"; "4x15" góp thêm 60 cho diện tích). */
function soTrong(cum: string, dienTich: boolean): number[] {
  let t = chuanSo(cum);
  if (!dienTich) t = t.replace(/(\d)\s*m\s*([013-9])(?!\d)/g, "$1.$2 ");
  const so = [...t.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  if (dienTich) {
    for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*m?\s*x\s*(\d+(?:\.\d+)?)/g)) so.push(Math.round(Number(m[1]) * Number(m[2]) * 10) / 10);
  }
  return so;
}
const gan = (a: number, b: number, tuongDoi = 0.01, tuyetDoi = 0.05) => Math.abs(a - b) <= Math.max(tuyetDoi, Math.abs(b) * tuongDoi);

/** Số tầng đọc từ cụm: "1 trệt 2 lầu" → 3, "3 tấm" → 3, "trệt" → 1, "5 tầng" → 5. */
function soTangTrong(cum: string): number[] {
  const t = chuanSo(cum);
  const ra: number[] = [];
  const lau = /(\d+)\s*lau/.exec(t);
  if (lau) ra.push(Number(lau[1]) + 1 + (/\bham\b/.test(t) ? 0 : 0));
  const tam = /(\d+)\s*tam\b/.exec(t);
  if (tam) ra.push(Number(tam[1]));
  const tang = /(\d+)\s*tang\b/.exec(t);
  if (tang) ra.push(Number(tang[1]));
  if (!ra.length && /\btret\b/.test(t)) ra.push(1);
  return ra;
}

/**
 * Tiền trong giá trị khớp tiền trong cụm. Model hay ghi SỐ TRẦN ("5.2" cho "5 tỷ 2", "3150"
 * cho "3 tỷ 150", "95" cho "95 triệu/m2") — số trần nhận khi nhân đúng một đơn vị (tỷ,
 * triệu, nghìn) ra đúng số trong cụm.
 */
function tienKhop(v: string, b: number, a0: number | null = null): boolean {
  const a = a0 ?? docTien(v);
  if (a != null) return gan(a, b);
  const tran = /^\s*(\d+(?:[.,]\d+)?)\s*$/.exec(v);
  if (!tran) return false;
  const n = Number(tran[1].replace(",", "."));
  return [1e9, 1e6, 1e3].some((u) => gan(n * u, b));
}

// Hình dạng tối thiểu của vài trường chữ (bản bỏ dấu của giá trị).
const HINH_TRUONG_CHU: Record<string, RegExp> = {
  huong: /\b(dong|tay|nam|bac)\b/,
  phap_ly: /\b(so|hong|do|hoan cong|vi bang|hdmb|hop dong|giay tay|shr|shc|cong chung|chung|rieng|sang ten|the chap)\b/,
  ket_cau: /\d|\b(tret|lau|tang|tam|lung|ham|mai|san thuong|cap 4|btct|be tong|khung|gac)\b/,
  ly_do_ban: /^(?!(?:can\s+)?(?:ban\s+)?gap\s*$).{3,}/,
};
// Cụm nói tới dự án: chữ chỉ loại khu, hoặc thương hiệu hay gặp. "Thảo Điền" (tên khu) không có.
const DAU_HIEU_DU_AN = /\b(du an|kdc|khu dan cu|khu do thi|kdt|chung cu|can ho|toa|block|thap)\b|residence|city|park|tower|plaza|garden|home|green|sky|river|central|vinhomes|masteri|sunrise|saigon|sai gon|lake|land|view|pearl|star|gold|diamond|ruby|centre|center/;

/** Một đề xuất đã qua lớp 1: kiểm lớp 2–3. Trả lý do bỏ, null là đạt. */
function kiemGiaTri(d: DeXuat, tin: string, viTri: number): string | null {
  const v = d.gia_tri.trim();
  const cum = d.trich_dan;
  const kd = chuanSo(cum);
  if (!v) return "gia_tri_rong";
  switch (d.khoa) {
    case "gia": case "tien_coc": case "thu_nhap_thue": {
      const kdTin = chuanSo(tin);
      // "cọc 2 tháng" — tiền cọc tính bằng THÁNG, không phải số tiền.
      if (d.khoa === "tien_coc" && /\bthang\b/.test(chuanSo(v))) {
        const n = chuanSo(v).match(/\d+/)?.[0];
        return n && /\bcoc\b/.test(kd) && new RegExp(`\\b${n}\\s*thang\\b`).test(kd) ? null : "coc_thang_khong_khop_trich_dan";
      }
      const b = docTien(cum);
      if (b == null) return "khong_doc_duoc_tien";
      if (!tienKhop(v, b)) return docTien(v) == null && !/^\d+(?:[.,]\d+)?$/.test(v) ? "khong_doc_duoc_tien" : "tien_khong_khop_trich_dan";
      if (d.khoa === "gia") {
        // Lượt đo bóng 14/09: trích "phí sang 350 triệu" lọt vì chữ "phí sang" nằm TRONG cụm.
        if (/\b(coc|dat coc|phi sang|tien sang|hoa hong|phi moi gioi|(?<!thuong )luong|doanh thu)\b/.test(kd)) return "ngu_canh_coc_phi_hoa_hong";
        const truoc = kdTin.slice(Math.max(0, viTri - 30), viTri);
        if (TRUOC_KHONG_PHAI_GIA.test(truoc)) return "ngu_canh_coc_phi_hoa_hong";
        const sau = kdTin.slice(viTri + chuanSo(cum).length, viTri + chuanSo(cum).length + 12);
        const moiThang = /\b(thang|th)\b/.test(kd) || /^\s*(?:\/|mot|1|moi)?\s*(?:thang|th)\b/.test(sau);
        if (dealCauRao(kdTin) === "ban" && (TRUOC_LA_THUE.test(truoc) || moiThang)) return "tien_thue_khong_phai_gia_ban";
      }
      // Thu nhập thuê chỉ có ở căn BÁN đang cho thuê; "sang nhượng mặt bằng, thuê 60 triệu" là giá thuê.
      if (d.khoa === "thu_nhap_thue") {
        const truoc = kdTin.slice(Math.max(0, viTri - 30), viTri);
        if (dealCauRao(kdTin) !== "ban" || !(/\b(dang|hien|hop dong)\b/.test(kd) || TRUOC_LA_THUE.test(truoc) || /\b(dang|hien|hop dong)\s+(cho\s+)?thue\b/.test(truoc))) {
          return "khong_phai_thu_nhap_thue";
        }
      }
      return null;
    }
    case "gia_m2": {
      const b = giaTheoM2(cum);
      if (b == null) return "khong_doc_duoc_gia_m2";
      return tienKhop(v, b, giaTheoM2(v)) ? null : "tien_khong_khop_trich_dan";
    }
    case "so_tang": {
      const n = Number(chuanSo(v).match(/\d+/)?.[0]);
      if (!Number.isFinite(n)) return "khong_phai_so";
      // Lượt đo bóng 14/09: model đưa "3" cho "1 trệt 1 lửng 3 lầu" (đếm lầu, quên trệt) và
      // cụm có số 3 nên lọt. Cụm nói trệt / lầu / tấm thì chỉ nhận số tầng TÍNH RA từ cụm.
      if (/\b(tret|lau|tam|tang)\b/.test(kd)) return soTangTrong(cum).includes(n) ? null : "so_tang_khong_khop_trich_dan";
      return soTrong(cum, false).includes(n) ? null : "so_khong_co_trong_trich_dan";
    }
    case "dien_tich": case "ngang": case "dai": case "no_hau": case "do_rong_hem": case "do_rong_duong":
    case "cach_mat_tien": case "so_phong_ngu": case "so_wc": case "tang": {
      const m = chuanSo(v).replace(/(\d)\s*m\s*([013-9])(?!\d)/g, "$1.$2").match(/\d+(?:\.\d+)?/);
      if (!m) return "khong_phai_so";
      const n = Number(m[0]);
      return soTrong(cum, d.khoa === "dien_tich").some((x) => gan(n, x, 0.01, d.khoa === "dien_tich" ? 0.6 : 0.05)) ? null : "so_khong_co_trong_trich_dan";
    }
    case "loai_giao_dich": {
      // "sang nhượng MẶT BẰNG" là thuê (lượt đo bóng 14/09 model nói "ban" và lọt); "sang
      // nhượng" chỉ là bán khi đi với căn hộ / nhà / đất.
      if (v === "ban") {
        const coBan = /\b(ban|de lai|thanh ly)\b|\b(?:sang nhuong|nhuong lai)\s+(?:lai\s+)?(?:can ho|can|nha|dat|lo|nen|biet thu)\b/.test(kd);
        return coBan && dealCauRao(kd) === "ban" ? null : "trich_dan_khong_noi_ban";
      }
      if (v === "cho_thue" || v === "thue") {
        return /\b(cho thue|thue|cho muon)\b|\bsang\s+(?:nhuong\s+|lai\s+)?(?:mat bang|mb|quan|shop|kiot)\b/.test(kd) && !/\b(dang|hien)\s+(cho\s+)?thue\b/.test(kd)
          ? null : "trich_dan_khong_noi_thue";
      }
      return "gia_tri_ngoai_danh_sach";
    }
    case "loai_bds": {
      const re = LOAI_BDS[v];
      if (!re) return "gia_tri_ngoai_danh_sach";
      return re.test(kd) ? null : "trich_dan_khong_noi_loai_nay";
    }
    case "quan": {
      const doc = bocQuan(chuanSo(cum), cum) ?? vungNgoai(chuanSo(cum))?.ten ?? null;
      // Model hay ghi "5" / "Q5" thay vì "Quận 5" — cùng một ý.
      const vv = /^\s*(?:q\.?\s*)?\d{1,2}\s*$/i.test(v) ? `Quận ${Number(v.replace(/\D/g, ""))}` : v;
      const muon = bocQuan(chuanSo(vv), vv) ?? vv;
      return doc && chuanSo(doc) === chuanSo(muon) ? null : "quan_khong_khop_trich_dan";
    }
    case "phuong": {
      const so = chuanSo(v).match(/\d{1,2}/)?.[0];
      if (so) {
        const m = /(?:phuong|\bp)\s*\.?\s*(\d{1,2})\b/.exec(kd);
        return m && Number(m[1]) === Number(so) ? null : "phuong_khong_khop_trich_dan";
      }
      const ten = chuanSo(v).replace(/^(phuong|xa|thi tran|p\.?)\s+/, "");
      return ten.length >= 3 && kd.includes(ten) && /\b(phuong|xa|thi tran|p)\b/.test(kd) ? null : "phuong_khong_khop_trich_dan";
    }
    case "gap": {
      if (laCo(v)) return laGap(cum) ? null : "trich_dan_khong_noi_gap";
      if (laKhong(v)) return /\b(khong|ko|chua|chang)\s*(can\s*)?(gap|voi)\b|\btu tu\b|\bduoc gia\b/.test(kd) ? null : "trich_dan_khong_noi_khong_gap";
      return "gia_tri_ngoai_danh_sach";
    }
    case "thuong_luong": {
      if (laCo(v)) return /\b(tl|thuong luong|thoa thuan|con bot|co bot|con tl)\b/.test(kd) ? null : "trich_dan_khong_noi_thuong_luong";
      if (laKhong(v)) return /\b(khong tl|khong thuong luong|gia chot|mien tl|mien thuong luong)\b/.test(kd) ? null : "trich_dan_khong_noi_gia_chot";
      return "gia_tri_ngoai_danh_sach";
    }
    default: {
      // Trường chữ: giá trị phải NẰM TRONG cụm trích (model không được "diễn đạt lại").
      if (!(MOI_KHOA as readonly string[]).includes(d.khoa)) return "khoa_la";
      const cv = chuanSo(v);
      if (!(cv.length >= 2 && kd.includes(cv))) return "gia_tri_khong_nam_trong_trich_dan";
      // Lượt đo bóng 14/09: chữ có thật trong cụm nhưng SAI Ô — "view sông" vào hướng, "thổ cư
      // hết" vào pháp lý, "xây tự do" vào kết cấu, "Thảo Điền" (khu) vào dự án, "gấp" vào lý do bán.
      const hinh = HINH_TRUONG_CHU[d.khoa];
      if (hinh && !hinh.test(cv)) return "gia_tri_khong_dung_loai_truong";
      if (d.khoa === "du_an" && !DAU_HIEU_DU_AN.test(kd)) return "khong_co_dau_hieu_du_an";
      return null;
    }
  }
}

/** Kiểm cả loạt đề xuất của model cho MỘT tin khách. */
export function kiemDeXuat(deXuat: DeXuat[], tin: string): { dat: DeXuat[]; bo: Bo[] } {
  const kdTin = chuanSo(tin);
  const dat: DeXuat[] = [];
  const bo: Bo[] = [];
  for (const d of deXuat ?? []) {
    if (!d || typeof d.khoa !== "string" || typeof d.gia_tri !== "string" || typeof d.trich_dan !== "string") continue;
    const kdCum = chuanSo(d.trich_dan);
    const viTri = kdCum.length >= 2 ? kdTin.indexOf(kdCum) : -1;
    if (viTri < 0) { bo.push({ ...d, ly_do: "trich_dan_khong_co_trong_tin" }); continue; }
    const ly = kiemGiaTri(d, tin, viTri);
    if (ly) bo.push({ ...d, ly_do: ly });
    else dat.push(d);
  }
  return { dat, bo };
}

/** Tin có mùi DỮ LIỆU không (đáng một lượt model bóng) — "ok em", "dạ" thì không. */
export function coMuiDuLieuRao(tin: string): boolean {
  const kd = chuanSo(tin);
  if (kd.length < 4) return false;
  return /\d/.test(kd) ||
    /\b(ban|thue|nha|dat|can ho|chung cu|so|hem|duong|pho|phuong|quan|huyen|xa|huong|lau|tang|tret|gap|tl|thuong luong|noi that|mat tien|du an|phap ly|hoan cong|coc|view|tien)\b/.test(kd);
}

// ── So với thứ LUẬT đã ghi vào DB sau lượt ─────────────────────────────────────
export type DongDb = {
  deal?: string | null; property_type?: string | null; price_vnd?: number | null; price_per_m2_vnd?: number | null;
  area_m2?: number | null; frontage_m?: number | null; length_m?: number | null; rear_width_m?: number | null;
  alley_width_m?: number | null; distance_to_street_m?: number | null; bedrooms?: number | null; bathrooms?: number | null;
  floors?: number | null; floor?: number | null; district?: string | null; ward?: string | null; street?: string | null;
  unit_code?: string | null; direction?: string | null; legal_status?: string | null; gap?: boolean | null;
  negotiable?: boolean | null; rent_income_vnd?: number | null; projects?: { name?: string | null } | null;
};
export type SoSanh = { trung: string[]; lech: Array<{ khoa: string; db: unknown; ai: string }>; ai_them: Array<{ khoa: string; ai: string }> };

const COT_SO: Record<string, keyof DongDb> = {
  dien_tich: "area_m2", ngang: "frontage_m", dai: "length_m", no_hau: "rear_width_m", do_rong_hem: "alley_width_m",
  do_rong_duong: "alley_width_m", cach_mat_tien: "distance_to_street_m", so_phong_ngu: "bedrooms", so_wc: "bathrooms",
  so_tang: "floors", tang: "floor",
};
const phapLyMa = (v: string) => {
  const t = chuanSo(v);
  return /rieng|shr/.test(t) ? "so_hong_rieng" : /chung|shc|dong so huu/.test(t) ? "so_hong_chung"
    : /hdmb|hop dong mua ban/.test(t) ? "hdmb" : /vi bang|giay tay/.test(t) ? "giay_tay" : /so/.test(t) ? "so_hong" : null;
};
const chuaNhau = (a: string, b: string) => { const x = chuanSo(a), y = chuanSo(b); return !!x && !!y && (x.includes(y) || y.includes(x)); };

/**
 * Đặt từng trường AI "đạt" cạnh giá trị luật đã ghi (cột tin + fact của tin). `trung` = cùng
 * ý; `lech` = hai bên khác nhau (bước 2 sẽ HỎI LẠI khách, không ghi); `ai_them` = DB chưa có.
 */
export function soSanhVoiDb(dat: DeXuat[], dong: DongDb | null, facts: Record<string, string>): SoSanh {
  const kq: SoSanh = { trung: [], lech: [], ai_them: [] };
  for (const d of dat) {
    if (d.can != null && d.can > 1) continue; // căn thứ hai trở đi: DB chỉ có một tin để so
    const v = d.gia_tri;
    let db: unknown = null;
    let khop: boolean | null = null;
    const k = d.khoa;
    if (k === "gia" || k === "thu_nhap_thue") {
      db = k === "gia" ? dong?.price_vnd : dong?.rent_income_vnd;
      const a = docTien(v);
      if (db != null && a != null) khop = gan(a, Number(db));
    } else if (k === "gia_m2") {
      db = dong?.price_per_m2_vnd; const a = giaTheoM2(v) ?? docTien(v);
      if (db != null && a != null) khop = gan(a, Number(db), 0.03);
    } else if (COT_SO[k]) {
      db = dong?.[COT_SO[k]]; const m = chuanSo(v).match(/\d+(?:\.\d+)?/);
      if (db != null && m) khop = gan(Number(m[0]), Number(db), 0.01, k === "dien_tich" ? 0.6 : 0.05);
    } else if (k === "loai_giao_dich") {
      db = dong?.deal; if (db) khop = (v === "thue" ? "cho_thue" : v) === db;
    } else if (k === "loai_bds") {
      db = dong?.property_type && dong.property_type !== "chua_ro" ? dong.property_type : null; if (db) khop = v === db;
    } else if (k === "quan") {
      db = dong?.district; if (db) khop = chuanSo(String(db)) === chuanSo(bocQuan(chuanSo(v), v) ?? v);
    } else if (k === "phuong") {
      db = dong?.ward;
      if (db) {
        const a = chuanSo(v).match(/\d{1,2}/)?.[0], b = chuanSo(String(db)).match(/\d{1,2}/)?.[0];
        khop = a || b ? Number(a) === Number(b) : chuaNhau(v, String(db));
      }
    } else if (k === "duong") {
      db = dong?.street; if (db) khop = chuaNhau(v, String(db));
    } else if (k === "du_an") {
      db = dong?.projects?.name ?? null; if (db) khop = chuaNhau(v, String(db));
    } else if (k === "ma_can") {
      db = dong?.unit_code; if (db) khop = chuanSo(v).replace(/\s/g, "") === chuanSo(String(db)).replace(/\s/g, "");
    } else if (k === "huong") {
      db = dong?.direction; if (db) khop = chuaNhau(v, String(db));
    } else if (k === "phap_ly") {
      db = dong?.legal_status; if (db) khop = phapLyMa(v) === db || (db === "so_hong" && !!phapLyMa(v));
    } else if (k === "gap" || k === "thuong_luong") {
      db = k === "gap" ? dong?.gap : dong?.negotiable;
      if (db != null) khop = laCo(v) ? db === true : laKhong(v) ? db === false : null;
    }
    if (db == null && facts[k] != null) { db = facts[k]; khop = chuaNhau(v, facts[k]); }
    if (db == null || khop == null) kq.ai_them.push({ khoa: k, ai: v });
    else if (khop) kq.trung.push(k);
    else kq.lech.push({ khoa: k, db, ai: v });
  }
  return kq;
}
