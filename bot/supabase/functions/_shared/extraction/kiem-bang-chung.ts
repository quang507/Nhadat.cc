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
import { docTien, giaTheoM2, TIEN_KD } from "./luat-tien.ts";
import { bocQuan, vungNgoai } from "../dia_ban.ts";
import type { CanTrongTin } from "./khop-cau-tra-loi.ts";
import { cumPhongNguTheoTang, docTraLoiLung, DOI_SANG_BAN_RE, DOI_SANG_THUE_RE, gonGiaTriFact, ketCauTheoLung, KHONG_BIET_PHUONG, laGap, soPhongNguTheoTang, soTangTrongDapLung } from "./khop-cau-tra-loi.ts";
import { dealCauRao, TRUOC_KHONG_PHAI_GIA, TRUOC_LA_THUE } from "./boc-cau-rao.ts";
import { cauNhacPhuong, phuongChuan, phuongTrongTrich, phuongTuTenCu, tenDayDu } from "./khop-phuong.ts";
import { goNhamDau } from "./go-nham-dau.ts";

const boDau = (s: string): string =>
  goNhamDau(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
/** Bản so khớp: bỏ dấu, ký hiệu thành khoảng trắng (giữ số thập phân, "/", "x"). */
export const chuanSo = (s: string): string =>
  boDau(s).replace(/(\d),(\d)/g, "$1.$2").replace(/²/g, "2").replace(/[^a-z0-9./ ]+/g, " ").replace(/\s+/g, " ").trim();

export const KHOA_TIEN = ["gia", "tien_coc", "thu_nhap_thue"] as const;
export const KHOA_SO = [
  "dien_tich", "ngang", "dai", "no_hau", "do_rong_hem", "do_rong_duong", "cach_mat_tien",
  "so_phong_ngu", "so_wc", "so_tang", "tang",
] as const;
export const KHOA_CHU = [
  "duong", "ten_duong", "du_an", "ma_can", "phap_ly", "huong", "noi_that", "ly_do_ban", "ket_cau",
  "thoi_han_thue", "phi_quan_ly", "view", "hien_trang",
] as const;
export const KHOA_KHAC = ["gia_m2", "loai_giao_dich", "loai_bds", "quan", "phuong", "gap", "thuong_luong"] as const;
// Đợt 1 chuyển luật sang AI (02/10/2026, chủ dự án: "lấy hết các luật bên kia qua cho AI"): các ô trước đây CHỈ luật tìm-chuỗi
// ghi (AI không có chỗ nói) — "xe container vào tận nơi em" từng ghi nguyên câu, "không có hẻm" thành hẻm. Nay AI nói, code
// kiểm trích dẫn; luật chỉ đỡ khi model chết (`KHOA_FACT_AI_BIET` gồm luôn các khoá này).
export const KHOA_BOOL = ["o_to_vao_nha", "hoan_cong", "thang_may", "can_goc"] as const;
/** Loại đường vào (cột `access_type`) — `khong_hem`: không có hẻm / nội khu, không ghi cột. */
export const LOAI_DUONG_VAO: Record<string, string> = {
  mat_tien: "mặt tiền", hem_xe_tai: "hẻm xe tải", hem_xe_hoi: "hẻm xe hơi", hem_xe_may: "hẻm xe máy", hem: "trong hẻm",
  khong_hem: "không có hẻm",
};
export const KHOA_O = [
  "loai_duong_vao", ...KHOA_BOOL, "nam_xay", "quy_hoach", "the_chap", "tranh_chap", "tho_cu", "len_tho_cu", "xay_dung",
  "so_phong", "dien_tich_san", "chieu_cao", "hem_thong", "duong_vao", "ngap_nuoc", "tien_ich_gan", "tiem_nang", "muc_dich",
  "hinh_dang", "san_vuon", "pccc", "thoi_han_su_dung", "han_hop_dong_thue", "ty_le_lap_day", "phi_gui_xe", "mat_do_xd",
  "tang_cao_toi_da", "tai_trong_san", "toa_thap", "khu_compound", "ha_tang", "fit_out", "duong_container", "tram_bien_ap",
  "xu_ly_nuoc_thai", "nguon_nuoc", "ranh_gioi", "hinh_thuc_thue_dat", "hien_trang_su_dung", "truot_gia",
] as const;
export const MOI_KHOA = [...KHOA_TIEN, ...KHOA_SO, ...KHOA_CHU, ...KHOA_KHAC, ...KHOA_O] as const;
export type Khoa = typeof MOI_KHOA[number];

export type DeXuat = {
  khoa: string; gia_tri: string; trich_dan: string; can?: number | null;
  /** cụm thật trong tin (bỏ dấu) khi trích dẫn chỉ khớp MỜ */
  trich_dan_sua?: string;
  /** SRS-5.1zzr: cụm NGUYÊN VĂN trong tin khách (đúng dấu, đúng hoa thường, đúng thứ tự chữ) ứng với trích dẫn — `kiemDeXuat` điền. */
  cum_goc?: string;
  /** Giá trị do CODE tính ra (kết cấu theo câu lửng…) — không thay bằng cụm nguyên văn. */
  giu_gia_tri?: boolean;
};
export type Bo = DeXuat & { ly_do: string };

// ── SRS-5.1zzr (06/10/2026, chủ dự án: "trông vào model, nhưng thông tin quan trọng ghi nguyên văn; mỗi loại BĐS một bộ
// trường") — Ô GHI NGUYÊN VĂN THEO LOẠI. Model chỉ ra CỤM nào trong tin là thông tin đó; giá trị ghi vào ô là chính cụm
// khách gõ (`cum_goc`), không phải chữ model soạn lại. Ca gốc: "hẻm 137 Nguyễn Trãi" → model viết "137 hẻm Nguyễn Trãi".
// Đây là CHỖ DUY NHẤT quyết định ô nào nguyên văn; ô ngoài bảng thì model được chuẩn hoá như cũ. Số (giá, diện tích, số
// tầng…) không nằm đây — cột là số, kiểm bằng chứng đã bắt mọi con số phải có trong tin. ──
const NV_CHUNG = ["vi_tri", "du_an_ten", "phap_ly", "giay_to_hien_co", "du_kien_ra_so", "hien_trang_su_dung", "han_hop_dong_thue"];
const NV_DAT = ["tho_cu", "quy_hoach", "len_tho_cu", "xay_dung", "ha_tang", "duong_vao", "nguon_nuoc", "ranh_gioi", "muc_dich", "thoi_han_su_dung", "hinh_thuc_thue_dat", "hinh_dang"];
export const O_NGUYEN_VAN: Record<string, ReadonlySet<string>> = {
  nha_pho: new Set([...NV_CHUNG, "ket_cau"]),
  nha_cap4: new Set([...NV_CHUNG, "ket_cau", "hien_trang"]),
  biet_thu: new Set([...NV_CHUNG, "ket_cau", "san_vuon", "khu_compound"]),
  toa_nha: new Set([...NV_CHUNG, "ket_cau", "pccc", "ty_le_lap_day"]),
  chung_cu: new Set([...NV_CHUNG, "noi_that", "view", "toa_thap"]),
  dat: new Set([...NV_CHUNG, ...NV_DAT]),
  dat_nong_nghiep: new Set([...NV_CHUNG, ...NV_DAT]),
  dat_kinh_doanh: new Set([...NV_CHUNG, ...NV_DAT]),
  kho_xuong: new Set([...NV_CHUNG, "duong_container", "tram_bien_ap", "xu_ly_nuoc_thai", "pccc", "thoi_han_su_dung", "hinh_thuc_thue_dat"]),
  phong_tro: new Set([...NV_CHUNG, "noi_that", "gio_giac", "gia_dien_nuoc"]),
  mat_bang: new Set([...NV_CHUNG, "nganh_hang_phu_hop", "muc_dich", "thoi_han_thue", "truot_gia", "fit_out"]),
  chua_ro: new Set(NV_CHUNG),
};
/** Ô `question` của loại `loai` có ghi nguyên văn không. Loại lạ / chưa biết → bộ chung. */
export function laONguyenVan(loai: string | null | undefined, question: string): boolean {
  return (O_NGUYEN_VAN[loai ?? ""] ?? O_NGUYEN_VAN.chua_ro).has(question);
}
/**
 * Cụm NGUYÊN VĂN trong `tin` ứng với bản so khớp `kdCum` (đầu ra `chuanSo`): quét cửa sổ theo từ, cửa sổ nào `chuanSo`
 * ra đúng `kdCum` thì trả đoạn gốc (gọt ký hiệu hai đầu). Không có → null (nơi gọi dùng trích dẫn của model).
 */
export function cumGocTrongTin(tin: string, kdCum: string): string | null {
  const muc = (kdCum ?? "").trim();
  if (!muc || !tin) return null;
  const tu: Array<{ s: number; e: number }> = [];
  for (const m of tin.matchAll(/\S+/gu)) tu.push({ s: m.index ?? 0, e: (m.index ?? 0) + m[0].length });
  const n = muc.split(" ").length;
  for (let dai = Math.max(1, n - 1); dai <= n + 2; dai++) {
    for (let i = 0; i + dai <= tu.length; i++) {
      const doan = tin.slice(tu[i].s, tu[i + dai - 1].e);
      if (chuanSo(doan) !== muc) continue;
      const got = doan.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%²]+$/gu, "").trim();
      return got || null;
    }
  }
  return null;
}
// Chữ dẫn bỏ ở đầu cụm — CỐ Ý hẹp: "nam" (Nam Kỳ Khởi Nghĩa), "lô" (lô 5 đường số 7), "căn", "là" đều có thể là chữ thật của địa chỉ.
const NV_DAU_CUM = /^(?:nhà ở|nha o|nhà|nha|ở|o|tại|tai|địa chỉ|dia chi)\s+/iu;
// Đuôi phường / quận cắt khỏi địa chỉ (có ô riêng). Quận chỉ cắt khi theo sau là số hoặc tên quận TP.HCM — "quan hoa", "huyen tran
// cong chua" gõ không dấu là tên đường, không phải đuôi hành chính.
const NV_DUOI_DIA_CHI = /[,;.]?\s*(?<![\p{L}\d])(?:(?:phường|phuong|p\.)\s*(?:\d{1,2}|[\p{L}]{2,})(?![\p{L}\d])|(?:quận|quan|q\.)\s*(?:\d{1,2}(?![\d\p{L}])|tân|tan|bình|binh|gò|go|phú|phu|thủ|thu|hóc|hoc|củ|cu|nhà|nha|cần|can)(?![\p{L}\d])|tp\.?\s*hcm|tphcm|hồ chí minh|ho chi minh)[\s\S]*$/iu;
const NV_BE_RONG_HEM = /(\b(?:hẻm|hem|hẽm)\b\s*)(?:rộng|rong)?\s*\d+(?:[.,]\d+)?\s*(?:m(?![\p{L}])|mét|met\b)\s*/giu;
/**
 * Giá trị ghi cho ô nguyên văn: cụm gốc (hay trích dẫn của model), gọt chữ dẫn đầu ("ở", "nhà", "tại"), tiểu từ cuối câu
 * (cùng `gonGiaTriFact` với luật); riêng địa chỉ bỏ đuôi phường / quận (có ô riêng) và bề rộng hẻm ("hẻm 6m" — ô
 * `do_rong_hem`). KHÔNG đảo, KHÔNG thêm, KHÔNG sửa chính tả. Không ra được cụm dùng được → null (nơi gọi lấy giá trị model).
 */
export function giaTriNguyenVan(question: string, d: DeXuat | null | undefined): string | null {
  if (!d || d.giu_gia_tri) return null;
  // Kết cấu: chỉ cụm chữ `ket_cau` ("1 trệt 2 lầu") là nguyên văn; `so_tang` là SỐ code đã tính (cộng trệt…) — giữ.
  if (question === "ket_cau" && d.khoa !== "ket_cau") return null;
  let c = (d.cum_goc ?? d.trich_dan ?? "").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3 && NV_DAU_CUM.test(c); i++) c = c.replace(NV_DAU_CUM, "");
  if (question === "vi_tri") {
    c = c.replace(NV_DUOI_DIA_CHI, "").replace(NV_BE_RONG_HEM, "$1").replace(/\s+/g, " ").trim();
    c = c.replace(/^(?:số|so)\s+(?=\d)/iu, "");
  }
  c = gonGiaTriFact(question, c).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%²)]+$/gu, "").trim();
  if (c.length < 2 || c.length > 120 || !/[\p{L}\p{N}]/u.test(c)) return null;
  const v = (d.gia_tri ?? "").trim();
  // Cụm là VIẾT TẮT ("shr", "hxh", "q5": một từ ngắn) → giá trị model đã qua kiểm "cùng mã" là bản viết đủ, không phải bịa — giữ.
  if (c.length <= 4 && !/\s/.test(c) && v) return gonGiaTriFact(question, v);
  // Model chỉ THÊM DẤU / đổi hoa thường cho một phần của cụm ("126 Hung Vuong" + model "Hùng Vương"; "pham the hien" →
  // "Phạm Thế Hiển": cùng chữ cái, cùng thứ tự) → ghép bản có dấu của model vào ĐÚNG chỗ đó, phần còn lại giữ nguyên văn
  // (FR-208 h đã cấm đổi chữ cái). Đảo chữ, thêm bớt chữ thì không khớp → cụm khách.
  return themDauTheoModel(c, v);
}
/** Thay trong `cum` đoạn từ nào `chuanSo` trùng với `v` bằng chính `v` (bản có dấu của model). Không trùng → giữ `cum`. */
function themDauTheoModel(cum: string, v: string): string {
  const kv = chuanSo(v);
  if (!kv || !v) return cum;
  // Chỉ dấu / hoa thường được khác — ký hiệu model THÊM ("(chính chủ)") không phải thêm dấu, giữ cụm khách.
  const chiDau = (a: string, b: string) => boDau(a).replace(/\s+/g, " ").trim() === boDau(b).replace(/\s+/g, " ").trim();
  const tu = cum.split(" ");
  const n = kv.split(" ").length;
  for (let i = 0; i + n <= tu.length; i++) {
    const doan = tu.slice(i, i + n).join(" ");
    if (chuanSo(doan) !== kv || !chiDau(doan, v)) continue;
    return [...tu.slice(0, i), v.trim(), ...tu.slice(i + n)].join(" ").replace(/\s+/g, " ").trim();
  }
  return cum;
}
/** Loại BĐS để tra bảng nguyên văn: dòng DB, không thì loại AI vừa đọc ra trong cùng lượt. */
export function loaiChoNguyenVan(dong: { property_type?: string | null } | null | undefined, dat: DeXuat[]): string | null {
  if (dong?.property_type) return dong.property_type;
  const lb = chuanSo(dat.find((d) => d.khoa === "loai_bds")?.gia_tri ?? "").replace(/\s+/g, "_");
  return lb || null;
}

export const LOAI_BDS: Record<string, RegExp> = {
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
  // 24/09/2026 (chủ dự án test Zalo): "137/28 nhé em" trả lời câu diện tích → model đưa "137m2", trích "137/28" và
  // lọt vì cụm có số 137. Số nằm trong dạng SỐ NHÀ / HẺM có gạch chéo ("137/28", "12/3A") không phải số đo.
  let t = chuanSo(cum).replace(/\b\d+[a-z]?(?:\/\d+[a-z]?)+\b/g, " ");
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
  // 21/09/2026 (bắn thật mau-v-03 chế độ chinh): "hẻm xe hơi" → hiện trạng "xe hơi" lọt vì chữ có
  // thật trong cụm. Hiện trạng phải có chữ tả TÌNH TRẠNG căn nhà.
  hien_trang: /\b(trong|moi|cu|nha o|dang o|o tu|o lien|vao o|don vao|dang cho thue|dang thue|xuong cap|son|sua|hoan thien|tho|bo trong|dang kinh doanh|dang su dung|nha nat|dot nat|xay|dep|sach|nguyen ban|da su dung|chua o|con tot|ban giao|hien trang|cho thue|kinh doanh)\b/,
  phap_ly: /\b(so|hong|do|hoan cong|vi bang|hdmb|hop dong|giay tay|shr|shc|cong chung|chung|rieng|sang ten|the chap)\b/,
  ket_cau: /\d|\b(tret|lau|tang|tam|lung|ham|mai|san thuong|cap 4|btct|be tong|khung|gac)\b/,
  ly_do_ban: /^(?!(?:can\s+)?(?:ban\s+)?gap\s*$).{3,}/,
  // Đo bóng lần 2: "để ở hoặc cho thuê đều được" vào ô nội thất.
  noi_that: /\b(noi that|nt|full|may lanh|dieu hoa|tu lanh|giuong|tu ao|bep|sofa|rem|may giat|nong lanh|trong|co ban|day du|cao cap|ban giao|de lai)\b/,
};
// Cụm nói tới dự án: chữ chỉ loại khu, hoặc thương hiệu hay gặp. "Thảo Điền" (tên khu) không có.
const DAU_HIEU_DU_AN = /\b(du an|kdc|khu dan cu|khu do thi|kdt|chung cu|can ho|toa|block|thap)\b|residence|city|park|tower|plaza|garden|home|green|sky|river|central|vinhomes|masteri|sunrise|saigon|sai gon|lake|land|view|pearl|star|gold|diamond|ruby|centre|center/;

/** Loại đường vào: mã trong danh sách, không ngược loại khách nói rõ ("hxm" ≠ hẻm xe hơi); "không có hẻm" phải có chữ phủ định / nội khu. */
function kiemLoaiDuongVao(v: string, kd: string): string | null {
  const ma = v.trim();
  if (!(ma in LOAI_DUONG_VAO)) return "gia_tri_ngoai_danh_sach";
  if (ma === "khong_hem") return /\b(khong|ko|chang|chua)\b|\bnoi khu\b|\bkhu cong nghiep\b|\bkcn\b|\bccn\b/.test(kd) ? null : "trich_dan_khong_noi_khong_hem";
  const lt = loaiDuongNoiRo(kd);
  const theoMa: Record<string, string> = { mat_tien: "mat_tien", hem_xe_hoi: "hoi", hem_xe_may: "may", hem_xe_tai: "tai" };
  if (lt && theoMa[ma] && theoMa[ma] !== lt) return "loai_duong_nguoc_chu_khach";
  // 03/10/2026 (bắn thử thu-mc-05, SRS-5.1zn): "hẻm 3m" → AI "hẻm xe máy". Khách CHỈ nói bề rộng (không nói xe hơi / xe máy) thì
  // loại hẻm theo ngưỡng chủ dự án chốt (20261003a): < 3m xe máy, 3–<3,5m trong hẻm, ≥ 3,5m xe hơi, ≥ 6m xe tải. AI lệch ngưỡng →
  // bỏ đề xuất; trigger DB đọc bề rộng (`do_rong_hem`) và tự xếp đúng ngưỡng.
  if (!lt && ma.startsWith("hem")) {
    const m = /(\d+(?:[.,]\d+)?)\s*(?:m|met)(?:\s*(\d)(?!\d))?(?![a-z0-9])/.exec(kd);
    if (m) {
      const w = Number(m[1].replace(",", ".")) + (m[2] && !/[.,]/.test(m[1]) ? Number(m[2]) / 10 : 0);
      const theoRong = w >= 6 ? "hem_xe_tai" : w >= 3.5 ? "hem_xe_hoi" : w >= 3 ? "hem" : "hem_xe_may";
      if (w >= 1 && w <= 40 && theoRong !== ma) return "loai_duong_lech_be_rong";
    }
  }
  // "không có hẻm" / "xe hơi không vào" mà AI đưa loại hẻm có xe → ngược phủ định trong chính cụm trích.
  if (ma !== "mat_tien" && /\b(khong|ko|chang)\s+(co\s+)?hem\b/.test(kd)) return "trich_dan_noi_khong_co_hem";
  return null;
}
/** Năm xây: đúng một năm 1900…năm sau, có trong cụm trích. */
function kiemNamXay(v: string, kd: string): string | null {
  const n = chuanSo(v).match(/\b(19|20)\d{2}\b/)?.[0];
  if (!n) return "khong_phai_nam";
  if (Number(n) > new Date().getFullYear() + 1) return "nam_ngoai_khoang";
  return kd.includes(n) ? null : "so_khong_co_trong_trich_dan";
}

/** Một đề xuất đã qua lớp 1: kiểm lớp 2–3. Trả lý do bỏ, null là đạt. */
function kiemGiaTri(d: DeXuat, tin: string, viTri: number, kdCumSua?: string): string | null {
  const v = d.gia_tri.trim();
  const cum = d.trich_dan;
  const kd = kdCumSua ?? chuanSo(cum);
  if (!v) return "gia_tri_rong";
  switch (d.khoa) {
    case "gia": case "tien_coc": case "thu_nhap_thue": {
      const kdTin = chuanSo(tin);
      // "cọc 2 tháng" — tiền cọc tính bằng THÁNG, không phải số tiền.
      if (d.khoa === "tien_coc" && /\bthang\b/.test(chuanSo(v))) {
        const n = chuanSo(v).match(/\d+/)?.[0];
        return n && /\bcoc\b/.test(kd) && new RegExp(`\\b${n}\\s*thang\\b`).test(kd) ? null : "coc_thang_khong_khop_trich_dan";
      }
      // Đo bóng lần 2: "phí sang 350 triệu" thành tiền cọc — cọc phải có chữ cọc trong cụm.
      if (d.khoa === "tien_coc" && !/\b(coc|dat coc|ky quy)\b/.test(kd)) return "trich_dan_khong_noi_coc";
      const b = docTien(cum);
      if (b == null) return "khong_doc_duoc_tien";
      if (!tienKhop(v, b)) return docTien(v) == null && !/^\d+(?:[.,]\d+)?$/.test(v) ? "khong_doc_duoc_tien" : "tien_khong_khop_trich_dan";
      if (d.khoa === "gia") {
        // Lượt đo bóng 14/09: trích "phí sang 350 triệu" lọt vì chữ "phí sang" nằm TRONG cụm.
        if (/\b(coc|dat coc|phi sang|tien sang|hoa hong|phi moi gioi|(?<!thuong )luong|doanh thu)\b/.test(kd)) return "ngu_canh_coc_phi_hoa_hong";
        const truoc = kdTin.slice(Math.max(0, viTri - 30), viTri);
        if (TRUOC_KHONG_PHAI_GIA.test(truoc)) return "ngu_canh_coc_phi_hoa_hong";
        const sau = kdTin.slice(viTri + kd.length, viTri + kd.length + 12);
        const moiThang = /\b(thang|th)\b/.test(kd) || /^\s*(?:\/|mot|1|moi)?\s*(?:thang|th)\b/.test(sau);
        if (dealCauRao(kdTin) === "ban" && (TRUOC_LA_THUE.test(truoc) || moiThang)) return "tien_thue_khong_phai_gia_ban";
      }
      // Thu nhập thuê chỉ có ở căn BÁN đang cho thuê; "sang nhượng mặt bằng, thuê 60 triệu" là giá thuê.
      if (d.khoa === "thu_nhap_thue") {
        const truoc = kdTin.slice(Math.max(0, viTri - 30), viTri);
        // 21/09/2026 (bắn thật mau-v-08): "thu nhập 180 triệu/tháng" của toà CHDV bán là dòng tiền thuê.
        if (dealCauRao(kdTin) !== "ban" || !(/\b(dang|hien|hop dong|thu nhap|doanh thu|dong tien)\b/.test(kd) || TRUOC_LA_THUE.test(truoc) || /\b(dang|hien|hop dong)\s+(cho\s+)?thue\b/.test(truoc))) {
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
      // 24/09/2026 (bắn 10 tin): "toà nhà CHDV 20 phòng" / "20 phòng như em nói đó" thành 20 PHÒNG NGỦ — phòng cho thuê
      // không phải phòng ngủ. Phòng ngủ phải có chữ ngủ / PN trong cụm trích.
      if (!soTrong(cum, d.khoa === "dien_tich").some((x) => gan(n, x, 0.01, d.khoa === "dien_tich" ? 0.6 : 0.05))) return "so_khong_co_trong_trich_dan";
      if (d.khoa === "so_phong_ngu" && !/\b(ngu|pn|phong ngu)\b|\d\s*pn(?![a-z])/.test(kd)) return "khong_noi_phong_ngu";
      // 30/09/2026 (bắn thử vector): "nhà có 1 phòng ngủ ngay tầng trệt" — phòng ngủ theo TẦNG, không phải tổng số.
      return d.khoa === "so_phong_ngu" && soPhongNguTheoTang(tin).includes(n) ? "phong_ngu_theo_tang" : null;
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
      // SRS-5.1zq (03/10/2026, bộ đo S01): vùng NGOÀI TP.HCM — AI viết "Huyện Nhơn Trạch" / "Nhơn Trạch, Đồng Nai" cho cụm
      // "Nhơn Trạch Đồng Nai"; bản cũ chỉ nhận đúng chữ "Đồng Nai". Cùng một vùng (`vungNgoai`) là cùng ý.
      const muon = bocQuan(chuanSo(vv), vv) ?? vungNgoai(chuanSo(vv))?.ten ?? vv;
      return doc && chuanSo(doc) === chuanSo(muon) ? null : "quan_khong_khop_trich_dan";
    }
    case "phuong": {
      // 01/10/2026 (chủ dự án test Zalo): "ko có phường" → AI trả phường "ko có phường" và lọt luật tên dưới (chữ có trong tin,
      // có chữ "phường"). Không / không biết / không có không phải tên phường.
      if (KHONG_BIET_PHUONG.test(chuanSo(v)) || KHONG_BIET_PHUONG.test(chuanSo(cum))) return "phuong_khong_co_that";
      const so = chuanSo(v).match(/\d{1,2}/)?.[0];
      if (so) {
        const m = /(?:phuong|\bp)\s*\.?\s*(\d{1,2})\b/.exec(kd);
        return m && Number(m[1]) === Number(so) ? null : "phuong_khong_khop_trich_dan";
      }
      // 30/09/2026 (chủ dự án: "để AI nhận"): AI trả tên phường MỚI chuẩn (đổi cả tên cũ "Vĩnh Lộc B" → Tân Vĩnh Lộc) — máy
      // chỉ xác nhận: phường có thật VÀ trích dẫn nhắc nó (tên mới hoặc tên cũ, lệch 1–2 chữ cái).
      const chuan = phuongChuan(v) ?? phuongTuTenCu(v);
      if (chuan) return cauNhacPhuong(cum, chuan) ? null : "phuong_khong_khop_trich_dan";
      // Tên KHÔNG có thật mà trích dẫn lại nhắc một phường có thật → AI cắt / bịa tên ("An Hội" cho "an hội tây"): bỏ.
      if (phuongTrongTrich(cum)) return "phuong_khong_co_that";
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
    case "o_to_vao_nha": case "hoan_cong": case "thang_may": case "can_goc": return laCo(v) || laKhong(v) ? null : "gia_tri_ngoai_danh_sach";
    case "loai_duong_vao": return kiemLoaiDuongVao(v, kd);
    case "nam_xay": return kiemNamXay(v, kd);
    default: {
      // Trường chữ: giá trị phải NẰM TRONG cụm trích (model không được "diễn đạt lại").
      if (!(MOI_KHOA as readonly string[]).includes(d.khoa)) return "khoa_la";
      const cv = chuanSo(v);
      // FR-223 (bắn thật 24/09, rn-test-c): prompt dặn model VIẾT LẠI SẠCH, bỏ từ đệm ("chưa có sổ em, đang chờ ra sổ" →
      // "chưa có sổ, đang chờ ra sổ") mà luật này đòi giá trị nằm NGUYÊN trong cụm trích → loại, AI coi như im, câu trả lời
      // rơi vào bổ sung. Bỏ từ đệm / xưng hô ở CẢ HAI bên rồi so; không thêm chữ nào nên vẫn không bịa được.
      const boDem = (x: string) => x.replace(/\b(?:em|anh|chi|a|nha|nhe|nhen|oi|ha|nghen)\b/g, " ").replace(/\s+/g, " ").trim();
      // 03/10/2026 (chủ dự án: "độ rộng thì sẽ ghi 4m 4 mét, dạy AI đi"): địa chỉ KHÔNG mang bề rộng — "88 hẻm 6m Tân Kỳ Tân
      // Quý" → duong "88 hẻm Tân Kỳ Tân Quý". Bỏ cụm bề rộng (số + m/mét) khỏi cụm trích rồi so; chỉ BỚT chữ, không thêm.
      const boRong = (x: string) => x.replace(/\b(?:rong\s*)?\d+(?:[.,]\d+)?\s*(?:m|met)(?:\s*\d\b)?(?![a-z0-9])/g, " ").replace(/\s+/g, " ").trim();
      const laDiaChi = d.khoa === "duong" || d.khoa === "ten_duong";
      if (!(cv.length >= 2 && (kd.includes(cv) || (boDem(cv).length >= 2 && boDem(kd).includes(boDem(cv))) || (laDiaChi && boRong(kd).includes(cv))))) {
        // 17/09/2026 (chủ dự án: "AI đọc trước, trả kiến thức cho luật lưu"): pháp lý / nội thất
        // được CHUẨN HOÁ ("shr" → "sổ hồng riêng", "full nt" → "full nội thất") khi cả giá trị
        // lẫn cụm trích đọc ra CÙNG MỘT MÃ — vẫn không được bịa mã khác.
        const chuan = d.khoa === "phap_ly" ? (phapLyMa(v) != null && phapLyMa(v) === phapLyMa(cum))
          : d.khoa === "noi_that" ? (noiThatMa(v) != null && noiThatMa(v) === noiThatMa(cum))
          : false;
        if (!chuan) return "gia_tri_khong_nam_trong_trich_dan";
        return null;
      }
      // Lượt đo bóng 14/09: chữ có thật trong cụm nhưng SAI Ô — "view sông" vào hướng, "thổ cư
      // hết" vào pháp lý, "xây tự do" vào kết cấu, "Thảo Điền" (khu) vào dự án, "gấp" vào lý do bán.
      const hinh = HINH_TRUONG_CHU[d.khoa];
      if (hinh && !hinh.test(cv)) return "gia_tri_khong_dung_loai_truong";
      // 24/09/2026 (chủ dự án test Zalo): "Hợp đồng 10 năm cho thuê 4 năm rồi đó" thành pháp lý — chữ "hợp đồng" ở đây
      // là HỢP ĐỒNG THUÊ, không phải giấy tờ nhà. Pháp lý nói về thuê mà không có chữ giấy tờ nào → sai ô.
      if (d.khoa === "phap_ly" && /\bthue\b/.test(cv) &&
        !/\b(so|shr|shc|hdmb|mua ban|vi bang|giay tay|cong chung|sang ten|the chap|hoan cong)\b/.test(cv)) return "phap_ly_la_hop_dong_thue";
      if (d.khoa === "du_an" && !DAU_HIEU_DU_AN.test(kd)) return "khong_co_dau_hieu_du_an";
      return null;
    }
  }
}

// Chế độ `ai` (01/10/2026, chủ dự án: "bỏ luật, để AI bóc — biết từ đồng nghĩa, viết gần giống"): AI quyết NGHĨA của
// câu khách; máy chỉ chặn BỊA. Không soát từ khoá nữa ("xhr", "s.hồng riêng", "nhà ống", "căn góc 2 mặt hẻm" là việc của
// AI). Còn giữ: trích dẫn có trong tin (lớp 1, khớp mờ), tiền / số đọc ra từ chính cụm trích, giá trị nằm trong danh
// sách cho phép, quận / phường có thật. Công tắc `app_config.boc_tach_ai = 'ai'`, chat-reply bật qua `datKiemNhe`.
let KIEM_NHE = false;
export function datKiemNhe(b: boolean): void { KIEM_NHE = b; }
export function laKiemNhe(): boolean { return KIEM_NHE; }
const LOAI_GD = new Set(["ban", "cho_thue", "thue"]);
function tienCatThieu(tin: string, trich: string, b: number): boolean {
  const i = tin.toLowerCase().indexOf(trich.toLowerCase());
  if (i < 0) return false;
  const m = /^\s*(\d{1,3})(?![\d.,]|\s*(?:m\b|m2|m²|x|pn|wc|tầng|tang|lầu|lau|tấm|tam|phòng|phong|tỷ|tỉ|ty|ti|tỏi|toi|triệu|trieu|tr\b|năm|nam|tháng|thang|%))/iu
    .exec(tin.slice(i + trich.length, i + trich.length + 10));
  if (!m) return false;
  const b2 = docTien(`${trich} ${m[1]}`);
  return b2 != null && b2 !== b;
}
function kiemGiaTriNhe(d: DeXuat, tin: string, viTri: number, kdCumSua?: string): string | null {
  const v = d.gia_tri.trim();
  const kd = kdCumSua ?? chuanSo(d.trich_dan);
  if (!v) return "gia_tri_rong";
  if (v.length > 200) return "gia_tri_qua_dai";
  switch (d.khoa) {
    case "gia": case "tien_coc": case "thu_nhap_thue": {
      // Bắn thử 01/10 (lx-ai-12): "cọc 3 tháng" — tiền cọc tính bằng THÁNG, phép kiểm riêng của bản đầy đủ.
      if (d.khoa === "tien_coc" && /\bthang\b/.test(chuanSo(v))) return kiemGiaTri(d, tin, viTri, kdCumSua);
      const b = docTien(kdCumSua ?? d.trich_dan);
      if (b == null) return "khong_doc_duoc_tien";
      if (!tienKhop(v, b)) return "tien_khong_khop_trich_dan";
      // Bắn thử 01/10 (lx-ai-08): "3 tỏi 9 TL" → AI trích "3 tỏi" (giá 3 tỷ) và đẩy "9 TL" sang thương lượng. Ngay sau cụm
      // trích còn một số lẻ không đơn vị mà đọc gộp ra số tiền KHÁC → AI cắt thiếu, bỏ để luật tiền đọc nguyên cụm.
      if (tienCatThieu(tin, d.trich_dan, b)) return "tien_cat_thieu";
      return null;
    }
    case "gia_m2": case "so_tang": case "quan": case "phuong":
      // Phép tính (giá/m², trệt + lầu) và bảng địa danh có thật — không phải soát từ khoá, giữ nguyên.
      return kiemGiaTri(d, tin, viTri, kdCumSua);
    case "dien_tich": case "ngang": case "dai": case "no_hau": case "do_rong_hem": case "do_rong_duong":
    case "cach_mat_tien": case "so_phong_ngu": case "so_wc": case "tang": {
      const m = chuanSo(v).replace(/(\d)\s*m\s*([013-9])(?!\d)/g, "$1.$2").match(/\d+(?:\.\d+)?/);
      if (!m) return "khong_phai_so";
      const n = Number(m[0]);
      return soTrong(kdCumSua ?? d.trich_dan, d.khoa === "dien_tich").some((x) => gan(n, x, 0.01, d.khoa === "dien_tich" ? 0.6 : 0.05))
        ? null : "so_khong_co_trong_trich_dan";
    }
    case "loai_giao_dich": return LOAI_GD.has(v) ? null : "gia_tri_ngoai_danh_sach";
    case "loai_bds": {
      if (!LOAI_BDS[v]) return "gia_tri_ngoai_danh_sach";
      // Bắn thử 01/10 (lx-tam-12): "nhà 4 tầng" → AI ghi nha_cap4 (thấy số 4). Cấp 4 phải có chữ "cấp 4 / c4" trong tin.
      if (v === "nha_cap4" && !LOAI_BDS.nha_cap4.test(chuanSo(tin))) return "trich_dan_khong_noi_loai_nay";
      return null;
    }
    case "gap": case "thuong_luong": return laCo(v) || laKhong(v) ? null : "gia_tri_ngoai_danh_sach";
    case "o_to_vao_nha": case "hoan_cong": case "thang_may": case "can_goc": return laCo(v) || laKhong(v) ? null : "gia_tri_ngoai_danh_sach";
    case "loai_duong_vao": return kiemLoaiDuongVao(v, kd);
    case "nam_xay": return kiemNamXay(v, kd);
    default: {
      if (!(MOI_KHOA as readonly string[]).includes(d.khoa)) return "khoa_la";
      // Chữ AI viết lại được (chuẩn hoá, sửa chính tả, đổi từ đồng nghĩa) nhưng không được thêm CON SỐ khách không nói.
      const soTrich = new Set(kd.match(/\d+/g) ?? []);
      if (!(chuanSo(v).match(/\d+/g) ?? []).every((x) => soTrich.has(x))) return "so_khong_co_trong_trich_dan";
      // Bắn thử 01/10 (lx-ai-03): "xhr" → AI ghi PHÁP LÝ = "hẻm xe hơi". Soát HÌNH DẠNG GIÁ TRỊ AI viết (từ chuẩn của ô),
      // không soát chữ khách — sai ô thì bỏ.
      const hinh = HINH_TRUONG_CHU[d.khoa];
      return hinh && !hinh.test(chuanSo(v)) ? "gia_tri_khong_dung_loai_truong" : null;
    }
  }
}

/** Ô được hỏi lại xác nhận (chữ, khoá fact cùng tên). Không gồm số / tiền / địa danh — những ô đó có đường riêng. */
export const KHOA_XAC_NHAN = new Set(["phap_ly", "noi_that", "huong", "ket_cau", "hien_trang", "view"]);
export type GoiYXacNhan = { khoa: string; gia_tri: string; trich_dan: string };
/**
 * Chế độ `ai` (01/10/2026, chủ dự án: "xhr có thể người ta nhắn shr nhưng viết nhầm, có thể hỏi lại xác nhận"): AI đánh dấu chữ
 * viết tắt / gõ sai không chắc nghĩa kèm nghĩa đoán. Máy chỉ nhận khi cụm có trong tin, ô thuộc `KHOA_XAC_NHAN`, giá trị đúng hình
 * dạng ô và không thêm số. Trả gợi ý đầu tiên đạt, hoặc null.
 */
export function kiemXacNhan(ds: Array<{ khoa: string; gia_tri: string; trich_dan: string }> | null | undefined, tin: string): GoiYXacNhan | null {
  const kdTin = chuanSo(tin);
  for (const x of ds ?? []) {
    if (!x || typeof x.khoa !== "string" || typeof x.gia_tri !== "string" || typeof x.trich_dan !== "string") continue;
    if (!KHOA_XAC_NHAN.has(x.khoa)) continue;
    const v = x.gia_tri.trim(), cum = chuanSo(x.trich_dan);
    if (!v || v.length > 60 || cum.length < 2 || !` ${kdTin} `.includes(` ${cum} `)) continue;
    // Bắn thử 01/10 (lx-tam-22): khách gõ rõ "sổ hồng riêng" mà AI vẫn đánh dấu xác nhận → bot hỏi "Dạ "sổ hồng riêng" là sổ
    // hồng riêng đúng không ạ?". Chữ khách đã CHỨA nguyên giá trị thì không mơ hồ — không hỏi lại.
    if (` ${cum} `.includes(` ${chuanSo(v)} `)) continue;
    const soTrich = new Set(cum.match(/\d+/g) ?? []);
    if (!(chuanSo(v).match(/\d+/g) ?? []).every((n) => soTrich.has(n))) continue;
    const hinh = HINH_TRUONG_CHU[x.khoa];
    if (hinh && !hinh.test(chuanSo(v))) continue;
    return { khoa: x.khoa, gia_tri: v, trich_dan: x.trich_dan.trim() };
  }
  return null;
}

/**
 * Bắn thử 01/10 (lx-tt-08): đang hỏi phường, khách "shr" — AI xếp "shr" vào `xac_nhan` (không chắc nghĩa), mà nhánh câu
 * lệch không hỏi xác nhận → "🤖 Không bóc tách được gì", pháp lý trống. "shr" là viết tắt nghề CHUẨN, không mơ hồ.
 * Luật: HAI bộ đọc độc lập (AI + từ điển tiền định `docLuat`, vd `nhanDienNhieuFact`) cùng đọc cụm trích ra CÙNG một ô thì
 * không còn là chữ mơ hồ — đưa sang `truong` (giá trị chuẩn của AI). Chỉ AI thấy ("xhr") thì vẫn hỏi lại như cũ.
 * THUẦN: bộ đọc tiền định truyền vào, file này không gọi model / RPC.
 */
export function nangXacNhanChac(
  xacNhan: Array<{ khoa: string; gia_tri: string; trich_dan: string }> | null | undefined,
  tin: string,
  docLuat: (s: string) => Array<{ question: string; answer: string }>,
): { chac: DeXuat[]; conLai: Array<{ khoa: string; gia_tri: string; trich_dan: string }> } {
  const chac: DeXuat[] = [];
  const conLai: Array<{ khoa: string; gia_tri: string; trich_dan: string }> = [];
  for (const x of xacNhan ?? []) {
    const hop = kiemXacNhan([x], tin);
    if (hop && docLuat(hop.trich_dan).some((f) => f.question === hop.khoa)) chac.push({ ...hop });
    else conLai.push(x);
  }
  return { chac, conLai };
}

/** Kiểm cả loạt đề xuất của model cho MỘT tin khách. */
export function kiemDeXuat(deXuat: DeXuat[], tin: string): { dat: DeXuat[]; bo: Bo[] } {
  const kdTin = chuanSo(tin);
  const dat: DeXuat[] = [];
  const bo: Bo[] = [];
  for (let d of deXuat ?? []) {
    if (!d || typeof d.khoa !== "string" || typeof d.gia_tri !== "string" || typeof d.trich_dan !== "string") continue;
    const kdCum = chuanSo(d.trich_dan);
    let viTri = kdCum.length >= 2 ? kdTin.indexOf(kdCum) : -1;
    let kdDung: string | undefined;
    // 21/09/2026 (FR-208 g, học từ instructor CitationMixin): trích dẫn lệch ≤ 3 ký tự so với tin
    // (model gõ sai một chữ) thì KHỚP MỜ rồi dùng cụm thật để kiểm tiếp — chữ số phải y hệt, nên
    // "4x15" không bao giờ khớp mờ vào "4x16".
    if (viTri < 0) {
      const mo = timMo(kdTin, kdCum);
      if (mo) { viTri = mo.viTri; kdDung = mo.cum; }
    }
    if (viTri < 0) { bo.push({ ...d, ly_do: "trich_dan_khong_co_trong_tin" }); continue; }
    // 30/09/2026 (bắn thật lx-ban-a): "hẻm 45 Nguyễn Trãi" → AI ghi độ rộng hẻm 45m, bản nháp in "Đường vào: 45m".
    // 45 là SỐ HẺM (số nhà), không phải bề rộng — số có trong câu nên kiểm số lọt.
    if (d.khoa === "do_rong_hem" && laSoHemKhongPhaiDoRong(tin, d.gia_tri)) { bo.push({ ...d, ly_do: "so_hem_khong_phai_do_rong" }); continue; }
    // 27/09/2026: "Hxm" → AI "hẻm xe hơi" — loại đường vào ngược chữ khách nói rõ.
    if ((d.khoa === "do_rong_hem" || d.khoa === "do_rong_duong")) {
      const lt = loaiDuongNoiRo(kdDung ?? kdCum), la = loaiDuongNoiRo(chuanSo(d.gia_tri));
      if (lt && la && lt !== la) { bo.push({ ...d, ly_do: "loai_duong_nguoc_chu_khach" }); continue; }
    }
    // Chế độ `ai` (bắn thử 01/10, lx-ai-03): "3 lầu" → AI ghi so_tang 3 (quên trệt). Cụm trích nói trệt / lầu / tấm và
    // phép tính ra ĐÚNG MỘT số tầng → lấy số tính ra thay vì bỏ cả trường.
    // 03/10/2026 (đo lại S07, SRS-5.1zs): "3 tầng" → AI ghi 4 (áp luật "cộng trệt" của LẦU cho cả TẦNG) 2/3 lượt; lưới
    // chỉ sửa cho trệt/lầu/tấm nên bỏ cả trường, tin mất số tầng. "N tầng" cũng là một số tính ra được → sửa như trên.
    if (KIEM_NHE && d.khoa === "so_tang" && /\b(tret|lau|tam|tang)\b/.test(kdDung ?? kdCum)) {
      const st = soTangTrong(kdDung ?? d.trich_dan);
      if (st.length === 1 && String(st[0]) !== chuanSo(d.gia_tri).match(/\d+/)?.[0]) d = { ...d, gia_tri: String(st[0]) };
    }
    if (d.khoa === "ket_cau" && boPhuDinhKetCau(d.gia_tri) !== d.gia_tri.trim()) d = { ...d, gia_tri: boPhuDinhKetCau(d.gia_tri) };
    // 02/10/2026 (bắn lại thu-tay-01, SRS-5.1ze): "Nhà a 4 tầng tính cả lửng" → AI so_tang = 3 (đúng: 3 tầng không tính lửng), lưới
    // bỏ vì số 3 không có trong cụm → không ghi gì mà bot vẫn nói "em ghi rồi". Cụm có SỐ tấm/tầng + lửng nằm TRONG / có thêm lửng →
    // ghi kết cấu tính ra bằng cùng phép của câu hỏi lửng (`ketCauTheoLung`); một ô ket_cau, không ghi thêm so_tang lệch nghĩa.
    if (KIEM_NHE && (d.khoa === "so_tang" || d.khoa === "ket_cau")) {
      const cumL = d.trich_dan ?? "";
      const nL = soTangTrongDapLung(cumL), dapL = nL ? docTraLoiLung(cumL) : null;
      if (nL && (dapL === "co" || dapL === "them") && trichCoTrongTin(cumL, tin)) {
        if (!dat.some((x) => x.khoa === "ket_cau" || x.khoa === "so_tang")) dat.push({ ...d, khoa: "ket_cau", gia_tri: ketCauTheoLung(nL, dapL).floors_text, giu_gia_tri: true });
        continue;
      }
    }
    const ly = KIEM_NHE ? kiemGiaTriNhe(d, tin, viTri, kdDung) : kiemGiaTri(d, tin, viTri, kdDung);
    if (ly) bo.push({ ...d, ly_do: ly });
    else {
      // SRS-5.1zzr: cụm nguyên văn trong tin — ô nguyên văn ghi chính cụm này, không ghi chữ model soạn.
      const goc = cumGocTrongTin(tin, kdDung ?? kdCum);
      dat.push({ ...d, ...(kdDung ? { trich_dan_sua: kdDung } : {}), ...(goc ? { cum_goc: goc } : {}) });
    }
  }
  return { dat, bo };
}

/**
 * "hẻm 45 Nguyễn Trãi", "hẻm 12/3 Trần Phú", "hem 45 nguyen trai": con số ngay sau "hẻm" mà KHÔNG kèm đơn vị mét là
 * số hẻm khi nó có "/", hoặc ≥ 10, hoặc đứng trước một tên viết hoa (tên đường). "hẻm 4 xe hơi", "hẻm 6m", "hẻm 3.5"
 * vẫn là bề rộng. Chỉ bắt khi số trong giá trị AI đưa trùng đúng con số đó.
 */
export function laSoHemKhongPhaiDoRong(tin: string, giaTri: string): boolean {
  const n = Number(chuanSo(giaTri).match(/\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(n)) return false;
  for (const m of tin.matchAll(/(?:^|[^\p{L}])(?:hẻm|hem|hẽm|hxh|hxm)\s+(\d+)((?:\/\d+)*)(?![\d.,])\s*(\S*)/giu)) {
    if (Number(m[1]) !== n) continue;
    const sau = m[3] ?? "";
    if (/^(?:m\b|m\d|mét|met\b|m,|m\.)/i.test(sau) || /^m$/i.test(sau)) continue;
    if (m[2] || n >= 10 || /^\p{Lu}/u.test(sau)) return true;
  }
  return false;
}

/** Khoảng cách Levenshtein có trần: vượt `toiDa` thì trả toiDa + 1 sớm. */
function khoangCach(a: string, b: string, toiDa: number): number {
  if (Math.abs(a.length - b.length) > toiDa) return toiDa + 1;
  let truoc = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const hang = [i];
    let nhoNhat = i;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(truoc[j] + 1, hang[j - 1] + 1, truoc[j - 1] + c);
      hang.push(v);
      if (v < nhoNhat) nhoNhat = v;
    }
    if (nhoNhat > toiDa) return toiDa + 1;
    truoc = hang;
  }
  return truoc[b.length];
}

/**
 * Tìm cụm trong tin (cả hai đã `chuanSo`) gần `kdCum` nhất, lệch ≤ min(3, ⌊dài/6⌋) ký tự, bắt đầu và
 * kết thúc ở ranh giới từ, CÙNG dãy chữ số. Cụm ngắn (< 10 ký tự) không khớp mờ — quá dễ nhầm.
 */
function timMo(kdTin: string, kdCum: string): { viTri: number; cum: string } | null {
  if (kdCum.length < 10) return null;
  const toiDa = Math.min(3, Math.floor(kdCum.length / 6));
  const soCum = kdCum.replace(/\D+/g, "");
  let tot: { viTri: number; cum: string; d: number } | null = null;
  for (let dai = kdCum.length - toiDa; dai <= kdCum.length + toiDa; dai++) {
    if (dai < 1) continue;
    for (let i = 0; i + dai <= kdTin.length; i++) {
      if (i > 0 && kdTin[i - 1] !== " ") continue;
      if (i + dai < kdTin.length && kdTin[i + dai] !== " ") continue;
      const w = kdTin.slice(i, i + dai);
      if (w.replace(/\D+/g, "") !== soCum) continue;
      const d = khoangCach(w, kdCum, toiDa);
      if (d <= toiDa && (!tot || d < tot.d)) tot = { viTri: i, cum: w, d };
    }
  }
  return tot;
}

/** Tin có mùi DỮ LIỆU không (đáng một lượt model bóng) — "ok em", "dạ" thì không. */
export function coMuiDuLieuRao(tin: string): boolean {
  const kd = chuanSo(tin);
  if (kd.length < 4) return false;
  return /\d/.test(kd) ||
    /\b(ban|thue|nha|dat|can ho|chung cu|so|hem|duong|pho|phuong|quan|huyen|xa|huong|lau|tang|tret|gap|tl|thuong luong|noi that|mat tien|du an|phap ly|hoan cong|coc|view|tien)\b/.test(kd);
}

/**
 * FR-226 (25/09/2026, chủ dự án: "bắt theo nguyên cả câu của khách để AI đọc lại"): đang có câu chờ trả lời thì MỌI tin có
 * nội dung đều cho AI đọc — "hxh", "có sân thượng nữa em" từng bị cổng `coMuiDuLieuRao` bỏ qua (không số, không từ khoá).
 * Chỉ bỏ tin rỗng nghĩa: ok / dạ / vâng / ừ / cảm ơn / chào / emoji.
 */
const CHU_RONG = new Set(["ok", "oke", "okie", "okay", "da", "vang", "u", "uh", "um", "uk", "uhm", "a", "e", "em", "anh", "chi", "co", "chu", "bac",
  "cam", "on", "thanks", "thank", "tks", "chao", "hi", "hello", "nha", "nhe", "nhe", "roi", "duoc", "dc", "vay", "the", "ha", "hi", "hihi", "haha", "ạ"]);
export function coNoiDungTraLoi(tin: string): boolean {
  const tu = chuanSo(tin).split(/\s+/).filter(Boolean);
  return tu.some((t) => !CHU_RONG.has(t));
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
  // 23/09/2026: "chưa có sổ" là KHÔNG có sổ — cùng luật với `boc_thong_so` (20260923a).
  if (/\b(chua|khong|ko|chang|dang cho|dang lam|chua ra)\s+(co\s+|ra\s+|lam\s+)?(so|shr|shc)\b/.test(t)) return null;
  return /rieng|shr/.test(t) ? "so_hong_rieng" : /chung|shc|dong so huu/.test(t) ? "so_hong_chung"
    : /hdmb|hop dong mua ban/.test(t) ? "hdmb" : /vi bang|giay tay/.test(t) ? "giay_tay" : /so/.test(t) ? "so_hong" : null;
};
const noiThatMa = (v: string) => {
  const t = chuanSo(v);
  return /\b(full|day du|cao cap)\b/.test(t) ? "full" : /\b(co ban)\b/.test(t) ? "co_ban" : /\b(khong|trong|ko)\b/.test(t) ? "khong" : null;
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
      db = dong?.[COT_SO[k]]; const m = chuanSo(v).replace(/(\d)\s*m\s*([013-9])(?!\d)/g, "$1.$2").match(/\d+(?:\.\d+)?/);
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

// ── FR-208 bước 2 (17/09/2026): AI GHI CÓ KIỂM ─────────────────────────────────
// Chủ dự án 17/09: "lúc ghi có cái AI chuyển đổi câu trả lời thành chuẩn dữ liệu không" →
// "làm đi". Model bóc JSON theo đúng trường; ba lớp kiểm bằng chứng ở trên; rồi hàm này
// chọn thứ ĐƯỢC GHI: chỉ trường luật tiền định KHÔNG ghi (tin còn trống cột lẫn fact —
// `ai_them` của `soSanhVoiDb`), giá trị đọc ra được thành số/khoảng hợp lệ, và khoá có
// chỗ ghi tường minh trong `listing_facts` (trigger DB đưa vào cột). Không đè: `lech`
// (luật và AI khác nhau) không ghi.
export type DeGhi = { question: string; answer: string; khoa: string };

/** khoá AI → khoá fact (`required_facts.fact_key`). Không có trong bảng = không ghi. */
export const KHOA_GHI: Record<string, string> = {
  gia: "gia", dien_tich: "dien_tich", so_phong_ngu: "so_phong_ngu", so_wc: "so_wc", so_tang: "ket_cau",
  ket_cau: "ket_cau", tang: "tang", huong: "huong", phap_ly: "phap_ly", noi_that: "noi_that",
  ly_do_ban: "ly_do_ban", thoi_han_thue: "thoi_han_thue", phi_quan_ly: "phi_quan_ly", view: "view",
  hien_trang: "hien_trang", do_rong_hem: "do_rong_hem", do_rong_duong: "do_rong_duong",
  cach_mat_tien: "cach_mat_tien", tien_coc: "tien_coc", phuong: "phuong", gap: "gap", thuong_luong: "thuong_luong",
  // 21/09/2026 (bắn lại mau-u-03): AI đọc đúng "thu nhập 120 triệu/tháng" nhưng không có chỗ ghi →
  // vào fact `doanh_thu` (ô luật vẫn dùng cho toà nhà / CHDV; `diem_tin` đếm ô này).
  thu_nhap_thue: "doanh_thu",
  // Đợt 1 (02/10/2026): khoá trước đây chỉ luật ghi — khoá fact cùng tên.
  ...Object.fromEntries(KHOA_O.map((k) => [k, k])),
};
/** Khoảng hợp lệ cho trường số (đơn vị của cột). Ngoài khoảng = không ghi, kèm lý do. */
const KHOANG: Record<string, [number, number]> = {
  dien_tich: [5, 100000], so_phong_ngu: [1, 50], so_wc: [1, 50], so_tang: [1, 80], tang: [1, 80],
  do_rong_hem: [0.5, 60], do_rong_duong: [0.5, 60], cach_mat_tien: [1, 3000],
};
const soCua = (v: string): number | null => {
  const m = chuanSo(v).replace(/(\d)\s*m\s*([013-9])(?!\d)/g, "$1.$2").match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};
const hoaDau = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Từ đề xuất ĐẠT + kết quả so DB → danh sách fact được ghi (nguồn `ai_kiem`).
 * `dong` là dòng tin sau khi luật đã ghi; `facts` là fact hiện có của tin.
 */
export function chonDeGhi(dat: DeXuat[], soSanh: SoSanh, dong: DongDb | null, facts: Record<string, string>): { ghi: DeGhi[]; bo: Bo[] } {
  const ghi: DeGhi[] = [];
  const bo: Bo[] = [];
  const them = new Set(soSanh.ai_them.map((x) => x.khoa));
  const daGhi = new Set<string>();
  const co = (k: string) => facts[k] != null && facts[k] !== "";
  // 05/10/2026 (SRS-5.1zz, soát luật): so_tang và ket_cau cùng đổ về fact ket_cau, trước đây khoá AI liệt kê TRƯỚC thắng —
  // prompt liệt kê so_tang trước nên "3 tầng" đè mất cụm "trệt 2 lầu". Cụm chữ là ô chính: xét ket_cau trước, so_tang thành fact_da_co.
  const datThuTu = [...dat.filter((d) => d.khoa === "ket_cau"), ...dat.filter((d) => d.khoa !== "ket_cau")];
  const loaiNv = loaiChoNguyenVan(dong, dat);
  for (const d of datThuTu) {
    if (d.can != null && d.can > 1) continue;
    if (!them.has(d.khoa)) continue; // luật đã ghi (trùng hay lệch) → AI không đụng
    const question = KHOA_GHI[d.khoa];
    if (!question) { bo.push({ ...d, ly_do: "khoa_khong_co_cho_ghi" }); continue; }
    if (daGhi.has(question) || co(question)) { bo.push({ ...d, ly_do: "fact_da_co" }); continue; }
    const v = d.gia_tri.trim();
    const kd = chuanSo(d.trich_dan);
    let answer: string | null = null;
    // 24/09/2026: "thời hạn thuê tối thiểu" là điều kiện của tin CHO THUÊ; tin BÁN đang có người thuê thì đó là hợp đồng
    // đang chạy (câu hỏi nhánh `han_hop_dong_thue`) — model từng ghi "4 năm" từ "hợp đồng 10 năm cho thuê 4 năm rồi".
    if (d.khoa === "thoi_han_thue" && dong?.deal && dong.deal !== "cho_thue") { bo.push({ ...d, ly_do: "thoi_han_thue_chi_cho_tin_thue" }); continue; }
    switch (d.khoa) {
      case "gia": {
        const t = docTien(v) ?? docTien(d.trich_dan);
        const thue = dong?.deal === "cho_thue";
        if (t == null) { bo.push({ ...d, ly_do: "khong_doc_duoc_tien" }); continue; }
        if (thue ? (t < 1e6 || t > 1e10) : (t < 1e8 || t > 1e12)) { bo.push({ ...d, ly_do: "gia_ngoai_khoang" }); continue; }
        answer = v;
        break;
      }
      case "thu_nhap_thue": {
        const t = docTien(v) ?? docTien(d.trich_dan);
        if (t == null || t < 1e6 || t > 1e10) { bo.push({ ...d, ly_do: "khong_doc_duoc_tien" }); continue; }
        answer = v;
        break;
      }
      case "tien_coc": {
        if (/\bthang\b/.test(chuanSo(v))) { answer = v; break; }
        const t = docTien(v);
        if (t == null || t < 1e5 || t > 1e11) { bo.push({ ...d, ly_do: "khong_doc_duoc_tien" }); continue; }
        answer = v;
        break;
      }
      case "dien_tich": {
        // Sàn / sử dụng / tổng-của-nhà-có-tầng / tim tường KHÔNG phải diện tích đất — luật tiền
        // định cố ý để trống `area_m2` (16/09: "diện tích tổng 240m2" của nhà 4 tấm).
        if (/\b(san|su dung|tong|xay dung|tim tuong)\b/.test(kd) || co("dien_tich_san") || co("dien_tich_dat") || co("dien_tich_tim_tuong")) {
          bo.push({ ...d, ly_do: "dien_tich_khong_phai_dat" }); continue;
        }
        const n = soCua(v);
        if (n == null || n < KHOANG.dien_tich[0] || n > KHOANG.dien_tich[1]) { bo.push({ ...d, ly_do: "so_ngoai_khoang" }); continue; }
        answer = `${n}m2`;
        break;
      }
      case "so_phong_ngu": case "so_wc": case "tang": case "do_rong_hem": case "do_rong_duong": case "cach_mat_tien": {
        const n = soCua(v);
        const [a, b] = KHOANG[d.khoa];
        if (n == null || n < a || n > b) { bo.push({ ...d, ly_do: "so_ngoai_khoang" }); continue; }
        answer = d.khoa === "do_rong_hem" || d.khoa === "do_rong_duong" || d.khoa === "cach_mat_tien" ? `${n}m` : String(n);
        break;
      }
      case "so_tang": {
        const n = soCua(v);
        if (n == null || n < 1 || n > 80) { bo.push({ ...d, ly_do: "so_ngoai_khoang" }); continue; }
        answer = `${n} tầng`;
        break;
      }
      case "phuong": {
        const so = chuanSo(v).match(/\d{1,2}/)?.[0];
        if (so) { if (Number(so) < 1 || Number(so) > 30) { bo.push({ ...d, ly_do: "so_ngoai_khoang" }); continue; } answer = `Phường ${Number(so)}`; break; }
        // Phường có thật (đã qua kiểm) → ghi đúng tên đầy đủ trong danh sách ("Xã Tân Vĩnh Lộc").
        const chuanP = phuongChuan(v) ?? phuongTuTenCu(v);
        if (chuanP) { answer = tenDayDu(chuanP); break; }
        const ten = v.replace(/^(phường|phuong|xã|xa|thị trấn|thi tran|p\.?)\s+/i, "").trim();
        if (ten.length < 3 || ten.length > 40) { bo.push({ ...d, ly_do: "gia_tri_ngoai_khoang" }); continue; }
        // 24/09/2026 (bắn 10 tin, Củ Chi / Bình Chánh): "xã Phước Vĩnh An" từng ghi thành "Phường Phước Vĩnh An" — giữ
        // đúng cấp hành chính khách nói (xã / thị trấn).
        const cap = /\b(?:thi tran|tt)\b/.test(kd) || /^(?:thị trấn|thi tran)\b/i.test(v) ? "Thị trấn"
          : /\bxa\b/.test(kd) || /^(?:xã|xa)\b/i.test(v) ? "Xã" : "Phường";
        answer = `${cap} ${hoaDau(ten)}`;
        break;
      }
      case "phi_quan_ly": {
        // 30/09/2026 (bắn thử bán lx-ban-292b): "phí quản lý 15k/m2" → AI "15 nghìn" — mất "/m2", phí cả căn khác hẳn phí mỗi m².
        // Chữ khách có đơn vị mà giá trị AI không có → giữ đúng cụm khách nói.
        const coDv = (x: string) => /\/\s*(?:m2|m²|m\b|thang|tháng)|\bm2\b|m²/iu.test(x);
        const cum = d.trich_dan.replace(/^.*?(?:phí|phi)\s*(?:quản lý|quan ly|ql)\s*(?:là|la|:)?\s*/iu, "").trim();
        answer = coDv(d.trich_dan) && !coDv(v) && cum.length >= 2 && cum.length <= 60 ? cum : v;
        if (answer.length < 1 || answer.length > 120) { bo.push({ ...d, ly_do: "gia_tri_ngoai_khoang" }); continue; }
        break;
      }
      case "gap": case "thuong_luong": {
        // 02/10/2026 (đợt 1): AI đã nói có / không (qua kiểm) → ghi CHỮ CHUẨN, trigger DB đọc ra đúng cột. Trước đây ghi cụm
        // khách nói rồi để regex DB đọc lại — "bớt lộc" không khớp regex nên cột thương lượng trống dù AI đã nói "co".
        answer = laCo(v) ? (d.khoa === "gap" ? "cần bán gấp" : "có thương lượng")
          : laKhong(v) ? (d.khoa === "gap" ? "không gấp" : "không thương lượng")
          : d.trich_dan.trim();
        break;
      }
      case "o_to_vao_nha": case "hoan_cong": case "thang_may": case "can_goc": {
        answer = laCo(v) ? "có" : laKhong(v) ? "không" : null;
        if (!answer) { bo.push({ ...d, ly_do: "gia_tri_ngoai_danh_sach" }); continue; }
        break;
      }
      case "loai_duong_vao": {
        answer = LOAI_DUONG_VAO[v] ?? null;
        if (!answer) { bo.push({ ...d, ly_do: "gia_tri_ngoai_danh_sach" }); continue; }
        break;
      }
      case "nam_xay": {
        answer = chuanSo(v).match(/\b(19|20)\d{2}\b/)?.[0] ?? null;
        if (!answer) { bo.push({ ...d, ly_do: "khong_phai_nam" }); continue; }
        break;
      }
      default: {
        if (v.length < 2 || v.length > 120) { bo.push({ ...d, ly_do: "gia_tri_ngoai_khoang" }); continue; }
        // 02/10/2026 (lx-t5-05: "xe container vào tận nơi em"): cùng cách gọn chữ đệm với luật.
        // Ô dạng câu có / không (xe container vào được không, lên thổ cư được không…) mà AI trả mã "co" / "khong" (lx-t6-01:
        // ô xe container ghi "co") → chữ có dấu.
        // SRS-5.1zzr: ô nguyên văn theo loại → ghi đúng cụm khách gõ, model chỉ chỉ ra cụm.
        const nv = laONguyenVan(loaiNv, question) ? giaTriNguyenVan(question, d) : null;
        answer = nv ?? (laCo(v) ? "có" : laKhong(v) ? "không" : gonGiaTriFact(question, v));
      }
    }
    if (!answer) continue;
    daGhi.add(question);
    ghi.push({ question, answer, khoa: d.khoa });
  }
  return { ghi, bo };
}

/** Câu bot đang hỏi → khoá AI trả lời được cho câu đó (ngoài `KHOA_GHI` đảo ngược). */
const AI_CHO_CAU: Record<string, string[]> = {
  dien_tich_dat: ["dien_tich"], dien_tich_tim_tuong: ["dien_tich"], mat_tien: ["ngang"], vi_tri: ["duong"],
};

/**
 * AI ĐỌC TRƯỚC, luật lưu (17/09/2026): giá trị AI (đã qua kiểm bằng chứng) cho ĐÚNG câu bot
 * đang hỏi, qua thêm kiểm khoảng của `chonDeGhi`. null = AI không có / không đạt.
 */
/**
 * Chọn VỊ TRÍ giữa bản LUẬT và bản AI (22/09/2026, bắn thật sau deploy #181): AI được dặn trả `duong`
 * là TÊN ĐƯỜNG trần đã phục hồi dấu ("Trần Hưng Đạo"), luật giữ cả cụm ("hẻm 6m 12 Trần Hưng Đạo").
 * Chế độ `chinh` lấy AI trước nên SỐ NHÀ "12" rơi khỏi tin. Ghép: số nhà đứng ngay trước tên đường
 * trong bản luật + tên đường của AI ("12 Trần Hưng Đạo") — giữ được dấu AI phục hồi (21/09: "ai không
 * biết được tên đường hả") lẫn số nhà luật đọc. Hẻm / phường vẫn đi ô riêng như thiết kế. Luật không
 * chứa tên AI đọc (AI sửa chính tả) hay không có số nhà → tin AI như cũ.
 */
/**
 * 03/10/2026 (bắn thử thu-dc-04/06/08, SRS-5.1zj): tên đường bằng SỐ / MÃ ("3/2", "30/4", "D2", "N1", "59", "số 7") — AI đọc đúng
 * nhưng các ngưỡng độ dài địa chỉ (≥ 4 ký tự, hoặc ≥ 6 / hai chữ ở chỗ tạo tin) gạt mất, tin không có đường. Ghi đủ "đường 3/2"
 * — đọc ra là đường, và qua ngưỡng. Tên đường bằng chữ giữ nguyên.
 */
export function tenDuongDayDu(v: string): string {
  const t = (v ?? "").trim();
  if (/^(?:số\s*|so\s*)?[A-Za-zĐđ]?\d{1,4}[A-Za-z]?(?:\/\d{1,2})?$/u.test(t)) return `đường ${t}`;
  return t;
}

export function chonViTri(luat: string | null | undefined, ai: string | null | undefined): string | null {
  const l = luat?.trim() || null, a = ai?.trim() || null;
  if (!a) return l;
  if (!l) return a;
  const gon = (x: string) => boDau(x).replace(/\s+/g, " ").trim();
  const lk = gon(l), ak = gon(a);
  // 22/09/2026 (bắn thật căn hộ): "Hung Vuong Plaza 126 Hung Vuong" — tên đường xuất hiện HAI lần, lần đầu là
  // tên dự án không có số nhà; xét MỌI lần xuất hiện, lấy lần có số nhà ("12", "123/4", "số 12", "12a") đứng ngay trước.
  for (let i = lk.indexOf(ak); i >= 0; i = lk.indexOf(ak, i + 1)) {
    const truoc = lk.slice(0, i);
    // Chữ đuôi số nhà là a/b/c…, KHÔNG phải "m" (mét): "hẻm 4m Phạm Thế Hiển" là độ rộng hẻm, không phải số nhà.
    const m = /(?:^|\s)(?:so\s*)?(\d{1,4}[a-ln-z]?(?:\/\d{1,4}[a-z]?)*)\s*$/.exec(truoc);
    if (!m) continue;
    // "hẻm 4 Trần…" (số nhỏ ≤ 12 ngay sau chữ hẻm, không có "/") mập mờ giữa hẻm số 4 và hẻm rộng 4 → tin AI.
    // Cắt tới ĐẦU con số (bản cũ cộng cả khoảng trắng phía sau nên cắt lẹm vào số, luật "hẻm 4 …" không bao giờ chạy).
    const truocSo = truoc.slice(0, m.index + m[0].indexOf(m[1]));
    if (/\bhem\s*(?:rong\s*)?$/.test(truocSo) && !m[1].includes("/") && Number(m[1]) <= 12) continue;
    // 30/09/2026 (bắn thật lx-ban-a): "hẻm 45 Nguyễn Trãi" ghép thành "45 Nguyễn Trãi" — mất chữ hẻm, bản nháp đọc như
    // nhà mặt tiền số 45. Số đứng sau "hẻm" thì giữ chữ hẻm.
    return /\bhem\s*$/.test(truocSo) ? `hẻm ${m[1]} ${a}` : `${m[1]} ${a}`;
  }
  // 01/10/2026 (bắn thật lx-tam-32): "số 12 hẻm 4m Trần Bình Trọng" — luật đọc "12 hẻm 4m Trần Bình Trọng", AI trả tên đường
  // trần (số 12 xếp nhầm thành mã căn) → địa chỉ chỉ còn "Trần Bình Trọng". Số nhà không đứng NGAY trước tên đường nên vòng
  // trên bỏ qua. Bản luật CHỨA bản AI mà phần thêm là số nhà / hẻm / "đường" (địa chỉ, không phải lời kể) → lấy luật.
  // Lấy PHẦN TRƯỚC tên đường của luật (có SỐ NHÀ thật — số không đuôi "m") ghép với tên đường của AI (AI có dấu, đúng chính tả).
  const iA = lk.indexOf(ak);
  if (iA > 0 && iA + ak.length === lk.length) {
    const truocK = lk.slice(0, iA).trim();
    // Số nhà = một chữ số KHÔNG đứng ngay sau "hẻm / kiệt / ngõ" ("hẻm 4 Trần Phú" mập mờ số hẻm / bề rộng → để AI).
    const tuK = truocK.split(" ");
    // 03/10/2026 (bắn thử thu-dc-12): "hẻm 18/5 đường Cách Mạng Tháng 8" — số sau "hẻm" có "/" (hoặc > 12) không mập mờ với bề
    // rộng, là số hẻm thật: giữ (trước đây bị gạt, địa chỉ chỉ còn tên đường).
    const coSoNha = tuK.some((t, j) => /^\d{1,5}[a-ln-z]?(?:\/\d{1,5}[a-z]?)*$/.test(t) &&
      (!/^(?:hem|kiet|ngo|hxh)$/.test(tuK[j - 1] ?? "") || t.includes("/") || Number(t) > 12));
    if (coSoNha && l.length === lk.length) {
      return `${l.slice(0, iA).trim()} ${a}`;
    }
  }
  return a;
}

export function giaTriChoCauTreo(dat: DeXuat[], cauHoi: string, dong: DongDb | null): string | null {
  const mot = dat.filter((d) => !(d.can != null && d.can > 1));
  // 21/09/2026 (chế độ `chinh`): ngang / dài KHÔNG có ô fact riêng (`KHOA_GHI`), nên câu MẶT TIỀN
  // ("ngang 4 dài 16") và câu DIỆN TÍCH trả lời bằng "5x20" từng trả null. Nay ghép như luật:
  // mặt tiền → "ngang Am dài Bm" (DB đọc hai chiều), diện tích chưa nói mà có ngang×dài → "AxB".
  const kt = kichThuoc(mot);
  if (cauHoi === "mat_tien") return kt.ngang != null ? (kt.dai != null ? `ngang ${kt.ngang}m dài ${kt.dai}m` : `${kt.ngang}m`) : null;
  // 21/09/2026 (Zalo thật, chủ dự án: "ai không biết được tên đường hả"): câu VỊ TRÍ lấy `duong` AI đọc
  // (đã phục hồi dấu theo luật prompt) — luật `catDapAn` từng ghi cả câu "nhà của anh ở hem 4m Pham
  // The Hien, P.4" làm địa chỉ. Hẻm / phường đi ô riêng, không ghép vào.
  if (cauHoi === "vi_tri") {
    // SRS-5.1zzr: ô nguyên văn — cụm khách gõ trước, chữ model chỉ khi không ra cụm.
    const dD = mot.find((x) => x.khoa === "duong");
    const d = giaTriNguyenVan("vi_tri", dD) ?? tenDuongDayDu(dD?.gia_tri ?? "");
    return d.length >= 4 && d.length <= 80 ? d : null;
  }
  const khoaAi = new Set([...(AI_CHO_CAU[cauHoi] ?? []), ...Object.entries(KHOA_GHI).filter(([, q]) => q === cauHoi).map(([k]) => k)]);
  const loc = mot.filter((d) => khoaAi.has(d.khoa));
  if (!loc.length) {
    if (/^dien_tich(_dat)?$/.test(cauHoi)) {
      // 24/09/2026 (chủ dự án test Zalo): "dài 16m" khi tin đã có ngang 5 → 5x16 (chiều kia lấy trong tin).
      const soDb = (v: unknown) => { const x = v == null ? NaN : Number(v); return Number.isFinite(x) && x > 0 ? x : null; };
      // Chỉ "dài" nối vào "ngang" đã có — cùng luật `ghepMotChieu` (khop-cau-tra-loi.ts).
      const ng = kt.ngang ?? (kt.dai != null ? soDb(dong?.frontage_m) : null);
      const da = kt.dai;
      if (ng != null && da != null) return `${ng}x${da}`;
    }
    return null;
  }
  const { ghi } = chonDeGhi(loc, { trung: [], lech: [], ai_them: loc.map((d) => ({ khoa: d.khoa, ai: d.gia_tri })) }, dong, {});
  return ghi[0]?.answer ?? null;
}

/**
 * FR-224 (25/09/2026, chủ dự án: "bắt theo nguyên cả câu của khách để AI đọc lại"): AI đọc NGUYÊN tin, trả lời thẳng
 * câu bot đang hỏi (`tra_loi`). Code chỉ kiểm hai điều: trích dẫn có thật trong tin (khớp đúng hoặc mờ như `kiemDeXuat`),
 * và MỌI con số trong câu trả lời có trong tin (AI không được đổi "trệt 2 lầu" thành "3 tầng"). Không đạt → `giaTri` null
 * (AI vẫn nói là CÓ trả lời — nơi gọi để luật đọc). null = AI không nói gì về câu đang hỏi.
 */
export type TraLoiCau = { co_tra_loi: boolean; gia_tri: string | null; trich_dan: string | null };
export function kiemTraLoiCau(
  tl: TraLoiCau | null | undefined, tin: string, cauBotVuaHoi: string | null = null,
  /** SRS-5.1zzr: câu đang hỏi + loại BĐS → ô nguyên văn thì trả cụm khách gõ thay vì câu model soạn. */
  o: { cauHoi: string; loai?: string | null } | null = null,
): { co: boolean; giaTri: string | null } | null {
  if (!tl || typeof tl.co_tra_loi !== "boolean") return null;
  if (!tl.co_tra_loi) return { co: false, giaTri: null };
  // 01/10/2026 (bắn thử lx-tt-11): bot hỏi "cần ra hàng gấp hay được giá thì thôi?", khách "ừ" → AI ghi "được giá thì thôi".
  // Câu CHỌN MỘT TRONG HAI mà cả tin chỉ là lời ừ / gật → không có căn cứ cho vế nào. Kiểm bằng chứng, không đoán ý.
  if (laCauChonHai(cauBotVuaHoi) && laChiGat(tin)) return { co: false, giaTri: null };
  const v = (tl.gia_tri ?? "").trim().replace(/[\s.]+$/, "");
  // Dấu chấm không nằm giữa hai chữ số ("hxh.") là dấu câu — bỏ, để so theo ranh giới từ.
  const gon = (x: string) => chuanSo(x).replace(/\.(?!\d)|(?<!\d)\./g, " ").replace(/\s+/g, " ").trim();
  const td = gon(tl.trich_dan ?? "");
  const kdTin = gon(tin);
  if (!v || v.length > 160 || !td) return { co: true, giaTri: null };
  if (!` ${kdTin} `.includes(` ${td} `) && !timMo(kdTin, td)) return { co: true, giaTri: null };
  // Số phải nằm trong CỤM TRÍCH, không chỉ đâu đó trong tin (bắn thật lx-21 25/09: "hxh, 5x12, trệt 3 lầu" khi hỏi hẻm →
  // AI trả "hẻm xe hơi 5 mét", số 5 là chiều ngang).
  const soTrich = new Set(td.match(/\d+/g) ?? []);
  if ((chuanSo(v).match(/\d+/g) ?? []).some((n) => !soTrich.has(n))) return { co: true, giaTri: null };
  // 27/09/2026 (chủ dự án test Zalo): hỏi hẻm, khách "Hxm nhé" → AI trả "hẻm xe hơi" (trích "Hxm") và lọt vì lớp kiểm chỉ
  // soát CHỮ SỐ. Loại đường vào khách nói rõ (hxm / xe máy · hxh / xe hơi / ô tô · hxt / xe tải) mà AI nói loại khác → bỏ.
  // SRS-5.1zzzb (07/10/2026, chat thử): soi loại đường trong CỤM TRÍCH, không phải cả tin — hỏi "vướng cột điện gì không", khách
  // "không có mặt tiền đẹp em", AI trích "không có" → chữ "mặt tiền" ở phần ý thêm từng làm câu trả lời bị bác, cả câu rơi bổ sung.
  const loaiTin = loaiDuongNoiRo(td);
  const loaiAi = loaiDuongNoiRo(gon(v));
  if (loaiTin && loaiTin !== loaiAi && (loaiAi || loaiTin === "mat_tien")) return { co: true, giaTri: null };
  // SRS-5.1zzu (06/10/2026, bắn lại thu-ai-0610): hỏi độ rộng hẻm, khách "anh đứng tên, không thế chấp" → AI nói CÓ trả lời, giá
  // trị là nguyên câu → ghi vào ô hẻm, bản nháp in "Đường vào: anh đứng tên, không thế chấp". Trích dẫn có trong tin, không có
  // con số nào để so — hai lớp kiểm trên đều qua. Ô ĐO ĐẾM thì giá trị phải mang SỐ (ô hẻm nhận thêm loại đường / chữ hẻm, ô
  // phí / cọc nhận "không có / miễn phí"); không → AI nói có mà không qua kiểm, để luật đọc (câu vẫn treo).
  if (o && !giaTriHopKieu(o.cauHoi, v)) return { co: true, giaTri: null };
  // 30/09/2026 (bắn thử bán lx-ban-292b): hỏi phí quản lý, "phí quản lý 15k/m2" → AI "15 nghìn" — mất "/m2". Cụm trích có
  // đơn vị "/m2 · /tháng · /năm" mà giá trị AI không có → gắn lại đúng đơn vị khách nói.
  // SRS-5.1zzr: ô nguyên văn theo loại → giá trị là cụm khách gõ (đã kiểm có trong tin ở trên), không phải câu model.
  if (o && laONguyenVan(o.loai ?? null, o.cauHoi)) {
    const nv = giaTriNguyenVan(o.cauHoi, { khoa: o.cauHoi, gia_tri: v, trich_dan: tl.trich_dan ?? "", cum_goc: cumGocTrongTin(tin, td) ?? undefined });
    if (nv) return { co: true, giaTri: nv };
  }
  const dv = /\/\s*(m2|m²|tháng|thang|năm|nam)(?![\p{L}\d])/iu.exec(tl.trich_dan ?? "")?.[1];
  if (dv && /\d/.test(v) && !/\/\s*[\p{L}\d]/u.test(v) && !/(?:m2|m²)(?![\p{L}\d])/iu.test(v)) return { co: true, giaTri: `${v}/${dv}` };
  return { co: true, giaTri: v };
}
/**
 * SRS-5.1zzu: ô ĐO ĐẾM — câu trả lời AI đưa cho ô này phải mang chữ số (sau `chuanSo`). Ngoại lệ theo ô: hẻm nhận loại đường
 * nói rõ (hxh / xe hơi / mặt tiền…) hoặc chữ "hẻm / đường / mặt tiền"; phí / cọc / thời hạn nhận "không có / không thu / miễn
 * phí / thoả thuận". Ô chữ (pháp lý, hướng, kết cấu…) không qua đây. Muốn thêm ô đo đếm thì thêm vào bảng, đừng vá từng chỗ.
 */
const CAU_CAN_SO = new Set(["do_rong_hem", "so_phong_ngu", "so_wc", "so_tang", "tang", "nam_xay", "phi_quan_ly", "phi_gui_xe", "tien_coc",
  "thoi_han_thue", "gia_dien_nuoc", "cach_mat_tien", "chieu_cao", "tai_trong_san", "so_phong", "ty_le_lap_day", "doanh_thu", "mat_tien"]);
const CAU_CHO_KHONG_CO = new Set(["phi_quan_ly", "phi_gui_xe", "tien_coc", "thoi_han_thue", "gia_dien_nuoc", "cach_mat_tien", "doanh_thu"]);
export function giaTriHopKieu(cauHoi: string, v: string): boolean {
  if (!CAU_CAN_SO.has(cauHoi)) return true;
  const kd = boDauKiem(chuanSo(v)).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (/\d/.test(kd)) return true;
  if (cauHoi === "do_rong_hem") return !!loaiDuongNoiRo(kd) || /\b(?:hem|duong|mat tien|xe hoi|o to|oto|xe may|xe tai)\b/.test(kd);
  if (CAU_CHO_KHONG_CO.has(cauHoi)) return /\b(?:khong (?:co|thu|ton|mat|can|lay|tinh|rang buoc)|mien phi|free|thoa thuan|tuy)\b/.test(kd);
  return false;
}
/**
 * SRS-5.1zzw (06/10/2026, bắn lại thu-ai-0610 lần 3 và 4): MỘT CỤM CHỮ CHỈ TRẢ LỜI MỘT Ô. Hỏi hẻm (13:30) rồi hỏi gấp (14:20), khách
 * cùng một câu "anh đứng tên, không thế chấp" → AI nói CÓ trả lời câu đang hỏi, trích nguyên câu → ô hẻm / ô gấp nhận nguyên câu,
 * trong khi chính lượt đó cụm "anh đứng tên" đã vào ô đứng tên, "không thế chấp" vào ô thế chấp. Lớp kiểm cũ chỉ hỏi "cụm có thật
 * trong tin không", không hỏi "cụm đó có đang là câu trả lời của ô KHÁC không".
 * Gỡ khỏi cụm trích của câu trả lời mọi cụm mà cùng lượt đã gán cho ô KHÁC (đề xuất AI có trích dẫn + fact luật đọc ra); còn lại
 * chỉ là tiểu từ / dấu câu → câu trả lời không thuộc ô đang hỏi. Không xét từ khoá của ô nào — áp cho mọi ô.
 */
// Chỉ xưng hô, tiểu từ cuối câu, từ nối. KHÔNG có chữ tự nó là câu trả lời có / không ("có", "rồi", "dạ", "ừ", "ok", "vâng") — còn
// một chữ đó sau khi gỡ thì vẫn có thể là câu trả lời ("có, sổ hồng riêng" khi hỏi gấp), không gạt.
const TIEU_TU_TRA_LOI = new Set(["a", "anh", "chi", "em", "e", "chu", "bac", "ong", "ba", "minh", "toi", "tui", "nha", "nhe", "nhen", "ne", "nghe",
  "ha", "hen", "oi", "day", "thi", "la", "va", "voi", "con", "ma", "nua", "luon", "cai", "do", "nay", "the", "vay"]);
export function traLoiThuocOKhac(
  trich: string | null | undefined, cauHoi: string, dat: readonly DeXuat[], luat: ReadonlyArray<{ question: string; answer: string }>,
): boolean {
  if (!trich?.trim()) return false;
  const khoaCau = new Set([cauHoi, ...(AI_CHO_CAU[cauHoi] ?? []), ...Object.entries(KHOA_GHI).filter(([, q]) => q === cauHoi).map(([k]) => k)]);
  const gon = (s: string) => boDauKiem(chuanSo(s)).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const cumKhac = [
    ...dat.filter((d) => !khoaCau.has(d.khoa) && !khoaCau.has(KHOA_GHI[d.khoa] ?? d.khoa)).map((d) => d.trich_dan ?? ""),
    ...luat.filter((f) => f.question !== "bo_sung" && !khoaCau.has(f.question)).map((f) => f.answer),
  ].map(gon).filter((c) => c.length >= 3).sort((x, y) => y.length - x.length);
  let con = ` ${gon(trich)} `;
  let daGo = false;
  for (const c of cumKhac) {
    if (con.includes(` ${c} `)) { con = con.split(` ${c} `).join(" "); daGo = true; }
  }
  return daGo && con.trim().split(/\s+/).filter(Boolean).every((w) => TIEU_TU_TRA_LOI.has(w));
}
/** Câu bot hỏi CHỌN MỘT TRONG HAI ("A hay B?") — không phải "… hay không / hay chưa" (câu có / không). */
export function laCauChonHai(cau: string | null | undefined): boolean {
  const kd = boDauKiem(cau ?? "").replace(/\s+/g, " ");
  for (const m of kd.matchAll(/([^.!?\n]*)\?/g)) {
    const c = m[1];
    if (/\S\s+hay\s+\S/.test(c) && !/\bhay\s+(?:khong|ko|chua|sao|the nao|gi)\b/.test(c)) return true;
  }
  return false;
}
/** Cả tin chỉ là lời ừ / gật / dạ — không có nội dung nào khác. */
export function laChiGat(tin: string | null | undefined): boolean {
  const kd = boDauKiem(tin ?? "").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!kd) return false;
  return kd.split(" ").every((w) => /^(?:u|uh|uhm|um|uk|uki|ok|oke|okie|okay|da|vang|dung|roi|duoc|dc|co|em|e|a|anh|chi|nha|nhe|ne|vay|the|y|oki|yes|chuan)$/.test(w));
}
const boDauKiem = (s: string): string =>
  s.normalize("NFC").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

/**
 * 01/10/2026 (chủ dự án: "nó có nhận ra cảm xúc của khách để báo về admin ko"): AI đọc giọng chủ nhà (`cam_xuc`). Code chỉ nhận
 * mức khác bình thường khi cụm trích CÓ trong tin — không có bằng chứng thì không báo ai.
 */
export function docCamXuc(cx: { muc?: string | null; trich_dan?: string | null } | null | undefined, tin: string): { muc: "buc" | "nghi_ngo" | "muon_dung"; trich: string } | null {
  if (!cx || (cx.muc !== "buc" && cx.muc !== "nghi_ngo" && cx.muc !== "muon_dung")) return null;
  const td = (cx.trich_dan ?? "").trim();
  if (td.length < 2) return null;
  const gon = (x: string) => chuanSo(x).replace(/[^\p{L}\d\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!` ${gon(tin)} `.includes(` ${gon(td)} `) && !timMo(gon(tin), gon(td))) return null;
  return { muc: cx.muc, trich: td };
}

/** Cụm trích (đã bỏ dấu, bỏ ký hiệu) có trong tin — khớp nguyên cụm hoặc khớp mờ. */
export function trichCoTrongTin(td: string, tin: string): boolean {
  if (td.trim().length < 2) return false;
  const gon = (x: string) => chuanSo(x).replace(/[^\p{L}\d\s]/gu, " ").replace(/\s+/g, " ").trim();
  return ` ${gon(tin)} `.includes(` ${gon(td)} `) || !!timMo(gon(tin), gon(td));
}
/**
 * Đợt 2 chuyển luật sang AI (02/10/2026): ý định của tin (đã bán / ngưng rao / rao lại / hoãn) — AI đọc theo nghĩa, code chỉ
 * nhận khi cụm trích có trong tin. `undefined` ở nơi gọi = AI không chạy (từ khoá đỡ); null = AI nói không có ý định nào.
 */
export function docYDinh(yd: { loai?: string | null; trich_dan?: string | null } | null | undefined, tin: string): { loai: "ban_roi" | "ngung_rao" | "rao_lai" | "hoan" | "du_roi"; trich: string } | null {
  const l = yd?.loai;
  if (l !== "ban_roi" && l !== "ngung_rao" && l !== "rao_lai" && l !== "hoan" && l !== "du_roi") return null;
  const td = (yd?.trich_dan ?? "").trim();
  return trichCoTrongTin(td, tin) ? { loai: l, trich: td } : null;
}
/** Vai người rao TỰ NÓI (chính chủ / môi giới) — cụm trích phải có trong tin. */
export function docVai(v: { la?: string | null; trich_dan?: string | null } | null | undefined, tin: string): { la: "chinh_chu" | "moi_gioi"; trich: string } | null {
  if (v?.la !== "chinh_chu" && v?.la !== "moi_gioi") return null;
  const td = (v.trich_dan ?? "").trim();
  return trichCoTrongTin(td, tin) ? { la: v.la, trich: td } : null;
}

/**
 * Khách TỰ XƯNG (02/10/2026, SRS-5.1ze): AI đọc theo nghĩa ("Ừ anh đang muốn bán" → anh). Code nhận khi chữ thuộc danh sách,
 * cụm trích có trong tin, và cụm có ĐÚNG chữ đó đứng riêng (hoặc viết tắt "a" / "c" cho anh / chị).
 */
const TU_XUNG_HOP_LE = new Set(["anh", "chị", "chú", "cô", "bác", "ông", "bà", "dì", "cậu", "mợ", "thím", "dượng"]);
// 05/10/2026 (SRS-5.1zx): AI thấy cả "Các tin CHỦ NHÀ đã nhắn TRƯỚC", nên cụm trích được nằm trong một tin cũ (`tinTruoc`) —
// khách xưng "anh" ở lượt luật bỏ sót thì lượt sau vẫn học được, không chờ khách xưng lại.
export function docTuXung(v: { la?: string | null; trich_dan?: string | null } | null | undefined, tin: string, tinTruoc: readonly string[] = []): { la: string; trich: string } | null {
  const la = (v?.la ?? "").trim().toLowerCase();
  if (!TU_XUNG_HOP_LE.has(la)) return null;
  const td = (v?.trich_dan ?? "").trim();
  if (!trichCoTrongTin(td, tin) && !tinTruoc.some((t) => trichCoTrongTin(td, t))) return null;
  const tu = td.toLowerCase().normalize("NFC").split(/[^\p{L}]+/u).filter(Boolean);
  const viet = la === "anh" ? ["anh", "a"] : la === "chị" ? ["chị", "c"] : [la];
  return tu.some((t) => viet.includes(t)) ? { la, trich: td } : null;
}

/**
 * Đợt 1 bỏ luật từ khoá (02/10/2026, SRS-5.1zf): AI đọc GẬT / không đồng ý / bảo đăng. Nhận khi cụm trích có trong tin (gật bằng
 * emoji "👍" thì cụm là chính emoji). `undefined` ở nơi gọi = AI không chạy (luật đỡ); null = AI nói tin không gật cũng không chối.
 */
export function docDongY(v: { la?: string | null; trich_dan?: string | null; dang_di?: boolean | null } | null | undefined, tin: string): { la: "dong_y" | "khong_dong_y"; dangDi: boolean; trich: string } | null {
  if (v?.la !== "dong_y" && v?.la !== "khong_dong_y") return null;
  const td = (v.trich_dan ?? "").trim();
  const coTrich = trichCoTrongTin(td, tin) || (td.length > 0 && !/[\p{L}\p{N}]/u.test(td) && tin.includes(td));
  return coTrich ? { la: v.la, dangDi: v.la === "dong_y" && v.dang_di === true, trich: td } : null;
}

/**
 * SRS-5.1zzl (05/10/2026): ý NGƯNG NHIỀU CĂN / CHỈ GIỮ do AI đọc (doc-y-luot) — nhận khi cụm trích có trong tin.
 * `undefined` ở nơi gọi = AI không chạy (luật `laNgungHangLoat` đỡ); null = AI nói không có ý này.
 */
export function docNgungHangLoat(
  v: { kieu?: string | null; giu?: unknown; trich_dan?: string | null } | null | undefined,
  tin: string,
): { kieu: "chi_giu" | "an_het"; giu: string[] } | null {
  if (v?.kieu !== "chi_giu" && v?.kieu !== "an_het") return null;
  const td = (v.trich_dan ?? "").trim();
  if (!trichCoTrongTin(td, tin)) return null;
  const giu = Array.isArray(v.giu) ? v.giu.filter((g): g is string => typeof g === "string" && g.trim().length > 0).map((g) => g.trim()) : [];
  return { kieu: v.kieu, giu };
}

/**
 * Đợt 3 bỏ luật từ khoá (02/10/2026, SRS-5.1zg): YÊU CẦU của chủ nhà (hỏi về tin, bao lâu bán, xin số khách, xin xoá, xin bỏ ô) do
 * AI đọc. Nhận khi cụm trích có trong tin; `khong` hoặc trích bịa → null (= AI nói không có yêu cầu nào code xử lý được).
 */
export function docYeuCau<L extends string, O extends string>(
  v: { loai?: L | null; trich_dan?: string | null; o?: O | null } | null | undefined,
  tin: string,
): { loai: Exclude<L, "khong">; trich: string; o: O | null } | null {
  const loai = v?.loai;
  if (!loai || loai === "khong") return null;
  const td = (v?.trich_dan ?? "").trim();
  return trichCoTrongTin(td, tin) ? { loai: loai as Exclude<L, "khong">, trich: td, o: v?.o ?? null } : null;
}

/**
 * 03/10/2026 (bộ đo X04, SRS-5.1zt): vế MUA trong tin người bán ("bán căn hộ q7 3 tỷ để mua nhà Bình Thạnh 6 tỷ") do AI đọc.
 * Code nhận khi cụm trích có trong tin; mỗi ô chỉ nhận khi chữ / số của nó nằm TRONG cụm trích (ngân sách: một lượng tiền
 * trong cụm khớp số AI đọc — giá căn đang bán nằm ngoài cụm thì không lọt). Trả delta hồ sơ mua; không còn ô nào thì null.
 */
export function docMuaKem(
  v: { khu_vuc?: string | null; ngan_sach?: string | null; loai?: string | null; trich_dan?: string | null } | null | undefined,
  tin: string,
): { area?: string; budget?: string; property_type?: string; trich: string } | null {
  const td = (v?.trich_dan ?? "").trim();
  if (!v || !trichCoTrongTin(td, tin)) return null;
  const ra: { area?: string; budget?: string; property_type?: string; trich: string } = { trich: td };
  const kdTd = chuanSo(td);
  const kv = (v.khu_vuc ?? "").trim();
  if (kv) {
    const qKv = bocQuan(chuanSo(kv), kv) ?? vungNgoai(chuanSo(kv))?.ten ?? null;
    const qTd = bocQuan(kdTd, td) ?? vungNgoai(kdTd)?.ten ?? null;
    if (qKv ? qKv === qTd : trichCoTrongTin(kv, td)) ra.area = qKv ?? kv;
  }
  const ns = (v.ngan_sach ?? "").trim();
  const nsVnd = docTien(ns);
  if (nsVnd != null) {
    const tienTd = [...kdTd.matchAll(new RegExp(`\\d[\\d.,]*\\s*(?:${TIEN_KD})(?![a-z])(?:\\s*\\d{1,3}(?![\\d.,]|\\s*m)|\\s*ruoi)?`, "g"))]
      .map((m) => docTien(m[0]));
    if (tienTd.some((x) => x != null && gan(x, nsVnd))) ra.budget = ns;
  }
  const loai = (v.loai ?? "").trim();
  if (loai && trichCoTrongTin(loai, td)) ra.property_type = loai.toLowerCase();
  return ra.area || ra.budget || ra.property_type ? ra : null;
}

/** Đợt 3 (02/10/2026): câu hỏi kế AI chọn — chỉ nhận khoá có trong danh sách hợp lệ của lượt (đã bỏ câu hết hạn, câu không áp dụng, câu đang treo). */
export function docCauKe(ck: { khoa?: string | null } | null | undefined, hopLe: Iterable<string>): string | null {
  const k = (ck?.khoa ?? "").trim();
  return k && new Set(hopLe).has(k) ? k : null;
}

/** Câu không bao giờ được AI gạt khỏi danh sách hỏi — thiếu là tin không lên kệ / không định danh được căn. */
export const CAU_KHONG_DUOC_BO = new Set(["gia", "dien_tich", "dien_tich_dat", "dien_tich_tim_tuong", "vi_tri", "phuong", "phap_ly", "loai_bds", "duyet_tin", "hinh_anh"]);
/**
 * 01/10/2026 (chủ dự án: "câu hỏi riêng cho từng loại bds … code cứng quá nên giờ cần AI hiểu"): AI chỉ ra câu trong bảng
 * theo loại KHÔNG áp dụng cho căn này. Code nhận khi: khoá có trong danh sách còn hỏi, không phải câu lõi, và cụm trích có
 * trong LỜI CHỦ NHÀ (tin này + các tin trước). Trả các khoá được bỏ.
 */
export function docKhongCanHoi(
  ds: Array<{ khoa?: string; ly_do?: string; trich_dan?: string }> | null | undefined,
  loiChuNha: string,
  conHoi: Iterable<string>,
): Array<{ khoa: string; ly_do: string; trich: string }> {
  const con = new Set(conHoi);
  const gon = (x: string) => chuanSo(x).replace(/[^\p{L}\d\s]/gu, " ").replace(/\s+/g, " ").trim();
  const kd = gon(loiChuNha);
  const ra: Array<{ khoa: string; ly_do: string; trich: string }> = [];
  for (const x of ds ?? []) {
    const k = (x?.khoa ?? "").trim(), td = (x?.trich_dan ?? "").trim();
    if (!k || !con.has(k) || CAU_KHONG_DUOC_BO.has(k) || td.length < 2 || ra.some((r) => r.khoa === k)) continue;
    if (!` ${kd} `.includes(` ${gon(td)} `) && !timMo(kd, gon(td))) continue;
    ra.push({ khoa: k, ly_do: (x.ly_do ?? "").trim().slice(0, 120), trich: td.slice(0, 120) });
  }
  return ra;
}

/** Loại đường vào nói RÕ trong chuỗi đã chuẩn hoá: "may" / "hoi" / "tai"; không rõ hoặc nhiều loại → null. */
function loaiDuongNoiRo(kd: string): "may" | "hoi" | "tai" | "mat_tien" | null {
  const co = new Set<string>();
  // 27/09/2026 (test Zalo, đất Cần Đước): "mặt tiền đường 5m e" → AI "5 mét" (mất chữ mặt tiền) → bản nháp "hẻm xe hơi 5m".
  if (/(?<!\b(?:cach|gan|ra|sat|toi)\s)\b(?:mat tien|mat duong|mat pho)\b/.test(kd)) co.add("mat_tien");
  if (/\b(?:hxm|xe may|ba gac|xe 3 banh)\b/.test(kd)) co.add("may");
  if (/\b(?:hxh|xe hoi|o to|oto|xe 4 banh|xe 7 cho|xe con)\b/.test(kd)) co.add("hoi");
  if (/\b(?:hxt|xe tai|container)\b/.test(kd)) co.add("tai");
  return co.size === 1 ? [...co][0] as "may" | "hoi" | "tai" | "mat_tien" : null;
}

/**
 * FR-226 (25/09/2026, chủ dự án: "khách trả lời nhỏ giọt về địa chỉ hoặc các trường khác thì để AI gộp lại hoặc thay thế
 * hoặc sửa"): AI trả TOÀN BỘ giá trị mới của một ô chữ sau khi gộp mẩu khách vừa nói vào giá trị đang ghi. Code chỉ nhận
 * khi: ô có giá trị đang ghi, giá trị mới KHÁC giá trị cũ, và MỌI chữ + số của giá trị mới (bỏ dấu) có trong giá trị cũ
 * hoặc trong tin (cộng vài chữ nối "số", "hẻm", "và") — AI được xếp lại, thêm dấu, bỏ bớt; không được thêm điều khách
 * không nói. Trả các ô đạt, mỗi khoá một lần.
 */
export const CHU_NOI_GOP = new Set(["so", "hem", "va", "voi", "nha", "m", "met", "duong"]);
export const tachGop = (x: string) => boDau(x).replace(/(\d),(\d)/g, "$1.$2").replace(/(\d)([a-z])/g, "$1 $2").replace(/([a-z])(\d)/g, "$1 $2")
  .split(/[^a-z0-9.]+/).map((t) => t.replace(/^\.+|\.+$/g, "")).filter(Boolean);
/**
 * Chữ khách hay viết TẮT / nói lóng → chữ đầy đủ model dùng khi ghi lại (02/10/2026, SRS-5.1y): "q5" → "Quận 5", "hxh" →
 * "hẻm xe hơi", "6 tỏi" → "6 tỷ", "chung cư" ↔ "căn hộ". Không có bảng này thì kiểm giá trị bỏ oan bản viết lại đúng nghĩa.
 */
const CHU_TAT: Record<string, string[]> = {
  q: ["quan"], p: ["phuong"], hxh: ["hem", "xe", "hoi"], hxm: ["hem", "xe", "may"], oto: ["o", "to"], mt: ["mat", "tien"],
  pn: ["phong", "ngu"], wc: ["toilet"], toi: ["ty"], ti: ["ty"], tr: ["trieu"], cu: ["trieu"], k: ["nghin"], tphcm: ["ho", "chi", "minh"],
};
/** Chữ đệm / đơn vị hành chính model hay thêm khi viết lại cho gọn ("tầm 6 tỷ", "Quận 5") — không mang ý mới. */
const CHU_DEM_GIA_TRI = new Set([
  ...CHU_NOI_GOP, "tam", "khoang", "chung", "tu", "den", "toi", "duoi", "tren", "hon", "hoac", "la", "co", "can",
  "quan", "phuong", "huyen", "xa", "tp", "thanh", "pho", "o", "cung", "muon",
]);
/**
 * Mọi chữ / số của một giá trị chữ phải có trong lời khách (bỏ dấu, như `kiemCapNhat`), tính cả chữ viết tắt (`CHU_TAT`) và
 * chữ đệm (`CHU_DEM_GIA_TRI`). Bắn thật 02/10 (thu-trl-04): khách "nhà có 2 con nhỏ" → trợ lý ghi người ở cùng "vợ chồng + 2
 * con nhỏ" — trích dẫn đúng, giá trị thêm "vợ chồng". Dùng cho CẢ trợ lý lẫn đường JSON cũ của nhánh mua.
 */
export function giaTriCoTrongLoi(gt: string, loiKhach: string): boolean {
  const tuKhach = tachGop(loiKhach);
  const coSan = new Set(tuKhach);
  for (const t of tuKhach) for (const day of CHU_TAT[t] ?? []) coSan.add(day);
  if (coSan.has("chung") && coSan.has("cu")) { coSan.add("can"); coSan.add("ho"); }
  if (coSan.has("can") && coSan.has("ho")) { coSan.add("chung"); coSan.add("cu"); }
  return tachGop(gt).every((t) => coSan.has(t) || CHU_DEM_GIA_TRI.has(t));
}

/** Khoá hồ sơ mua mang CHỮ khách nói (kiểm bằng `giaTriCoTrongLoi`); deal / can_vay / bedrooms có luật riêng. */
const KHOA_HO_SO_CHU = [
  "area", "budget", "purpose", "property_type", "alley", "timeline", "notes", "khu_song", "nguoi_o_cung", "noi_lam",
  "dien_tich_mong_muon", "thang_may", "nguoi_quyet_dinh", "name",
];
/**
 * Lọc hồ sơ mua model trả (đường JSON cũ, 02/10/2026): trường chữ có chữ khách KHÔNG nói → null (không ghi, không xoá cái đã
 * biết); số phòng ngủ chỉ giữ khi lời khách có đúng số đó kèm "phòng" / "pn".
 */
export function locGiaTriHoSo(profile: Record<string, unknown>, loiKhach: string): { profile: Record<string, unknown>; bo: string[] } {
  const ra = { ...profile };
  const bo: string[] = [];
  for (const k of KHOA_HO_SO_CHU) {
    const v = ra[k];
    if (typeof v === "string" && v.trim() && !giaTriCoTrongLoi(v, loiKhach)) { ra[k] = null; bo.push(k); }
  }
  const pn = ra.bedrooms;
  if (typeof pn === "number" && !new RegExp(`\\b${pn}\\s*(?:phong|pn)\\b`).test(tachGop(loiKhach).join(" "))) { ra.bedrooms = null; bo.push("bedrooms"); }
  return { profile: ra, bo };
}
export type CapNhatDeXuat = { khoa: string; gia_tri_moi: string; cach?: string };
/**
 * Bắn thật 01/10 (lx-tam-31): khách "không có lửng em" → AI ghi kết cấu "trệt + 3 lầu (không có lửng)"; DB thấy chữ "lửng"
 * nên bản nháp in "trệt + LỬNG + 3 lầu" — ngược ý khách. Kết cấu chỉ ghi cái CÓ: bỏ cụm phủ định (không / chưa có lửng,
 * sân thượng, hầm, áp mái).
 */
export function boPhuDinhKetCau(v: string): string {
  return v
    .replace(/[(\[]\s*(?:không|ko|k|chưa|hông)\s+(?:có\s+)?(?:gác\s+|tầng\s+)?(?:lửng|sân thượng|hầm|áp mái)[^)\]]*[)\]]/giu, "")
    .replace(/[,;+]?\s*(?:không|ko|chưa|hông)\s+(?:có\s+)?(?:gác\s+|tầng\s+)?(?:lửng|sân thượng|hầm|áp mái)\b/giu, "")
    .replace(/\s{2,}/g, " ").replace(/[\s,;+]+$/u, "").trim();
}

export function kiemCapNhat(ds: CapNhatDeXuat[] | null | undefined, tin: string, dangGhi: Record<string, string | null | undefined>): Array<{ question: string; answer: string }> {
  const ra: Array<{ question: string; answer: string }> = [];
  for (const c of ds ?? []) {
    if (!c || typeof c.khoa !== "string" || typeof c.gia_tri_moi !== "string") continue;
    const cu = (dangGhi[c.khoa] ?? "").trim();
    let moi = c.gia_tri_moi.trim().replace(/[\s.]+$/, "");
    if (c.khoa === "ket_cau") moi = boPhuDinhKetCau(moi);
    if (!cu || !moi || moi.length > 160 || ra.some((r) => r.question === c.khoa)) continue;
    if (tachGop(moi).join(" ") === tachGop(cu).join(" ")) continue;
    const coSan = new Set([...tachGop(cu), ...tachGop(tin)]);
    // "4m5" trong tin = "4.5" trong giá trị mới.
    for (const m of boDau(tin).matchAll(/(\d+)\s*m\s*(\d)(?!\d)/g)) coSan.add(`${m[1]}.${m[2]}`);
    if (!tachGop(moi).every((t) => coSan.has(t) || CHU_NOI_GOP.has(t))) continue;
    ra.push({ question: c.khoa, answer: moi });
  }
  return ra;
}
/** Mảnh kiến thức AI chỉ nói lại mẩu đã được GỘP vào một ô (FR-226) — "số 45" khi địa chỉ vừa thành "45 Ngô Y Linh". */
export function laTrongCapNhat(kt: string, cn: Array<{ answer: string }>): boolean {
  if (!cn.length) return false;
  const dem = new Set(["so", "nha", "a", "em", "nhe", "anh", "chi", "la", "co", "nua", "them", "luon", "roi", "thi"]);
  const t = tachGop(kt).filter((x) => !dem.has(x));
  return t.length > 0 && cn.some((c) => { const v = new Set(tachGop(c.answer)); return t.every((x) => v.has(x)); });
}

/** Ngang / dài / nở hậu (m) trong đề xuất đạt của MỘT căn, qua kiểm khoảng 1–200 m. (SRS-5.1zzv: export cho đường bóng ghi fact.) */
export function kichThuoc(mot: DeXuat[]): { ngang: number | null; dai: number | null; noHau: number | null } {
  const lay = (k: string) => {
    const d = mot.find((x) => x.khoa === k);
    const n = d ? soCua(d.gia_tri) : null;
    return n != null && n >= 1 && n <= 200 ? n : null;
  };
  return { ngang: lay("ngang"), dai: lay("dai"), noHau: lay("no_hau") };
}

// ── Chế độ `chinh` (21/09/2026, chủ dự án: "đảo tầng: AI đọc là đường chính có kiểm bằng chứng") ──
/**
 * Khoá fact mà AI CÓ THỂ nói ra (qua `KHOA_GHI` hoặc ghép ở `docAiChinh`). Khi AI đã chạy xong
 * và qua kiểm, luật tiền định KHÔNG ghi các khoá này nữa — luật chỉ còn đỡ các khoá AI không có
 * chỗ nói (tiện ích gần, năm xây, hẻm thông, ngập, thế chấp…). Đây là chỗ chặn "bớt 50 triệu" →
 * giá, "hợp đồng phân phối" → pháp lý, "quý 2 năm sau" → địa chỉ (TS-VAN-11).
 */
export const KHOA_FACT_AI_BIET: ReadonlySet<string> = new Set([
  ...Object.values(KHOA_GHI), "mat_tien", "vi_tri", "du_an_ten", "loai_giao_dich", "loai_bds", "dien_tich_dat", "no_hau",
]);


export type AiChinh = {
  /** Fact ghi được (đã chuẩn hoá + kiểm khoảng), kể cả ghép ngang×dài, đường → vi_tri, dự án → du_an_ten. */
  ghi: DeGhi[];
  bo: Bo[];
  // Giá trị CỘT LÕI cho lúc tạo tin; null = AI không nói / không đạt → luật đỡ.
  loaiGiaoDich: "ban" | "cho_thue" | null;
  loaiBds: string | null;
  gia: string | null;
  giaM2Raw: string | null;
  dienTich: number | null;
  ngang: number | null;
  dai: number | null;
  soPhongNgu: number | null;
  /** Quận đã chuẩn hoá qua `bocQuan` ("Quận 7", "Quận Bình Thạnh"); AI nói quận lạ → null. */
  quan: string | null;
  phuong: string | null;
  duong: string | null;
  /** Tên đường trần AI đọc ("Nguyễn Trãi", "3/2") — ghi thẳng cột `street`. */
  tenDuong: string | null;
  duAn: string | null;
  maCan: string | null;
  gap: boolean | null;
};

/**
 * AI là đường chính: từ đề xuất ĐẠT kiểm bằng chứng của MỘT căn → mọi fact ghi được và giá trị cột
 * lõi. KHÔNG so với DB (AI thắng luật ở lượt này; `ghi_fact_listing` chỉ ghi thêm, trigger lấy bản
 * mới nhất). Không có gì → mọi ô null, `ghi` rỗng — nơi gọi rơi về luật.
 */
export function docAiChinh(dat: DeXuat[], dong: DongDb | null): AiChinh {
  let mot = dat.filter((d) => !(d.can != null && d.can > 1));
  // SRS-5.1zr (03/10/2026, bộ đo R02): căn hộ "76m2 2pn tầng 12" → AI ghi `dien_tich_san` (sàn / sử dụng) → cột phụ
  // `built_area_m2`; cột diện tích chính `area_m2` (web, bản nháp, câu còn thiếu) trống. Với CĂN HỘ, diện tích sàn CHÍNH LÀ
  // diện tích căn: chưa có `dien_tich` thì đổi khoá. Nhà phố / toà nhà giữ `dien_tich_san` (tổng sàn khác diện tích đất).
  const laCanHo = chuanSo(mot.find((d) => d.khoa === "loai_bds")?.gia_tri ?? dong?.property_type ?? "").replace(/\s+/g, "_") === "chung_cu";
  if (laCanHo && !mot.some((d) => d.khoa === "dien_tich")) mot = mot.map((d) => d.khoa === "dien_tich_san" ? { ...d, khoa: "dien_tich" } : d);
  const lay = (k: string) => mot.find((d) => d.khoa === k)?.gia_tri.trim() ?? null;
  const lgd = chuanSo(lay("loai_giao_dich") ?? "").replace(/\s+/g, "_");
  const loaiGiaoDich = lgd === "ban" || lgd === "cho_thue" ? lgd : null;
  // Khoảng giá của `chonDeGhi` tuỳ bán / thuê: lúc TẠO TIN chưa có dòng DB → lấy loại giao dịch
  // AI vừa đọc (bắn thật 21/09 mau-v-06: "2tr8/tháng" phòng trọ bị coi là giá bán ngoài khoảng).
  const dongSo: DongDb | null = dong?.deal ? dong : { ...(dong ?? {}), deal: loaiGiaoDich };
  const { ghi, bo: boTho } = chonDeGhi(mot, { trung: [], lech: [], ai_them: mot.map((d) => ({ khoa: d.khoa, ai: d.gia_tri })) }, dongSo, {});
  const daCo = new Set(ghi.map((g) => g.question));
  const bo: Bo[] = [];
  const them = (question: string, answer: string | null, khoa: string) => {
    if (!answer || daCo.has(question)) return;
    answer = gonGiaTriFact(question, answer); // 30/09: "sổ hồng rồi em", "phí quản lý 15k/m2" — cùng cách gọn với luật
    daCo.add(question);
    ghi.push({ question, answer, khoa });
  };
  const kt = kichThuoc(mot);
  // Ngang × dài: có cả hai và chưa có diện tích → "AxB" (trigger nhân ra m² + ghi hai chiều);
  // chỉ ngang → mặt tiền. Nở hậu chưa có ô, để trong `bo` cho sổ đo.
  if (kt.ngang != null && kt.dai != null) {
    if (!daCo.has("dien_tich")) them("dien_tich", `${kt.ngang}x${kt.dai}`, "ngang");
    else them("mat_tien", `ngang ${kt.ngang}m dài ${kt.dai}m`, "ngang");
  } else if (kt.ngang != null) them("mat_tien", `${kt.ngang}m`, "ngang");
  // 02/10/2026 (đối chiếu AI ↔ code, SRS-5.1zb): AI đọc "nở hậu 5m" mà không có ô ghi → bỏ (`khoa_khong_co_cho_ghi`). Fact
  // `no_hau` có sẵn (trigger DB đọc ra rear_width_m), cùng dạng luật ghi ("5m").
  if (kt.noHau != null) them("no_hau", `${kt.noHau}m`, "no_hau");
  // SRS-5.1zzr: địa chỉ và tên dự án là ô NGUYÊN VĂN với mọi loại — ghi đúng cụm khách gõ; model chỉ chỉ ra cụm.
  const duongNv = giaTriNguyenVan("vi_tri", mot.find((d) => d.khoa === "duong"));
  const duong = duongNv ?? (lay("duong") ? tenDuongDayDu(lay("duong")!) : null);
  if (duong && duong.length >= 4 && duong.length <= 80) them("vi_tri", duong, "duong");
  const duAn = lay("du_an");
  const duAnNv = giaTriNguyenVan("du_an_ten", mot.find((d) => d.khoa === "du_an")) ?? duAn;
  if (duAnNv && duAnNv.length >= 3 && duAnNv.length <= 80) them("du_an_ten", duAnNv, "du_an");
  // 24/09/2026 (bắn 10 tin, toà nhà CHDV đang BÁN): "cho thuê từng phòng, không có hợp đồng tổng" — model đọc ra
  // loại giao dịch "cho_thue", ghi fact, trigger lật tin BÁN thành tin CHO THUÊ. Tin đã có loại giao dịch thì chỉ đổi
  // khi chủ nói rõ ĐỔI ("cho thuê chứ không bán", "đổi sang bán", "vẫn bán, không phải cho thuê").
  const cumLgd = chuanSo(mot.find((d) => d.khoa === "loai_giao_dich")?.trich_dan ?? "");
  const doiLgd = !loaiGiaoDich || !dong?.deal || dong.deal === loaiGiaoDich ||
    (loaiGiaoDich === "cho_thue" ? DOI_SANG_THUE_RE : DOI_SANG_BAN_RE).test(cumLgd);
  if (loaiGiaoDich && doiLgd) them("loai_giao_dich", loaiGiaoDich, "loai_giao_dich");
  const lb = chuanSo(lay("loai_bds") ?? "").replace(/\s+/g, "_");
  const loaiBds = lb in LOAI_BDS ? lb : null;
  if (loaiBds) them("loai_bds", loaiBds, "loai_bds");
  // SRS-5.1zk (chủ dự án 03/10: "mấy hàm sql ngu quá thay bằng AI tự ghi đi"): TÊN ĐƯỜNG trần do AI đọc (không số nhà, không chữ
  // hẻm / đường) — nơi gọi ghi thẳng cột `street`, thay cho `boc_ten_duong` (regex SQL) ở chế độ `ai`.
  const tenDuong = (() => { const v = lay("ten_duong")?.replace(/^(?:đường|duong|phố|pho)\s+/i, "").trim(); return v && v.length <= 60 ? tenDuongDayDu(v) : null; })();
  for (const b of boTho) {
    if (b.ly_do === "khoa_khong_co_cho_ghi" && ["ngang", "dai", "no_hau", "duong", "du_an", "loai_giao_dich", "loai_bds"].includes(b.khoa) &&
      ghi.some((g) => g.khoa === b.khoa)) continue;
    // SRS-5.1zk: `ten_duong` không có fact — nơi gọi ghi thẳng cột `street` (`tenDuong` bên dưới).
    if (b.ly_do === "khoa_khong_co_cho_ghi" && b.khoa === "ten_duong" && tenDuong) continue;
    bo.push(b);
  }
  const giaTri = (q: string) => ghi.find((g) => g.question === q)?.answer ?? null;
  const soGhi = (q: string) => { const v = giaTri(q); return v == null ? null : soCua(v); };
  const gapV = chuanSo(lay("gap") ?? "");
  const maCan = lay("ma_can");
  const maCanChuan = maCan && /^[A-Za-z0-9][A-Za-z0-9.\-\/]{1,15}$/.test(maCan) ? maCan.toUpperCase() : null;
  const quanChuan = (() => { const q = lay("quan"); return q ? bocQuan(chuanSo(q), q) ?? vungNgoai(chuanSo(q))?.ten ?? null : null; })();
  const giaM2Raw = lay("gia_m2");
  // 05/10/2026 (SRS-5.1zz): quan / ma_can / gia_m2 không có chỗ ghi FACT nhưng đã đọc vào cột lõi ngay dưới — ghi "bỏ" là tiếng ồn
  // trong sổ và bộ đo. Chỉ còn "bỏ" khi thật sự không dùng được (quận lạ, mã căn sai dạng).
  const boSach = bo.filter((b) => !(b.ly_do === "khoa_khong_co_cho_ghi" &&
    ((b.khoa === "quan" && quanChuan) || (b.khoa === "ma_can" && maCanChuan) || (b.khoa === "gia_m2" && giaM2Raw))));
  return {
    ghi, bo: boSach,
    loaiGiaoDich, loaiBds,
    gia: giaTri("gia"),
    giaM2Raw,
    dienTich: daCo.has("dien_tich") && !/x/.test(giaTri("dien_tich") ?? "") ? soGhi("dien_tich") : null,
    ngang: kt.ngang, dai: kt.dai,
    soPhongNgu: soGhi("so_phong_ngu"),
    // SRS-5.1zq: vùng ngoài TP.HCM ("Đồng Nai", "Long An"…) giữ tên vùng — bản cũ chỉ chuẩn hoá quận nội thành nên ra null.
    quan: quanChuan,
    phuong: giaTri("phuong"),
    duong: giaTri("vi_tri"),
    tenDuong,
    duAn: giaTri("du_an_ten"),
    maCan: maCanChuan,
    gap: gapV === "co" ? true : gapV === "khong" ? false : null,
  };
}

/**
 * Kiến thức thêm (17/09/2026): cụm model nêu phải NGUYÊN VĂN trong tin, ngắn, không trùng ý đã có
 * khoá (không nằm trong trích dẫn nào của `dat`), tối đa 3.
 */
const LOI_NOI_CHUYEN = /\b(de\s+(?:em|anh|chi|minh|toi|tui)\b|roi\s+(?:bao|gui|nhan)|bao\s+lai|gui\s+sau|chut\s+nua|lat\s+nua|hoi\s+lai|se\s+(?:gui|bao|nhan)|em\s+(?:coi|xem|kiem|check)|coi\s+lai|xem\s+lai|cam on|xin loi|nha\s*$|nhe\s*$)\b/;
export function kiemKienThuc(kienThuc: string[], tin: string, dat: DeXuat[]): string[] {
  const kdTin = chuanSo(tin);
  const daCo = dat.map((d) => chuanSo(d.trich_dan));
  const ra: string[] = [];
  // 30/09/2026: "1 phòng ngủ ngay tầng trệt cho người già" không phải tổng số phòng ngủ (kiemGiaTri bỏ) — giữ nguyên vế
  // làm thông tin bổ sung để vào vector, dù model không xếp nó vào kiến thức thêm.
  const pnTang = cumPhongNguTheoTang(tin);
  for (const k of [...(pnTang ? [pnTang] : []), ...(kienThuc ?? [])]) {
    const v = String(k ?? "").replace(/\s+/g, " ").trim().replace(/[.!?,;]+$/, "");
    const kd = chuanSo(v);
    if (kd.length < 3 || v.length > 80) continue;
    if (!kdTin.includes(kd)) continue;
    // 21/09/2026 (bắn thật mau-v-03): "để em coi lại sổ rồi báo" là LỜI HỨA / lời nói chuyện của chủ
    // nhà, không phải điều gì về căn nhà — không vào mô tả.
    if (LOI_NOI_CHUYEN.test(kd)) continue;
    if (daCo.some((t) => t.includes(kd) || kd.includes(t))) continue;
    // 30/09/2026 (bắn thử vector v287): vế "nhà có 1 phòng ngủ ngay tầng trệt…" và bản model cắt ngắn "phòng ngủ ngay tầng
    // trệt…" cùng vào bổ sung — vế nằm trọn trong vế đã giữ là lặp.
    if (ra.some((r) => chuanSo(r).includes(kd) || kd.includes(chuanSo(r)))) continue;
    ra.push(v);
    if (ra.length >= 3) break;
  }
  return ra;
}

// ─── 01/10/2026 (bắn thử lx-hn-62; chủ dự án: "sửa từ cái gốc nguyên nhân") ─────────────────────────────────────────────
// Khách HỎI LẠI bên mình: AI nói (`hoi_lai`), code chỉ kiểm câu hỏi có thật trong tin. Thay cho ba bộ từ khoá hỏi.
export type HoiLaiDoc = { cau: string; chuDe: string; caTin: boolean };
/**
 * `undefined` = AI không nói gì về chuyện hỏi (model hỏng / bản cũ) → nơi gọi rơi về luật từ khoá cũ.
 * `null` = AI đọc rồi: tin KHÔNG hỏi gì. Có hỏi → câu hỏi (trích không có trong tin thì lấy cả tin), chủ đề, và `caTin` =
 * cả tin chỉ là câu hỏi (AI không đọc ra dữ liệu nào khác) — khi đó không phần nào của tin được ghi làm thông tin.
 */
// 06/10/2026 (bắn thử thu-srd-b1, SRS-5.1zzo): "Anh là môi giới nha" → AI đọc thành câu hỏi VỀ BOT (`ve_bot`), bot đáp "Em là trợ
// lý AI…". Lớp lỗi: code chỉ kiểm cụm trích CÓ TRONG TIN, không kiểm cụm đó có mang bằng chứng của CHỦ ĐỀ AI gán — một câu
// khẳng định về chính khách qua được. Nay: (a) `ve_bot` phải có cụm nói về bot / bên em / người hay máy trong câu hỏi; (b) tin
// mà AI đọc ra khách TỰ NÓI VAI (`vaiTuNoi`, đã qua `docVai`) thì câu đó là lời tự giới thiệu, không phải câu hỏi về bot.
const VE_BOT_BANG_CHUNG = /\b(?:bot|ai|robot|may|tro ly|tu dong|nguoi that|nguoi hay|hay nguoi|nguoi hay may|ben em|ben minh|cong ty|ten gi|ten em|la ai|em la|em ten|em o|em lam|em co phai|phai nguoi|nguoi hay la|chat)\b/;
export function docHoiLai(
  h: { co_hoi?: boolean | null; cau_hoi?: string | null; chu_de?: string | null } | null | undefined,
  tin: string, coDuLieuKhac: boolean, vaiTuNoi: boolean = false,
): HoiLaiDoc | null | undefined {
  if (!h || typeof h.co_hoi !== "boolean") return undefined;
  if (!h.co_hoi) return null;
  if (h.chu_de === "ve_bot") {
    if (vaiTuNoi) return null;
    if (!VE_BOT_BANG_CHUNG.test(boDau(h.cau_hoi ?? ""))) return undefined;
  }
  const goc = (tin ?? "").trim();
  if (!goc) return null;
  const chuan = (s: string) => boDau(s).replace(/[^a-z0-9]+/g, " ").trim();
  const cau = (h.cau_hoi ?? "").trim();
  // Bắn thử v313 (lx-hn-a2): "ben minh co bat doc quyen ko" → AI chép câu BOT vừa hỏi ("nhà mình phường mấy anh/chị nhỉ?")
  // làm câu hỏi của khách, chủ đề sai theo. Trích không có trong tin khách = AI đọc lượt này không đáng tin → `undefined`
  // (nơi gọi rơi về lưới từ khoá), không phải "lấy cả tin" như bản đầu — bản đó giấu lỗi của AI.
  if (cau.length < 3 || !chuan(goc).includes(chuan(cau))) return undefined;
  return { cau, chuDe: h.chu_de ?? "khac", caTin: !coDuLieuKhac };
}

// ─── 06/10/2026 (bắn thử thu-srd-b1, SRS-5.1zzo) ─────────────────────────────────────────────────────────────────────────
// Lớp lỗi "CỔNG NHIỀU CĂN DO REGEX QUYẾT": `nhanDienNhieuCan` cắt câu theo dấu phẩy rồi đòi mỗi mảnh "căn N" phải có giá /
// kích thước NGAY TRONG MẢNH — "căn 1 hẻm 5m Phạm Văn Chí P7 Q6, 4x12, 6.9 tỷ; căn 2 mặt tiền Trần Phú Q5, 4x20, 18 tỷ" tách
// thành sáu mảnh, mảnh "căn 1…" không có số → 0 căn → cả tin thành MỘT tin lẫn hai căn (nhãn "2 mặt tiền" của căn 2 dán lên căn
// 1, quận mất vì hai quận xung đột). Trong khi AI đã trả `so_can = 2` và đánh số `can` từng đề xuất. Hàm này dựng danh sách
// căn TỪ AI (đề xuất đã qua `kiemDeXuat`): số căn = các `can` khác nhau; đoạn chữ của căn = từ cụm trích đầu của căn đó (kéo
// ngược lấy mốc "căn N") tới cụm trích đầu của căn kế. Regex chỉ còn là lưới đỡ khi AI không chạy / không đánh số.
const LOAI_CAN: Record<string, CanTrongTin["loai"]> = { chung_cu: "chung_cu", nha_pho: "nha_pho", nha_cap4: "nha_pho", biet_thu: "nha_pho", dat: "dat" };
export function canTheoAi(tin: string, dat: DeXuat[], soCan: number | null | undefined): CanTrongTin[] {
  if ((soCan ?? 0) < 2) return [];
  const so = [...new Set(dat.map((d) => d.can).filter((n): n is number => typeof n === "number" && n >= 1))].sort((a, b) => a - b);
  if (so.length < 2) return [];
  const thap = tin.toLowerCase();
  const kdTin = [...tin].map((ch) => boDau(ch) || ch).join("");
  const viTri = (td: string): number => {
    const t = td.trim().toLowerCase();
    if (t.length < 2) return -1;
    let i = thap.indexOf(t);
    if (i < 0 && [...kdTin].length === [...tin].length) i = kdTin.indexOf(boDau(t));
    return i;
  };
  const dau = so.map((n) => {
    const vt = dat.filter((d) => d.can === n).map((d) => viTri(d.trich_dan_sua ?? d.trich_dan)).filter((i) => i >= 0);
    return { n, bat: vt.length ? Math.min(...vt) : -1 };
  });
  // Căn không định vị được cụm trích nào → không chia theo chữ được, để regex / luật cũ lo.
  if (dau.some((d) => d.bat < 0)) return [];
  dau.sort((a, b) => a.bat - b.bat);
  // Kéo mốc về trước "căn N / nhà N / lô N:" đứng ngay trước cụm trích đầu, để đoạn chữ của căn mang luôn số thứ tự.
  const MOC_RE = /(?:căn|can|nhà|nha|lô|lo)\s+(?:số\s+|so\s+|thứ\s+|thu\s+)?(?:\d{1,2}|[a-h])\b[\s:,\-–]*$/iu;
  const batDau = dau.map((d) => {
    const m = MOC_RE.exec(tin.slice(0, d.bat));
    return m ? d.bat - m[0].length : d.bat;
  });
  const ra: CanTrongTin[] = [];
  for (const [i, d] of dau.entries()) {
    const goc = tin.slice(batDau[i], i + 1 < dau.length ? batDau[i + 1] : undefined).replace(/^[\s:,;\-–]+|[\s:,;\-–]+$/gu, "").trim();
    if (!goc) return [];
    const cua = dat.filter((x) => x.can === d.n);
    const lay = (khoa: string) => cua.find((x) => x.khoa === khoa)?.gia_tri?.trim() || undefined;
    const loaiAi = lay("loai_bds");
    ra.push({
      thu: d.n, goc, theoLoai: true,
      ...(lay("quan") ? { quan: lay("quan") } : {}),
      ...(loaiAi && LOAI_CAN[loaiAi] ? { loai: LOAI_CAN[loaiAi] } : loaiAi?.startsWith("dat") ? { loai: "dat" as const } : {}),
      ngang: lay("ngang"), dai: lay("dai"), dt: lay("dien_tich"), gia: lay("gia"),
    });
  }
  return ra;
}
