// kiem-bang-chung.mjs — FR-208 (TS-AIBOC-01): code kiểm bằng chứng cho đề xuất bóc tách của model.
// Không mạng, không DB, không model.   bun bot/tests/kiem-bang-chung.mjs
//
// Hai loại ca: BỊA (model nói điều tin không có / gán nhầm ô) phải BỎ đúng lý do; ĐÚNG phải
// ĐẠT. Một ca bịa lọt vào `dat` là cổng đỏ — đó là thứ duy nhất FR-208 hứa.
import { coMuiDuLieuRao, kiemDeXuat, soSanhVoiDb } from "../supabase/functions/_shared/extraction/kiem-bang-chung.ts";

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

console.log(hong ? `\nKIỂM BẰNG CHỨNG: ${hong}/${tong} CA HỎNG` : `\nKIỂM BẰNG CHỨNG: ${tong}/${tong} CA ĐẠT`);
process.exit(hong ? 1 : 0);
