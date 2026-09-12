// BẢN NHÁP TIN RAO — viết như một TIN RAO THẬT (mẫu tin lẻ trên mogi.vn).
//
// Chủ dự án 12/09/2026: "xem cái mogi.vn nếu mà tin lẻ thì người ta đăng tin
// ntn… mấy cái bóc tách đã ghi vào supabase thật thì đưa ra trong 1 tin trước
// đó sau đó đưa em đăng tin như này nhé".
//
// Tin lẻ trên mogi có bốn tầng, đúng thứ tự mắt người đọc:
//   1. TIÊU ĐỀ một dòng gộp đủ thứ đáng tiền: loại · kết cấu · đường · phường
//      quận · diện tích · pháp lý · GIÁ ("Bán nhà 1 trệt 1 lầu đường Nguyễn Văn
//      Hoa P.Thống Nhất. SHR Giá 4,8 tỷ").
//   2. Địa chỉ đầy đủ.  3. Giá.  4. Khối thông số, rồi lời mời liên hệ.
// Bản cũ của mình mở bằng "🏠 NHÀ PHỐ BÁN" rồi mới tới địa chỉ, còn giá nằm tận
// cuối — người bán đọc không ra hình dạng một tin rao.
//
// LUẬT KHÔNG ĐỔI: mọi chữ trong đây đến từ CỘT hoặc FACT chủ nhà đã nói. Thiếu
// thì bỏ dòng. Không đoán, không khen thay chủ nhà — model KHÔNG tham gia dựng
// bản nháp, nên nó kiểm được offline và không tốn lượt tiền nào.
//
// Tách khỏi chat-reply để: (a) `scripts/xem-tin-nhap.mjs` dựng thử trên dữ liệu
// THẬT mà không phải deploy; (b) kiểm bằng bun trong `bot/tests/tin-nhap-rao.mjs`.

import { SPEC_COLS, thongSoNgan, type SpecRow } from "./thong_so.ts";

export const COT_TIN_NHAP =
  `code, location_raw, ward, district, deal, area_m2, price_raw, price_vnd, bedrooms, property_type, gap, negotiable, furnishing, floor, rear_width_m, ${SPEC_COLS}`;

export type TinNhapRow = SpecRow & {
  code?: string | null;
  location_raw?: string | null;
  ward?: string | null;
  district?: string | null;
  deal?: string | null;
  area_m2?: number | string | null;
  price_raw?: string | null;
  bedrooms?: number | null;
  property_type?: string | null;
  gap?: boolean | null;
  negotiable?: boolean | null;
  furnishing?: string | null;
  floor?: number | null;
  rear_width_m?: number | null;
};

export type FactNhap = { question: string; answer: string | null };

export type ThamSoNhap = {
  l: TinNhapRow;
  /** MỚI NHẤT trước — lấy câu trả lời mới nhất mỗi khoá. */
  facts: FactNhap[];
  diem: number;
  thieu: string[];
  soAnh: number;
  /** Gửi lại sau khi sửa theo lời chủ nhà (đổi câu hỏi cuối). */
  lai: boolean;
  cauTD: (khoa: string, o?: Record<string, string | number | null | undefined>) => string;
};

export const LOAI_VI: Record<string, string> = {
  nha_pho: "Nhà phố", nha_cap4: "Nhà cấp 4", chung_cu: "Căn hộ", dat: "Đất",
  biet_thu: "Biệt thự", phong_tro: "Phòng trọ", mat_bang: "Mặt bằng",
  toa_nha: "Toà nhà / CHDV", dat_nong_nghiep: "Đất nông nghiệp",
  dat_kinh_doanh: "Đất kinh doanh", kho_xuong: "Kho xưởng",
};

// Chữ trong TIÊU ĐỀ ngắn hơn trong khối thông số — tiêu đề chỉ có một dòng.
const LOAI_TIEU_DE: Record<string, string> = {
  nha_pho: "nhà", nha_cap4: "nhà cấp 4", chung_cu: "căn hộ", dat: "đất",
  biet_thu: "biệt thự", phong_tro: "phòng trọ", mat_bang: "mặt bằng",
  toa_nha: "toà nhà", dat_nong_nghiep: "đất nông nghiệp",
  dat_kinh_doanh: "đất kinh doanh", kho_xuong: "kho xưởng",
};

const DUONG_VAO_TIEU_DE: Record<string, string> = {
  mat_tien: "mặt tiền", hem_xe_hoi: "hẻm xe hơi", hem_xe_may: "hẻm", hem: "hẻm",
};

const PHAP_LY_TIEU_DE: Record<string, string> = {
  so_hong_rieng: "SHR", so_do_rieng: "SHR", so_chung: "sổ chung",
  hdmb: "HĐMB", giay_tay: "giấy tay", dang_cho_so: "đang chờ sổ",
};

const boDau = (s: string): string =>
  s.toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[̀-ͯ]/g, "");

const so = (x: number | string): string => String(Number(x));

/** Bỏ mảnh trùng ("…, quận 5, Phường 2, Quận 5") và dấu phẩy kép. */
export function diaChiGon(...manh: Array<string | null | undefined>): string {
  const ra: string[] = [];
  for (const m of manh) {
    for (const p of (m ?? "").split(",")) {
      const s = p.trim();
      if (s && !ra.some((x) => boDau(x) === boDau(s))) ra.push(s);
    }
  }
  return ra.join(", ");
}

/** "Phường 3" → "P.3"; "Quận 5" → "Q.5"; tên chữ giữ nguyên (mogi viết vậy). */
function gonHanhChinh(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  const kd = boDau(t);
  const soHc = kd.replace(/\D+/g, "");
  if (/^phuong\s*0*\d{1,2}$/.test(kd)) return `P.${soHc}`;
  if (/^quan\s*0*\d{1,2}$/.test(kd)) return `Q.${soHc}`;
  return t;
}

/**
 * TIÊU ĐỀ kiểu tin lẻ mogi: một dòng, gộp thứ đáng tiền, KẾT bằng giá.
 * Chỉ ghép từ cột + fact; thiếu phần nào thì bỏ phần đó.
 */
export function tieuDeTin(l: TinNhapRow, fact: (k: string) => string | null): string {
  const thue = l.deal === "cho_thue";
  // Tách CỤM bằng dấu phẩy, đúng thứ tự người ta đọc một tin rao: chỗ nào →
  // bao nhiêu m² → nhà thế nào → giấy tờ → giá. Nhét hết vào một chuỗi dài
  // không dấu phẩy thì đọc như máy đọc ("Bán nhà trệt + 2 lầu 3PN hẻm…").
  const vitri: string[] = [thue ? "Cho thuê" : "Bán", LOAI_TIEU_DE[l.property_type ?? ""] ?? "bất động sản"];
  const duongVao = DUONG_VAO_TIEU_DE[l.access_type ?? ""] ?? null;
  if (duongVao) vitri.push(duongVao + (l.alley_width_m ? ` ${so(l.alley_width_m)}m` : ""));
  // Đường/hẻm: lời chủ nhà nói, bỏ phần phường/quận vì đã có ở vế sau, và bỏ
  // chữ "hẻm xe hơi 5m" nếu vế đường vào ngay trên đã nói rồi.
  const duong = (l.location_raw ?? "").split(",")[0].trim();
  if (duong) {
    const gon = duongVao ? duong.replace(/^h[eẻ]m(\s+xe\s+h[oơ]i|\s+xe\s+m[aá]y)?\s*[\d.,]*\s*m?\s*/i, "").trim() : duong;
    vitri.push(gon || duong);
  }
  const hc = [gonHanhChinh(l.ward), gonHanhChinh(l.district)].filter(Boolean).join(" ");
  if (hc) vitri.push(hc);

  const cum: string[] = [vitri.join(" ")];
  if (l.area_m2 != null && l.area_m2 !== "") cum.push(`${so(l.area_m2)}m²`);
  const ketCau = l.floors_text ?? (l.floors ? `${l.floors} tầng` : null);
  if (ketCau) cum.push(ketCau);
  if (l.bedrooms) cum.push(`${l.bedrooms}PN`);
  const pl = PHAP_LY_TIEU_DE[l.legal_status ?? ""] ?? null;
  if (pl) cum.push(pl);
  if (l.gap === true) cum.push(thue ? "cần cho thuê gấp" : "cần bán gấp");
  if (l.price_raw) cum.push(`giá ${l.price_raw}${thue && !/thang/.test(boDau(l.price_raw)) ? "/tháng" : ""}`);
  const t = cum.join(", ").replace(/\s+/g, " ").trim();
  return t.length <= 120 ? t : t.slice(0, 117).replace(/[\s,]+\S*$/, "") + "…";
}

/** Bản nháp đầy đủ — một chuỗi, mỗi dòng một ý (giống một tin rao thật). */
export function soanTinNhap(t: ThamSoNhap): string {
  const { l, facts, diem, thieu, soAnh, lai, cauTD } = t;
  const fact = (k: string) => facts.find((f) => f.question === k)?.answer ?? null;
  // Dán nhãn mà không lặp chữ: "thuê tối thiểu 3 năm" đã có nhãn thì không thành
  // "thuê tối thiểu thuê tối thiểu 3 năm". So theo TỪNG CHỮ của nhãn.
  const coChu = (v: string, n: string) =>
    boDau(n).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 2)
      .some((w) => new RegExp(`\\b${w}`).test(boDau(v)));
  const nhan = (n: string, v: string | null, sep = " ") => v ? (coChu(v, n) ? v : `${n}${sep}${v}`) : null;
  const hau = (v: string | null, n: string) => v ? (coChu(v, n) ? v : `${v} ${n}`) : null;
  const loai = l.property_type ?? "";
  const thue = l.deal === "cho_thue";
  const dong: string[] = [];
  const them = (icon: string, ten: string, phan: Array<string | null | undefined | false>) => {
    const p = phan.filter((x): x is string => !!x && String(x).trim().length > 0);
    if (p.length) dong.push(`${icon} ${ten}: ${p.join(" · ")}`);
  };

  dong.push(cauTD("nhap_tieu_de"));
  dong.push(tieuDeTin(l, fact));
  // Chủ nhà gõ "hẻm 5m Nguyễn Trãi" thì địa chỉ mở đầu bằng chữ thường — một
  // tin rao thật không bắt đầu bằng chữ thường.
  const dc = diaChiGon(l.location_raw, l.ward, l.district);
  dong.push(`📍 ${dc.charAt(0).toLocaleUpperCase("vi") + dc.slice(1)}${fact("khu_compound") ? ` · ${fact("khu_compound")}` : ""}`);
  // GIÁ đứng ngay dưới địa chỉ như mọi tin rao thật (bản cũ để tận cuối).
  if (l.price_raw) {
    const giaDaNoi = /thuong luong|\btl\b|con bot|fix|co dinh/.test(boDau(l.price_raw));
    const tl = giaDaNoi
      ? ""
      : l.negotiable === true || /thuong luong|\btl\b|con bot|fix/.test(boDau(fact("thuong_luong") ?? ""))
      ? " (còn thương lượng)"
      : l.negotiable === false
      ? " (giá cố định)"
      : "";
    dong.push(
      `💰 ${l.price_raw}${thue && !/thang/.test(boDau(l.price_raw)) ? "/tháng" : ""}${tl}${
        fact("ly_do_ban") ? ` · lý do bán: ${fact("ly_do_ban")}` : ""
      }`,
    );
  }
  them("📐", "Diện tích", [
    l.area_m2 != null && l.area_m2 !== ""
      ? `${so(l.area_m2)}m²`
      : (fact("dien_tich") ?? fact("dien_tich_dat") ?? fact("dien_tich_tim_tuong")),
    l.frontage_m && l.length_m
      ? `ngang ${so(l.frontage_m)}m x dài ${so(l.length_m)}m`
      : (l.frontage_m ? `ngang ${so(l.frontage_m)}m` : fact("mat_tien") ? `ngang ${fact("mat_tien")}` : null),
    l.rear_width_m ? `nở hậu ${so(l.rear_width_m)}m` : fact("no_hau") ? `nở hậu ${fact("no_hau")}` : null,
    nhan("thổ cư", fact("tho_cu")),
    fact("hinh_dang"),
  ]);
  them("🏗", "Kết cấu", [
    l.floors_text ?? (l.floors ? `${l.floors} tầng` : fact("ket_cau")),
    nhan("toà", fact("toa_thap")),
    l.floor ? `tầng ${l.floor}` : nhan("tầng", fact("tang")),
    l.bedrooms ? `${l.bedrooms} phòng ngủ` : hau(fact("so_phong_ngu"), "phòng ngủ"),
    l.bathrooms ? `${l.bathrooms} WC` : hau(fact("so_wc"), "WC"),
    nhan("thang máy:", fact("thang_may")),
    nhan("sân vườn:", fact("san_vuon")),
    fact("hien_trang"),
    nhan("xây", fact("nam_xay")),
    nhan("căn góc:", fact("can_goc")),
    nhan("view:", fact("view")),
  ]);
  them("🛣", "Đường vào", [
    l.access_type
      ? thongSoNgan({ access_type: l.access_type, alley_width_m: l.alley_width_m } as SpecRow).replace(/^ · /, "")
      : (fact("do_rong_hem") ?? fact("do_rong_duong") ?? fact("duong_vao")),
    nhan("cách mặt tiền", fact("cach_mat_tien")),
    fact("hem_thong"),
    nhan("ngập nước:", fact("ngap_nuoc")),
    fact("ha_tang"),
    nhan("container:", fact("duong_container")),
  ]);
  them("🧭", "Hướng", [l.direction ?? fact("huong")]);
  them("📜", "Pháp lý", [
    l.legal_status
      ? thongSoNgan({ legal_status: l.legal_status, has_completion: l.has_completion } as SpecRow).replace(/^ · /, "")
      : fact("phap_ly"),
    nhan("quy hoạch:", fact("quy_hoach")),
    nhan("sổ:", fact("the_chap")),
    fact("xay_dung"),
    fact("so_huu"),
    fact("thoi_han_su_dung"),
    fact("hinh_thuc_thue_dat"),
    fact("len_tho_cu"),
  ]);
  if (loai === "toa_nha" || loai === "kho_xuong") {
    them("🏢", loai === "toa_nha" ? "Khai thác" : "Kho xưởng", [
      hau(fact("so_phong"), "phòng"),
      nhan("lấp đầy", fact("ty_le_lap_day")),
      fact("doanh_thu"),
      nhan("PCCC:", fact("pccc")),
      nhan("cao", fact("chieu_cao")),
      nhan("tải trọng", fact("tai_trong_san")),
      nhan("điện", fact("tram_bien_ap")),
      nhan("nước thải:", fact("xu_ly_nuoc_thai")),
    ]);
  }
  if (loai === "dat_nong_nghiep" || loai === "dat_kinh_doanh") {
    them("🌱", "Đất", [
      nhan("nước:", fact("nguon_nuoc")),
      nhan("ranh:", fact("ranh_gioi")),
      nhan("mật độ XD", fact("mat_do_xd")),
      fact("tang_cao_toi_da") ? `xây tối đa ${hau(fact("tang_cao_toi_da"), "tầng")}` : null,
    ]);
  }
  them("🛋", "Nội thất", [l.furnishing ?? fact("noi_that"), nhan("hiện:", fact("hien_trang_su_dung"))]);
  if (thue) {
    them("📝", "Điều kiện thuê", [
      fact("tien_coc"),
      nhan("thuê tối thiểu", fact("thoi_han_thue")),
      nhan("tăng", fact("truot_gia")),
      nhan("sửa chữa miễn phí", fact("fit_out")),
      nhan("phí QL", fact("phi_quan_ly")),
      nhan("gửi xe", fact("phi_gui_xe")),
      nhan("điện nước", fact("gia_dien_nuoc")),
      fact("gio_giac"),
    ]);
  } else {
    them("🏢", "Phí", [nhan("phí QL", fact("phi_quan_ly")), nhan("gửi xe", fact("phi_gui_xe"))]);
  }
  them("🏫", "Tiện ích gần", [fact("tien_ich_gan")]);
  // Tiềm năng CHỈ khi chủ nhà nói (không bịa thay họ).
  them("💡", "Phù hợp", [fact("tiem_nang") ?? fact("muc_dich") ?? fact("nganh_hang_phu_hop")]);
  if (soAnh) dong.push(`📷 ${soAnh} ảnh`);
  // FR-178: không đọc mã tin cho khách — mã chỉ ở web, CTV, admin.
  dong.push(cauTD("nhap_goi_hanh_dong"));
  // Điểm đầy đủ đi CUỐI, chung một dòng với lời gợi ý — để trên câu mở thì tin
  // rao mở đầu bằng một con số nội bộ, không giống tin rao.
  dong.push(
    thieu.length
      ? cauTD("nhap_goi_y", { diem, thieu: thieu.slice(0, 2).join(" và ") })
      : cauTD("nhap_diem", { diem }),
  );
  dong.push(lai ? cauTD("nhap_sua_xong") : cauTD("nhap_hoi_duyet"));
  return dong.join("\n");
}
