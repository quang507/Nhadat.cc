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

export type DeXuat = { khoa: string; gia_tri: string; trich_dan: string; can?: number | null; /** cụm thật trong tin (bỏ dấu) khi trích dẫn chỉ khớp MỜ */ trich_dan_sua?: string };
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
      if (!(cv.length >= 2 && kd.includes(cv))) {
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
    const ly = kiemGiaTri(d, tin, viTri, kdDung);
    if (ly) bo.push({ ...d, ly_do: ly });
    else dat.push(kdDung ? { ...d, trich_dan_sua: kdDung } : d);
  }
  return { dat, bo };
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
  for (const d of dat) {
    if (d.can != null && d.can > 1) continue;
    if (!them.has(d.khoa)) continue; // luật đã ghi (trùng hay lệch) → AI không đụng
    const question = KHOA_GHI[d.khoa];
    if (!question) { bo.push({ ...d, ly_do: "khoa_khong_co_cho_ghi" }); continue; }
    if (daGhi.has(question) || co(question)) { bo.push({ ...d, ly_do: "fact_da_co" }); continue; }
    const v = d.gia_tri.trim();
    const kd = chuanSo(d.trich_dan);
    let answer: string | null = null;
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
        const ten = v.replace(/^(phường|phuong|xã|xa|thị trấn|thi tran|p\.?)\s+/i, "").trim();
        if (ten.length < 3 || ten.length > 40) { bo.push({ ...d, ly_do: "gia_tri_ngoai_khoang" }); continue; }
        answer = `Phường ${hoaDau(ten)}`;
        break;
      }
      case "gap": case "thuong_luong": {
        // Ghi CỤM khách nói (như luật tiền định), trigger DB đọc có/không từ đó.
        answer = d.trich_dan.trim();
        break;
      }
      default: {
        if (v.length < 2 || v.length > 120) { bo.push({ ...d, ly_do: "gia_tri_ngoai_khoang" }); continue; }
        answer = v;
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
  dien_tich_dat: ["dien_tich"], dien_tich_tim_tuong: ["dien_tich"], mat_tien: ["ngang"],
};

/**
 * AI ĐỌC TRƯỚC, luật lưu (17/09/2026): giá trị AI (đã qua kiểm bằng chứng) cho ĐÚNG câu bot
 * đang hỏi, qua thêm kiểm khoảng của `chonDeGhi`. null = AI không có / không đạt.
 */
export function giaTriChoCauTreo(dat: DeXuat[], cauHoi: string, dong: DongDb | null): string | null {
  const mot = dat.filter((d) => !(d.can != null && d.can > 1));
  // 21/09/2026 (chế độ `chinh`): ngang / dài KHÔNG có ô fact riêng (`KHOA_GHI`), nên câu MẶT TIỀN
  // ("ngang 4 dài 16") và câu DIỆN TÍCH trả lời bằng "5x20" từng trả null. Nay ghép như luật:
  // mặt tiền → "ngang Am dài Bm" (DB đọc hai chiều), diện tích chưa nói mà có ngang×dài → "AxB".
  const kt = kichThuoc(mot);
  if (cauHoi === "mat_tien") return kt.ngang != null ? (kt.dai != null ? `ngang ${kt.ngang}m dài ${kt.dai}m` : `${kt.ngang}m`) : null;
  const khoaAi = new Set([...(AI_CHO_CAU[cauHoi] ?? []), ...Object.entries(KHOA_GHI).filter(([, q]) => q === cauHoi).map(([k]) => k)]);
  const loc = mot.filter((d) => khoaAi.has(d.khoa));
  if (!loc.length) {
    if (/^dien_tich(_dat)?$/.test(cauHoi) && kt.ngang != null && kt.dai != null) return `${kt.ngang}x${kt.dai}`;
    return null;
  }
  const { ghi } = chonDeGhi(loc, { trung: [], lech: [], ai_them: loc.map((d) => ({ khoa: d.khoa, ai: d.gia_tri })) }, dong, {});
  return ghi[0]?.answer ?? null;
}

/** Ngang / dài / nở hậu (m) trong đề xuất đạt của MỘT căn, qua kiểm khoảng 1–200 m. */
function kichThuoc(mot: DeXuat[]): { ngang: number | null; dai: number | null; noHau: number | null } {
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
  ...Object.values(KHOA_GHI), "mat_tien", "vi_tri", "du_an_ten", "loai_giao_dich", "loai_bds", "dien_tich_dat",
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
  const mot = dat.filter((d) => !(d.can != null && d.can > 1));
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
  const duong = lay("duong");
  if (duong && duong.length >= 4 && duong.length <= 80) them("vi_tri", duong, "duong");
  const duAn = lay("du_an");
  if (duAn && duAn.length >= 3 && duAn.length <= 80) them("du_an_ten", duAn, "du_an");
  if (loaiGiaoDich) them("loai_giao_dich", loaiGiaoDich, "loai_giao_dich");
  const lb = chuanSo(lay("loai_bds") ?? "").replace(/\s+/g, "_");
  const loaiBds = lb in LOAI_BDS ? lb : null;
  if (loaiBds) them("loai_bds", loaiBds, "loai_bds");
  for (const b of boTho) {
    if (b.ly_do === "khoa_khong_co_cho_ghi" && ["ngang", "dai", "duong", "du_an", "loai_giao_dich", "loai_bds"].includes(b.khoa) &&
      ghi.some((g) => g.khoa === b.khoa)) continue;
    bo.push(b);
  }
  const giaTri = (q: string) => ghi.find((g) => g.question === q)?.answer ?? null;
  const soGhi = (q: string) => { const v = giaTri(q); return v == null ? null : soCua(v); };
  const gapV = chuanSo(lay("gap") ?? "");
  const maCan = lay("ma_can");
  return {
    ghi, bo,
    loaiGiaoDich, loaiBds,
    gia: giaTri("gia"),
    giaM2Raw: lay("gia_m2"),
    dienTich: daCo.has("dien_tich") && !/x/.test(giaTri("dien_tich") ?? "") ? soGhi("dien_tich") : null,
    ngang: kt.ngang, dai: kt.dai,
    soPhongNgu: soGhi("so_phong_ngu"),
    quan: (() => { const q = lay("quan"); return q ? bocQuan(chuanSo(q), q) : null; })(),
    phuong: giaTri("phuong"),
    duong: giaTri("vi_tri"),
    duAn: giaTri("du_an_ten"),
    maCan: maCan && /^[A-Za-z0-9][A-Za-z0-9.\-\/]{1,15}$/.test(maCan) ? maCan.toUpperCase() : null,
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
  for (const k of kienThuc ?? []) {
    const v = String(k ?? "").replace(/\s+/g, " ").trim().replace(/[.!?,;]+$/, "");
    const kd = chuanSo(v);
    if (kd.length < 3 || v.length > 80) continue;
    if (!kdTin.includes(kd)) continue;
    // 21/09/2026 (bắn thật mau-v-03): "để em coi lại sổ rồi báo" là LỜI HỨA / lời nói chuyện của chủ
    // nhà, không phải điều gì về căn nhà — không vào mô tả.
    if (LOI_NOI_CHUYEN.test(kd)) continue;
    if (daCo.some((t) => t.includes(kd) || kd.includes(t))) continue;
    if (ra.some((r) => chuanSo(r) === kd)) continue;
    ra.push(v);
    if (ra.length >= 3) break;
  }
  return ra;
}
