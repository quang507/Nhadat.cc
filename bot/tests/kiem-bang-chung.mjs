// kiem-bang-chung.mjs — FR-208 (TS-AIBOC-01): code kiểm bằng chứng cho đề xuất bóc tách của model.
// Không mạng, không DB, không model.   bun bot/tests/kiem-bang-chung.mjs
//
// Hai loại ca: BỊA (model nói điều tin không có / gán nhầm ô) phải BỎ đúng lý do; ĐÚNG phải
// ĐẠT. Một ca bịa lọt vào `dat` là cổng đỏ — đó là thứ duy nhất FR-208 hứa.
import { chonDeGhi, chonViTri, coMuiDuLieuRao, docAiChinh, giaTriChoCauTreo, KHOA_FACT_AI_BIET, kiemDeXuat, kiemKienThuc, soSanhVoiDb } from "../supabase/functions/_shared/extraction/kiem-bang-chung.ts";

let hong = 0, tong = 0;
const ok = (ten, dat, chi = "") => { tong++; if (!dat) hong++; console.log(`${dat ? "✓" : "✗"} ${ten}${dat ? "" : `  → ${chi}`}`); };
const mot = (tin, khoa, gia_tri, trich_dan) => kiemDeXuat([{ khoa, gia_tri, trich_dan }], tin);
const bo = (ten, tin, khoa, gia_tri, trich_dan, lyDo) => {
  const k = mot(tin, khoa, gia_tri, trich_dan);
  ok(`BỎ ${ten}`, k.dat.length === 0 && k.bo[0]?.ly_do === lyDo, JSON.stringify(k));
};
const dat = (ten, tin, khoa, gia_tri, trich_dan) => {
  const k = mot(tin, khoa, gia_tri, trich_dan);
  ok(`ĐẠT ${ten}`, k.dat.length === 1, JSON.stringify(k));
};

const MT = "bán nhà mặt tiền đường Châu Văn Liêm phường 14 quận 5, ngang 4.2m dài 18m nở hậu 5m, 1 trệt 1 lửng 3 lầu sân thượng, đang cho thuê 45 triệu/tháng, giá 32 tỷ còn thương lượng";
const MB = "sang nhượng mặt bằng quán cà phê Quận 1 đường Nguyễn Trãi, 8x20, thuê 60 triệu/tháng, phí sang 350 triệu";
const GT = "bán đất thổ cư Nhà Bè 120m2, 45tr/m2 tổng 5 tỷ 4, đã có người cọc 200tr nhưng bể cọc";
const C4 = "hẻm rộng tầm 2m5 thôi em, cách mặt tiền 50m";
const TT = "cần bán nhà phường Hiệp Bình Chánh TP Thủ Đức, diện tích 62,5m², 1 trệt 1 lầu, hẻm 5m thông, giá 5,9 tỷ";

// ── BỊA: lớp 1 — trích dẫn không có trong tin ──
bo("trích dẫn bịa ('giá 35 tỷ' không có trong tin)", MT, "gia", "35 tỷ", "giá 35 tỷ", "trich_dan_khong_co_trong_tin");
bo("trích dẫn ghép hai chỗ xa nhau", MT, "duong", "Châu Văn Liêm quận 5", "Châu Văn Liêm quận 5", "trich_dan_khong_co_trong_tin");
bo("tự điền quận từ tên đường (tin không nói quận)", "bán nhà hẻm Nguyễn Trãi 4x15 giá 5 tỷ", "quan", "Quận 5", "Nguyễn Trãi", "quan_khong_khop_trich_dan");
bo("trích dẫn rỗng", MT, "gia", "32 tỷ", "", "trich_dan_khong_co_trong_tin");
// ── BỊA: lớp 2 — cụm có thật nhưng giá trị đọc ra khác ──
bo("giá 30 tỷ, trích 'giá 32 tỷ'", MT, "gia", "30 tỷ", "giá 32 tỷ", "tien_khong_khop_trich_dan");
bo("diện tích 80 từ '8x20'? (8x20 = 160)", MB, "dien_tich", "80", "8x20", "so_khong_co_trong_trich_dan");
bo("số phòng ngủ 3, trích '1 trệt 1 lửng 3 lầu'", MT, "so_phong_ngu", "4", "1 trệt 1 lửng 3 lầu", "so_khong_co_trong_trich_dan");
bo("loại căn hộ từ 'bán nhà mặt tiền'", MT, "loai_bds", "chung_cu", "bán nhà mặt tiền", "trich_dan_khong_noi_loai_nay");
bo("gấp = có, trích 'giá 32 tỷ còn thương lượng'", MT, "gap", "co", "giá 32 tỷ còn thương lượng", "trich_dan_khong_noi_gap");
bo("phường 4, trích 'phường 14'", MT, "phuong", "4", "phường 14", "phuong_khong_khop_trich_dan");
bo("đường diễn đạt lại ('CVL')", MT, "duong", "CVL", "đường Châu Văn Liêm", "gia_tri_khong_nam_trong_trich_dan");
bo("loại BĐS ngoài danh sách", MT, "loai_bds", "nha_mat_tien", "nhà mặt tiền", "gia_tri_ngoai_danh_sach");
bo("khoá lạ", MT, "so_dien_thoai", "0903", "mặt tiền", "khoa_la");
// ── GÁN NHẦM Ô: lớp 3 — ngữ cảnh ──
bo("tiền thuê đang thu làm GIÁ tin bán", MT, "gia", "45 triệu", "45 triệu/tháng", "tien_thue_khong_phai_gia_ban");
bo("tiền cọc làm giá", GT, "gia", "200 triệu", "200tr", "ngu_canh_coc_phi_hoa_hong");
bo("phí sang làm giá", MB, "gia", "350 triệu", "350 triệu", "ngu_canh_coc_phi_hoa_hong");

// ── ĐÚNG ──
dat("giá 32 tỷ", MT, "gia", "32 tỷ", "giá 32 tỷ còn thương lượng");
dat("thu nhập thuê 45 triệu", MT, "thu_nhap_thue", "45 triệu", "đang cho thuê 45 triệu/tháng");
dat("giá thuê mặt bằng 60 triệu/tháng (tin cho thuê)", MB, "gia", "60 triệu", "thuê 60 triệu/tháng");
dat("loại giao dịch cho thuê", MB, "loai_giao_dich", "cho_thue", "thuê 60 triệu/tháng");
dat("diện tích từ ngang×dài 8x20 = 160", MB, "dien_tich", "160", "8x20");
dat("diện tích '62,5m²'", TT, "dien_tich", "62.5", "diện tích 62,5m²");
dat("hẻm '2m5' = 2.5", C4, "do_rong_hem", "2.5", "hẻm rộng tầm 2m5");
dat("cách mặt tiền 50", C4, "cach_mat_tien", "50", "cách mặt tiền 50m");
dat("số tầng 5 từ '1 trệt 1 lửng 3 lầu'? không — 3 lầu + trệt = 4", MT, "so_tang", "4", "1 trệt 1 lửng 3 lầu sân thượng");
dat("quận 5", MT, "quan", "Quận 5", "quận 5");
dat("phường 14", MT, "phuong", "Phường 14", "phường 14");
dat("phường tên chữ", TT, "phuong", "Hiệp Bình Chánh", "phường Hiệp Bình Chánh");
dat("đường", MT, "duong", "Châu Văn Liêm", "đường Châu Văn Liêm");
dat("loại nhà phố", MT, "loai_bds", "nha_pho", "bán nhà mặt tiền");
dat("loại đất", GT, "loai_bds", "dat", "bán đất thổ cư");
dat("giá/m² 45tr", GT, "gia_m2", "45 triệu", "45tr/m2");
dat("thương lượng = có", MT, "thuong_luong", "co", "còn thương lượng");
dat("gấp = có", "cần bán gấp nhà q8 3 tỷ", "gap", "co", "cần bán gấp");
dat("pháp lý chữ", "sổ hồng riêng, hoàn công đủ", "phap_ly", "sổ hồng riêng", "sổ hồng riêng");
dat("sửa lời: 'đất trống'", "à anh nói lại, là đất trống chưa xây nha em, giá 10 tỷ 5 thôi", "loai_bds", "dat", "là đất trống chưa xây");
dat("sửa lời: giá mới 10 tỷ 5", "à anh nói lại, là đất trống chưa xây nha em, giá 10 tỷ 5 thôi", "gia", "10 tỷ 5", "giá 10 tỷ 5");
dat("trích dẫn khác hoa/thường + dấu vẫn khớp", MT, "duong", "Châu Văn Liêm", "DUONG CHAU VAN LIEM");

// ── lượt đo bóng thật 14/09 (33 lượt, 203 đề xuất): các ca LỌT mà sai + các ca bị bỏ oan ──
const MBT = "sang nhượng mặt bằng quán cà phê Quận 1 đường Nguyễn Trãi, 8x20, thuê 60 triệu/tháng, phí sang 350 triệu";
bo("thật: 'sang nhượng mặt bằng' → ban", MBT, "loai_giao_dich", "ban", "sang nhượng mặt bằng", "trich_dan_khong_noi_ban");
bo("thật: giá 350 triệu, trích 'phí sang 350 triệu' (chữ phí nằm TRONG cụm)", MBT, "gia", "350 triệu", "phí sang 350 triệu", "ngu_canh_coc_phi_hoa_hong");
bo("thật: thu nhập thuê 60 triệu ở tin sang nhượng mặt bằng", MBT, "thu_nhap_thue", "60 triệu/tháng", "thuê 60 triệu/tháng", "khong_phai_thu_nhap_thue");
dat("thật: 'sang nhượng mặt bằng' → cho_thue", MBT, "loai_giao_dich", "cho_thue", "sang nhượng mặt bằng");
bo("thật: số tầng 3 cho '1 trệt 1 lửng 3 lầu' (đếm lầu, quên trệt)", MT, "so_tang", "3", "1 trệt 1 lửng 3 lầu sân thượng", "so_tang_khong_khop_trich_dan");
bo("thật: số tầng 2 cho 'trệt 2 lầu st'", "e bán nhà hxh Nguyễn Kiệm Phú Nhuận 4x15 trệt 2 lầu st 3pn, giá 8 tỏi 3", "so_tang", "2", "trệt 2 lầu st", "so_tang_khong_khop_trich_dan");
dat("thật: số tầng 3 cho 'trệt 2 lầu st'", "e bán nhà hxh Nguyễn Kiệm Phú Nhuận 4x15 trệt 2 lầu st 3pn, giá 8 tỏi 3", "so_tang", "3", "trệt 2 lầu st");
const B3 = "cho thuê căn hộ Sunrise City quận 7, 76m2, 2 phòng ngủ, tầng 15 view sông, full nội thất, 18 triệu một tháng";
bo("thật: hướng = 'view sông'", B3, "huong", "view sông", "view sông", "gia_tri_khong_dung_loai_truong");
bo("thật: pháp lý = 'thổ cư hết'", "bán đất Củ Chi 100m2 thổ cư hết, 900tr, cần bán gấp", "phap_ly", "thổ cư hết", "thổ cư hết", "gia_tri_khong_dung_loai_truong");
bo("thật: kết cấu = 'xây tự do'", "bán lô đất nền KDC Trung Sơn Bình Chánh, 5x20, giá 95 triệu/m2, đường 12m, sổ riêng xây tự do", "ket_cau", "xây tự do", "sổ riêng xây tự do", "gia_tri_khong_dung_loai_truong");
bo("thật: dự án = 'Thảo Điền' (tên khu)", "biệt thự Thảo Điền quận 2, đất 300m2, xây 1 hầm 3 lầu, giá 95 tỷ", "du_an", "Thảo Điền", "biệt thự Thảo Điền", "khong_co_dau_hieu_du_an");
bo("thật: lý do bán = 'gấp'", "🏡 CHÍNH CHỦ BÁN GẤP NHÀ QUẬN 3", "ly_do_ban", "gấp", "BÁN GẤP", "gia_tri_khong_dung_loai_truong");
dat("thật: dự án 'Trung Sơn' trích 'KDC Trung Sơn'", "bán lô đất nền KDC Trung Sơn Bình Chánh, 5x20", "du_an", "Trung Sơn", "KDC Trung Sơn");
dat("thật: dự án 'Vinhomes Grand Park'", "bán căn hộ Vinhomes Grand Park Thủ Đức, căn S1.02", "du_an", "Vinhomes Grand Park", "căn hộ Vinhomes Grand Park");
dat("thật: hướng 'Đông Nam'", "hướng ban công Đông Nam, sổ hồng", "huong", "Đông Nam", "hướng ban công Đông Nam");
// bị bỏ OAN ở lượt đo (model đúng, bộ kiểm đọc không ra)
dat("oan: giá số trần '5.2' cho '5 tỷ 2'", "bán nhà quận 10 phường 12, 48m2, giá 5 tỷ 2", "gia", "5.2", "5 tỷ 2");
dat("oan: giá '3150' cho 'giá 3 tỷ 150'", "căn S1.02 tầng 12, 69m2, giá 3 tỷ 150 bao thuế phí", "gia", "3150", "giá 3 tỷ 150");
dat("oan: giá '900' cho '900tr'", "bán đất Củ Chi 100m2 thổ cư hết, 900tr, cần bán gấp", "gia", "900", "900tr");
dat("oan: giá '8.3' cho '8 tỏi 3'", "e bán nhà hxh Nguyễn Kiệm 4x15, giá 8 tỏi 3", "gia", "8.3", "8 tỏi 3");
dat("oan: giá/m² '95' cho '95 triệu/m2'", "lô 5x20, giá 95 triệu/m2, đường 12m", "gia_m2", "95", "95 triệu/m2");
dat("oan: quận '5' cho 'quận 5'", MT, "quan", "5", "quận 5");
dat("oan: quận '11' cho 'q11'", "bán nhà q11", "quan", "11", "q11");
dat("oan: cọc '2 tháng'", "cọc 2 tháng, thuê tối thiểu 1 năm", "tien_coc", "2 tháng", "cọc 2 tháng");
bo("oan không phải oan: giá '6' cho '6 tỷ' mà ghi nhầm '60'", "bán nhà quận 5 phường 7, 50m2, 6 tỷ", "gia", "60", "6 tỷ", "tien_khong_khop_trich_dan");

// ── lượt đo bóng lần 2 (33 lượt, 196 đề xuất, 186 đạt): 2 ca còn lọt ──
bo("lần 2: tiền cọc = 'phí sang 350 triệu'", MBT, "tien_coc", "350 triệu", "phí sang 350 triệu", "trich_dan_khong_noi_coc");
bo("lần 2: nội thất = 'để ở hoặc cho thuê đều được'", "nhà hướng đông nam, để ở hoặc cho thuê đều được em", "noi_that", "để ở hoặc cho thuê đều được", "để ở hoặc cho thuê đều được", "gia_tri_khong_dung_loai_truong");
dat("lần 2: cọc 60 triệu", "cho thuê nhà 20 triệu/tháng, cọc 60 triệu", "tien_coc", "60 triệu", "cọc 60 triệu");
dat("lần 2: nội thất full", "căn hộ 2pn full nội thất, 18 triệu", "noi_that", "full nội thất", "full nội thất");
{
  const s = soSanhVoiDb([{ khoa: "do_rong_hem", gia_tri: "2m5", trich_dan: "hẻm rộng tầm 2m5" }], { alley_width_m: 2.5 }, {});
  ok("lần 2: so DB 'hẻm 2m5' với 2.5 → trùng (không phải lệch)", s.trung.includes("do_rong_hem"), JSON.stringify(s));
}

// ── loạt nhiều trường: tách đúng đạt / bỏ ──
{
  const k = kiemDeXuat([
    { khoa: "gia", gia_tri: "32 tỷ", trich_dan: "giá 32 tỷ" },
    { khoa: "gia", gia_tri: "45 triệu", trich_dan: "45 triệu/tháng" },
    { khoa: "quan", gia_tri: "Quận 5", trich_dan: "quận 5" },
    { khoa: "huong", gia_tri: "Đông Nam", trich_dan: "hướng Đông Nam" },
    null,
    { khoa: "gia" },
  ], MT);
  ok("loạt: 2 đạt, 2 bỏ (thuê làm giá, hướng bịa), phần tử hỏng bị bỏ qua", k.dat.length === 2 && k.bo.length === 2, JSON.stringify(k));
}

// ── mùi dữ liệu ──
ok("mùi: 'ok em' → không gọi model", !coMuiDuLieuRao("ok em"));
ok("mùi: 'dạ' → không", !coMuiDuLieuRao("dạ"));
ok("mùi: '5 tỷ 800' → có", coMuiDuLieuRao("5 tỷ 800"));
ok("mùi: 'hướng đông nam nha' → có", coMuiDuLieuRao("hướng đông nam nha"));

// ── so với DB ──
{
  const dat = [
    { khoa: "gia", gia_tri: "32 tỷ", trich_dan: "giá 32 tỷ" },
    { khoa: "quan", gia_tri: "Quận 5", trich_dan: "quận 5" },
    { khoa: "loai_giao_dich", gia_tri: "ban", trich_dan: "bán nhà" },
    { khoa: "dien_tich", gia_tri: "75.6", trich_dan: "ngang 4.2m dài 18m" },
    { khoa: "no_hau", gia_tri: "5", trich_dan: "nở hậu 5m" },
    { khoa: "ly_do_ban", gia_tri: "cần tiền", trich_dan: "cần tiền" },
  ];
  const dong = { price_vnd: 45e6, district: "Quận 5", deal: "cho_thue", area_m2: 75.6, rear_width_m: null };
  const s = soSanhVoiDb(dat, dong, {});
  ok("so DB: giá 32 tỷ ≠ DB 45 triệu → lech; quận trung; deal lech; diện tích trung; nở hậu + lý do → ai_them",
    s.lech.map((x) => x.khoa).sort().join() === "gia,loai_giao_dich" && s.trung.sort().join() === "dien_tich,quan" &&
      s.ai_them.map((x) => x.khoa).sort().join() === "ly_do_ban,no_hau", JSON.stringify(s));
  const s2 = soSanhVoiDb([{ khoa: "ly_do_ban", gia_tri: "cần tiền", trich_dan: "cần tiền" }], null, { ly_do_ban: "gia đình cần tiền" });
  ok("so DB: fact có sẵn chứa giá trị → trung", s2.trung.includes("ly_do_ban"), JSON.stringify(s2));
  const s3 = soSanhVoiDb([{ khoa: "gia", gia_tri: "25 tỷ", trich_dan: "25 tỷ", can: 2 }], { price_vnd: 3.6e9 }, {});
  ok("so DB: trường của căn thứ 2 không đem so với tin căn 1", !s3.lech.length && !s3.trung.length && !s3.ai_them.length, JSON.stringify(s3));
}

// ── FR-208 bước 2 (17/09/2026): chonDeGhi — AI GHI CÓ KIỂM, chỉ trường luật không ghi, trong khoảng hợp lệ ──
{
  const dx = (khoa, gia_tri, trich_dan, can = null) => ({ khoa, gia_tri, trich_dan, can });
  const chon = (dat, dong, facts = {}) => chonDeGhi(dat, soSanhVoiDb(dat, dong, facts), dong, facts);
  const lyDo = (r, khoa) => r.bo.find((b) => b.khoa === khoa)?.ly_do;

  const r1 = chon([dx("gia", "32 tỷ", "giá 32 tỷ"), dx("huong", "Đông Nam", "hướng Đông Nam"), dx("dien_tich", "240", "diện tích tổng 240m2")],
    { price_vnd: 32e9, direction: null, area_m2: null, deal: "ban" });
  ok("ghi: giá luật đã ghi (trùng) → AI không đụng; hướng trống → ghi 'huong'; 'diện tích tổng' không phải đất → bỏ",
    r1.ghi.map((g) => `${g.question}=${g.answer}`).join() === "huong=Đông Nam" && lyDo(r1, "dien_tich") === "dien_tich_khong_phai_dat", JSON.stringify(r1));
  const r2 = chon([dx("gia", "30 tỷ", "giá 30 tỷ")], { price_vnd: 32e9, deal: "ban" });
  ok("ghi: luật và AI LỆCH giá → không ghi, không đè", r2.ghi.length === 0 && r2.bo.length === 0, JSON.stringify(r2));
  const r3 = chon([dx("so_phong_ngu", "3", "3 phòng ngủ"), dx("so_wc", "70", "70 wc"), dx("so_tang", "4", "trệt 3 lầu"), dx("do_rong_hem", "5", "hẻm 5m"), dx("phuong", "14", "phường 14"), dx("gap", "co", "cần bán gấp")],
    { bedrooms: null, bathrooms: null, floors: null, alley_width_m: null, ward: null, gap: null });
  ok("ghi: số trong khoảng → ghi đúng dạng (3 · '4 tầng' vào ket_cau · '5m' · 'Phường 14' · cụm gấp); 70 wc ngoài khoảng → bỏ",
    r3.ghi.map((g) => `${g.question}=${g.answer}`).join("|") === "so_phong_ngu=3|ket_cau=4 tầng|do_rong_hem=5m|phuong=Phường 14|gap=cần bán gấp" && lyDo(r3, "so_wc") === "so_ngoai_khoang", JSON.stringify(r3));
  const r4 = chon([dx("quan", "Quận 5", "quận 5"), dx("duong", "Châu Văn Liêm", "đường Châu Văn Liêm"), dx("ma_can", "S1.02", "căn S1.02")], { district: null, street: null, unit_code: null });
  ok("ghi: quận / đường / mã căn không có chỗ ghi fact → bỏ khoa_khong_co_cho_ghi", r4.ghi.length === 0 && r4.bo.every((b) => b.ly_do === "khoa_khong_co_cho_ghi") && r4.bo.length === 3, JSON.stringify(r4));
  const r5 = chon([dx("so_tang", "4", "trệt 3 lầu"), dx("ket_cau", "trệt 3 lầu", "trệt 3 lầu")], { floors: null });
  ok("ghi: hai khoá cùng đổ về ket_cau → ghi một, cái sau fact_da_co", r5.ghi.length === 1 && lyDo(r5, "ket_cau") === "fact_da_co", JSON.stringify(r5));
  const r6 = chon([dx("huong", "Tây", "hướng Tây", 2)], { direction: null });
  ok("ghi: trường căn thứ 2 → không ghi vào tin căn 1", r6.ghi.length === 0 && r6.bo.length === 0, JSON.stringify(r6));
  const r7 = chon([dx("gia", "32 tỷ", "giá 32 tỷ")], { price_vnd: null, deal: "cho_thue" });
  ok("ghi: giá thuê 32 tỷ ngoài khoảng thuê → bỏ gia_ngoai_khoang", r7.ghi.length === 0 && lyDo(r7, "gia") === "gia_ngoai_khoang", JSON.stringify(r7));
  const r8 = chon([dx("gia", "45 triệu", "45 triệu/tháng"), dx("tien_coc", "2 tháng", "cọc 2 tháng"), dx("dien_tich", "62,5", "62,5m²")], { price_vnd: null, deal: "cho_thue", area_m2: null });
  ok("ghi: giá thuê trong khoảng, cọc theo tháng, diện tích '62,5' → '62.5m2'",
    r8.ghi.map((g) => `${g.question}=${g.answer}`).join("|") === "gia=45 triệu|tien_coc=2 tháng|dien_tich=62.5m2", JSON.stringify(r8));
  const r9 = chon([dx("dien_tich", "80", "80m2")], { area_m2: null }, { dien_tich_san: "240m2" });
  ok("ghi: tin đã có fact sàn → AI không ghi diện tích đất (luật cố ý để trống)", r9.ghi.length === 0 && lyDo(r9, "dien_tich") === "dien_tich_khong_phai_dat", JSON.stringify(r9));
}

// ── 17/09/2026: AI đọc trước cho câu treo + kiến thức thêm ──
{
  const dx = (khoa, gia_tri, trich_dan, can = null) => ({ khoa, gia_tri, trich_dan, can });
  dat("pháp lý CHUẨN HOÁ: 'sổ hồng riêng' từ trích 'shr' (cùng mã)", "shr, nhà ở từ 2019 rồi", "phap_ly", "sổ hồng riêng", "shr");
  bo("pháp lý bịa mã khác: 'sổ hồng chung' từ trích 'shr'", "shr, nhà ở từ 2019 rồi", "phap_ly", "sổ hồng chung", "shr", "gia_tri_khong_nam_trong_trich_dan");
  dat("nội thất chuẩn hoá: 'full nội thất' từ 'full nt'", "full nt, 2 máy lạnh", "noi_that", "full nội thất", "full nt");
  ok("câu treo pháp lý: AI 'sổ hồng riêng' → giá trị cho luật ghi", giaTriChoCauTreo([dx("phap_ly", "sổ hồng riêng", "shr")], "phap_ly", {}) === "sổ hồng riêng");
  ok("câu treo diện tích đất: AI dien_tich '62,5' → '62.5m2'", giaTriChoCauTreo([dx("dien_tich", "62,5", "62,5m²")], "dien_tich_dat", { area_m2: null }) === "62.5m2");
  ok("câu treo giá: AI không có khoá đó → null", giaTriChoCauTreo([dx("huong", "Đông", "hướng Đông")], "gia", {}) === null);
  ok("câu treo số WC: AI '70' ngoài khoảng → null", giaTriChoCauTreo([dx("so_wc", "70", "70 wc")], "so_wc", {}) === null);
  const tin = "shr, nhà ở từ 2019 rồi, gần chợ Bình Tây, khu an ninh, gần chợ bình tây";
  const kt = kiemKienThuc(["gần chợ Bình Tây", "khu an ninh", "gần chợ bình tây", "có hồ bơi", "nhà ở từ 2019 rồi"], tin, [dx("hien_trang", "nhà ở từ 2019 rồi", "nhà ở từ 2019 rồi")]);
  ok("kiến thức: nguyên văn giữ, trùng bỏ, bịa ('có hồ bơi') bỏ, trùng trích dẫn đã có khoá bỏ", kt.join("|") === "gần chợ Bình Tây|khu an ninh", JSON.stringify(kt));
  ok("kiến thức: tối đa 3", kiemKienThuc(["a1 b", "c2 d", "e3 f", "g4 h"], "a1 b c2 d e3 f g4 h", []).length === 3);
}

// ── 21/09/2026 chế độ `chinh` — AI là đường chính: `docAiChinh` + câu treo mặt tiền / diện tích từ ngang×dài ──
{
  const dx = (khoa, gia_tri, trich_dan, can = null) => ({ khoa, gia_tri, trich_dan, can });
  ok("câu treo MẶT TIỀN: AI ngang 4 + dài 16 → 'ngang 4m dài 16m'", giaTriChoCauTreo([dx("ngang", "4", "ngang 4"), dx("dai", "16", "dài 16")], "mat_tien", {}) === "ngang 4m dài 16m");
  ok("câu treo MẶT TIỀN: chỉ ngang → '4.5m'", giaTriChoCauTreo([dx("ngang", "4.5", "ngang 4.5")], "mat_tien", {}) === "4.5m");
  ok("câu treo DIỆN TÍCH ĐẤT chưa có m², có ngang×dài → '5x20'", giaTriChoCauTreo([dx("ngang", "5", "5x20"), dx("dai", "20", "5x20")], "dien_tich_dat", {}) === "5x20");
  ok("câu treo diện tích: có dien_tich thì ưu tiên dien_tich", giaTriChoCauTreo([dx("dien_tich", "100", "100m2"), dx("ngang", "5", "5x20"), dx("dai", "20", "5x20")], "dien_tich", {}) === "100m2");
  const a = docAiChinh([
    dx("gia", "1 tỷ 8", "giá 1 tỷ 8"), dx("loai_bds", "chung_cu", "căn hộ"), dx("loai_giao_dich", "ban", "bán"),
    dx("quan", "quận 7", "quận 7"), dx("duong", "Nguyễn Lương Bằng", "đường Nguyễn Lương Bằng"), dx("du_an", "Sunrise City", "Sunrise City"),
    dx("so_phong_ngu", "2", "2 phòng ngủ"), dx("ngang", "5", "5x20"), dx("dai", "20", "5x20"), dx("gap", "co", "cần bán gấp"), dx("ma_can", "a12-05", "căn a12-05"),
    dx("no_hau", "6", "nở hậu 6m"),
  ], null);
  const ghi = Object.fromEntries(a.ghi.map((g) => [g.question, g.answer]));
  ok("docAiChinh: fact ghép đủ — dien_tich '5x20' (ngang×dài, chưa có m²), vi_tri, du_an_ten, loai_giao_dich, loai_bds, gia, so_phong_ngu, gap (cụm khách nói)",
    ghi.dien_tich === "5x20" && ghi.vi_tri === "Nguyễn Lương Bằng" && ghi.du_an_ten === "Sunrise City" && ghi.loai_giao_dich === "ban" && ghi.loai_bds === "chung_cu" &&
      ghi.gia === "1 tỷ 8" && ghi.so_phong_ngu === "2" && ghi.gap === "cần bán gấp" && !("mat_tien" in ghi), JSON.stringify(a));
  ok("docAiChinh: cột lõi — quận chuẩn hoá 'Quận 7', loại, giao dịch, giá, 2 PN, ngang/dài, gấp true, mã căn A12-05, dienTich null (đã là AxB)",
    a.quan === "Quận 7" && a.loaiBds === "chung_cu" && a.loaiGiaoDich === "ban" && a.gia === "1 tỷ 8" && a.soPhongNgu === 2 && a.ngang === 5 && a.dai === 20 &&
      a.gap === true && a.maCan === "A12-05" && a.dienTich === null && a.duong === "Nguyễn Lương Bằng" && a.duAn === "Sunrise City", JSON.stringify(a));
  ok("docAiChinh: nở hậu chưa có ô → nằm trong `bo` (khoa_khong_co_cho_ghi), không mất dấu", a.bo.some((b) => b.khoa === "no_hau" && b.ly_do === "khoa_khong_co_cho_ghi"), JSON.stringify(a.bo));
  const b = docAiChinh([dx("dien_tich", "80", "80m2"), dx("ngang", "4", "ngang 4m"), dx("dai", "20", "dài 20m"), dx("quan", "Quận Ba Đình", "quận Ba Đình"), dx("loai_bds", "nha_mat_tien", "nhà mặt tiền")], null);
  const ghiB = Object.fromEntries(b.ghi.map((g) => [g.question, g.answer]));
  ok("docAiChinh: có m² lẫn ngang×dài → dien_tich '80m2' + mat_tien 'ngang 4m dài 20m'; dienTich 80; quận lạ → null; loại ngoài danh sách → null",
    ghiB.dien_tich === "80m2" && ghiB.mat_tien === "ngang 4m dài 20m" && b.dienTich === 80 && b.quan === null && b.loaiBds === null, JSON.stringify(b));
  const c = docAiChinh([], null);
  ok("docAiChinh: AI không nói gì → ghi rỗng, mọi cột null (nơi gọi rơi về luật)", c.ghi.length === 0 && c.gia === null && c.quan === null && c.loaiBds === null && c.gap === null);
  bo("hiện trạng 'xe hơi' từ 'hẻm xe hơi' (không tả tình trạng nhà)", "ngang 5 dài 20 nha, hẻm xe hơi", "hien_trang", "xe hơi", "hẻm xe hơi", "gia_tri_khong_dung_loai_truong");
  dat("hiện trạng 'trống' từ 'nhà đang trống'", "phường 7, nhà đang trống dọn vô ở liền", "hien_trang", "trống", "nhà đang trống");
  dat("hiện trạng 'mới sơn sửa lại'", "nhà mới sơn sửa lại", "hien_trang", "mới sơn sửa lại", "nhà mới sơn sửa lại");
  ok("kiến thức: lời hứa / lời nói chuyện ('để em coi lại sổ rồi báo', 'cảm ơn em') KHÔNG vào mô tả; 'gần chợ' vẫn vào",
    kiemKienThuc(["để em coi lại sổ rồi báo", "cảm ơn em nha", "gần chợ Bình Chánh"], "ngang 5 dài 20, để em coi lại sổ rồi báo, cảm ơn em nha, gần chợ Bình Chánh", []).join("|") === "gần chợ Bình Chánh");
  // Tạo tin: khoảng giá theo loại giao dịch AI đọc (bắn thật mau-v-06: "2tr8/tháng" phòng trọ).
  const d6 = docAiChinh([dx("gia", "2tr8", "2tr8/thang"), dx("loai_giao_dich", "cho_thue", "cho thue")], null);
  ok("docAiChinh: thuê 2tr8 đạt khoảng giá THUÊ nhờ loai_giao_dich AI đọc; 'cho_thue' chuẩn hoá đúng", d6.gia === "2tr8" && d6.loaiGiaoDich === "cho_thue" && d6.ghi.some((g) => g.question === "loai_giao_dich" && g.answer === "cho_thue"), JSON.stringify(d6));
  ok("docAiChinh: thuê 2tr8 mà AI không nói loại, dong.deal = cho_thue (luật đỡ) → vẫn đạt", docAiChinh([dx("gia", "2tr8", "2tr8/thang")], { deal: "cho_thue" }).gia === "2tr8");
  // FR-208 (g): KHỚP MỜ trích dẫn ≤ 3 ký tự, chữ số phải y hệt, cụm ≥ 10 ký tự.
  const kMo = kiemDeXuat([dx("duong", "Châu Văn Liêm", "đường Châu Văn Liên")], MT);
  ok("khớp mờ: trích 'đường Châu Văn Liên' (lệch 1 chữ) → đạt, ghi lại cụm thật", kMo.dat.length === 1 && kMo.dat[0].trich_dan_sua === "duong chau van liem", JSON.stringify(kMo));
  bo("khớp mờ KHÔNG đổi chữ số: 'dài 16m' khi tin là 'dài 18m'", MT, "dai", "16", "ngang 4.2m dài 16m", "trich_dan_khong_co_trong_tin");
  bo("khớp mờ tối đa 3 ký tự: lệch 4 → bỏ", MT, "duong", "Châu Văn Liêm", "đường Chou Vin Liun", "trich_dan_khong_co_trong_tin");
  bo("khớp mờ không áp cho cụm ngắn (< 10 ký tự)", "sổ hồng riêng, hẻm 5m", "phap_ly", "sổ hồng", "sô hùng", "trich_dan_khong_co_trong_tin");
  ok("khớp mờ vẫn qua kiểm lớp 2: 'giá 30 tỷ' trích 'giá 32 tỷ còn thương lượng' lệch chữ → tiền không khớp vẫn bỏ",
    kiemDeXuat([dx("gia", "30 tỷ", "giá 32 tỷ còn thương lương")], MT).bo[0]?.ly_do === "tien_khong_khop_trich_dan");
  dat("thu nhập thuê của toà nhà BÁN: 'thu nhập 180 triệu/tháng'", "Bán toà CHDV Phú Nhuận 6x22, thu nhập 180 triệu/tháng, giá 45 tỷ", "thu_nhap_thue", "180 triệu", "thu nhập 180 triệu/tháng");
  bo("thu nhập thuê KHÔNG áp cho tin cho thuê: 'thuê 60 triệu/tháng' của mặt bằng", MB, "thu_nhap_thue", "60 triệu", "thuê 60 triệu/tháng", "khong_phai_thu_nhap_thue");
  const dTN = docAiChinh([dx("thu_nhap_thue", "120 triệu", "thu nhập 120 triệu/tháng"), dx("loai_giao_dich", "ban", "Bán toà")], null);
  ok("docAiChinh: thu_nhap_thue → fact doanh_thu '120 triệu'; tiền không đọc được thì bỏ", dTN.ghi.some((g) => g.question === "doanh_thu" && g.answer === "120 triệu") &&
    docAiChinh([dx("thu_nhap_thue", "nhiều", "thu nhập nhiều")], null).bo.some((b) => b.khoa === "thu_nhap_thue" && b.ly_do === "khong_doc_duoc_tien"), JSON.stringify(dTN));
  // 21/09/2026 (Zalo thật): câu VỊ TRÍ lấy `duong` của AI, đã phục hồi dấu.
  const kDau = kiemDeXuat([dx("duong", "Phạm Thế Hiển", "pham the hien"), dx("quan", "Quận 8", "q8"), dx("phuong", "4", "p4")], "nhà của anh ở hem 4m pham the hien, p4 q8 nha");
  ok("phục hồi dấu: 'Phạm Thế Hiển' từ trích 'pham the hien' đạt (chữ cái y hệt, chỉ thêm dấu); 'Quận 8' từ 'q8', phường 4 từ 'p4' đạt", kDau.dat.length === 3 && kDau.bo.length === 0, JSON.stringify(kDau.bo));
  bo("phục hồi dấu KHÔNG được đổi chữ cái: 'Phạm Thế Hiếu' từ 'pham the hien'", "hem 4m pham the hien", "duong", "Phạm Thế Hiếu", "pham the hien", "gia_tri_khong_nam_trong_trich_dan");
  ok("giới hạn đã biết: dấu SAI trên cùng chữ cái ('Phạm Thế Hiền') lớp kiểm không phân biệt được — chấp nhận, hại chỉ ở dấu", kiemDeXuat([dx("duong", "Phạm Thế Hiền", "pham the hien")], "hem 4m pham the hien").dat.length === 1);
  ok("câu treo VỊ TRÍ: AI duong → 'Phạm Thế Hiển' (không ghép hẻm / phường)", giaTriChoCauTreo(kDau.dat, "vi_tri", {}) === "Phạm Thế Hiển");
  ok("câu treo VỊ TRÍ: AI không có duong → null (luật đỡ)", giaTriChoCauTreo([dx("do_rong_hem", "4", "hem 4m")], "vi_tri", {}) === null);
  ok("KHOA_FACT_AI_BIET có gia / phap_ly / vi_tri / mat_tien, KHÔNG có tien_ich_gan / nam_xay / the_chap (luật vẫn đỡ)",
    ["gia", "phap_ly", "vi_tri", "mat_tien", "loai_bds"].every((k) => KHOA_FACT_AI_BIET.has(k)) && ["tien_ich_gan", "nam_xay", "the_chap", "hem_thong"].every((k) => !KHOA_FACT_AI_BIET.has(k)));
}

{
  ok("chonViTri: luật 'hẻm 6m 12 Trần Hưng Đạo' + AI 'Trần Hưng Đạo' → '12 Trần Hưng Đạo' (số nhà luật + tên AI)",
    chonViTri("hẻm 6m 12 Trần Hưng Đạo", "Trần Hưng Đạo") === "12 Trần Hưng Đạo", chonViTri("hẻm 6m 12 Trần Hưng Đạo", "Trần Hưng Đạo"));
  ok("chonViTri: AI sửa chính tả 'Phạm Thế Hiển' ≠ luật 'pham the hier' → tin AI", chonViTri("hem 4m pham the hier", "Phạm Thế Hiển") === "Phạm Thế Hiển");
  ok("chonViTri: 'hem 4m Pham The Hien' không có số nhà → AI có dấu thắng (AIBOC-14)", chonViTri("hem 4m Pham The Hien", "Phạm Thế Hiển") === "Phạm Thế Hiển");
  ok("chonViTri: luật không dấu '123/4 an duong vuong' + AI có dấu → '123/4 An Dương Vương'", chonViTri("hem 5m 123/4 an duong vuong", "An Dương Vương") === "123/4 An Dương Vương");
  ok("chonViTri: 'Hung Vuong Plaza 126 Hung Vuong' + AI 'Hùng Vương' → '126 Hùng Vương' (lấy lần xuất hiện có số nhà)",
    chonViTri("Hung Vuong Plaza 126 Hung Vuong", "Hùng Vương") === "126 Hùng Vương", chonViTri("Hung Vuong Plaza 126 Hung Vuong", "Hùng Vương"));
  ok("chonViTri: thiếu một bên → lấy bên còn lại; cả hai rỗng → null", chonViTri(null, "Trần Hưng Đạo") === "Trần Hưng Đạo" && chonViTri("12 Trần Hưng Đạo", null) === "12 Trần Hưng Đạo" && chonViTri("", "") === null);
}

// ── 24/09/2026 (chủ dự án test Zalo): số nhà "137/28" không phải số đo; "dài 16m" ghép ngang đã có trong tin ──
{
  const dx = (khoa, gia_tri, trich_dan) => ({ khoa, gia_tri, trich_dan });
  const T = "137/28 nhé em, cần bán gấp giá 5 tỏi 9 thương lượng 5 tỏi 5 là bán được";
  bo("số nhà 137/28 đọc thành diện tích 137m2", T, "dien_tich", "137", "137/28", "so_khong_co_trong_trich_dan");
  bo("số nhà 137/28 đọc thành ngang 28", T, "ngang", "28", "137/28", "so_khong_co_trong_trich_dan");
  dat("diện tích thật vẫn đạt khi câu có cả số nhà", "137/28 đường số 59, 80m2", "dien_tich", "80", "80m2");
  ok("câu treo diện tích: AI chỉ 'dài 16', tin có ngang 5 → '5x16'", giaTriChoCauTreo([dx("dai", "16", "dài 16m")], "dien_tich_dat", { frontage_m: 5 }) === "5x16", String(giaTriChoCauTreo([dx("dai", "16", "dài 16m")], "dien_tich_dat", { frontage_m: 5 })));
  ok("câu treo diện tích: AI chỉ 'dài 16', ngang trong tin là chuỗi '5' → '5x16'", giaTriChoCauTreo([dx("dai", "16", "dài 16m")], "dien_tich", { frontage_m: "5" }) === "5x16");
  ok("câu treo diện tích: AI chỉ 'ngang 5' (tin có dài) → null, không tự nhân", giaTriChoCauTreo([dx("ngang", "5", "ngang 5m")], "dien_tich", { length_m: 16 }) === null);
  ok("câu treo diện tích: AI chỉ 'dài 16', tin CHƯA có ngang → null", giaTriChoCauTreo([dx("dai", "16", "dài 16m")], "dien_tich_dat", { frontage_m: null }) === null);
}

{
  // FR-223 (bắn thật 24/09): model viết lại SẠCH theo prompt (bỏ từ đệm "em") → vẫn là bằng chứng hợp lệ.
  const t = "chưa có sổ em, đang chờ ra sổ";
  const r1 = kiemDeXuat([{ khoa: "phap_ly", gia_tri: "chưa có sổ, đang chờ ra sổ", trich_dan: t, can: null }], t);
  ok("pháp lý bỏ từ đệm 'em' khỏi giá trị → vẫn ĐẠT", r1.dat.length === 1, JSON.stringify(r1));
  const r2 = kiemDeXuat([{ khoa: "phap_ly", gia_tri: "sổ hồng riêng", trich_dan: t, can: null }], t);
  ok("bỏ từ đệm KHÔNG mở đường bịa: 'sổ hồng riêng' từ 'chưa có sổ em…' → vẫn LOẠI", r2.dat.length === 0, JSON.stringify(r2));
  const t3 = "nội thất để lại hết nha anh";
  const r3 = kiemDeXuat([{ khoa: "noi_that", gia_tri: "để lại hết", trich_dan: t3, can: null }], t3);
  ok("nội thất 'để lại hết nha anh' → 'để lại hết' ĐẠT", r3.dat.length === 1, JSON.stringify(r3));
}

console.log(hong ? `\nKIỂM BẰNG CHỨNG: ${hong}/${tong} CA HỎNG` : `\nKIỂM BẰNG CHỨNG: ${tong}/${tong} CA ĐẠT`);
process.exit(hong ? 1 : 0);
