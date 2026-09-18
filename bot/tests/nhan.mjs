// nhan.mjs — FR-211 (TS-NHAN-01): từ điển nhãn tìm kiếm — nhận đúng, không nhận nhầm, phủ định.
// Tiền định: không mạng, không DB, không model.   bun bot/tests/nhan.mjs
import { ganNhan, tenNhan, NHAN_HOP_LE, TU_DIEN_NHAN } from "../supabase/functions/_shared/extraction/nhan.ts";

let hong = 0, tong = 0;
const ok = (ten, dat, chi = "") => { tong++; if (!dat) hong++; console.log(`${dat ? "✓" : "✗"} ${ten}${dat ? "" : `  → ${chi}`}`); };
const la = (cau, mong) => ok(`${JSON.stringify(cau)} → ${mong.join(",") || "∅"}`, ganNhan(cau).join(",") === mong.join(","), ganNhan(cau).join(","));

// PHẢI kích
la("khu này yên tĩnh lắm", ["yen_tinh"]);
la("gần chợ Bình Tây, nhà mới sơn sửa lại", ["gan_cho", "moi_sua"]);
la("xe hơi vào tận nhà, có gara", ["xe_hoi_vao_nha"]);
la("XE HOI VAO NHA duoc", ["xe_hoi_vao_nha"]);
la("căn góc 2 mặt tiền view sông full nội thất", ["noi_that_full", "view_song", "can_goc"]);
la("không ngập, dân trí cao, đang cho thuê 15 triệu", ["dan_tri_cao", "khong_ngap", "dong_tien"]);
la("nhà 3 lầu sân thượng có gác lửng", ["san_thuong", "gac_lung"]);
la("gần trường tiểu học, gần bệnh viện Chợ Rẫy, gần siêu thị coop", ["gan_truong", "gan_benh_vien", "gan_sieu_thi"]);
la("hẻm thông ra hai đường, an ninh có bảo vệ 24/24", ["an_ninh", "hem_thong"]);
la("thổ cư 100%, đã hoàn công đầy đủ", ["nha_hoan_cong", "tho_cu_100"]);
la("tìm nhà quận 5 yên tĩnh gần trường học tầm 6 tỷ", ["yen_tinh", "gan_truong"]);
// KHÔNG ĐƯỢC kích (phủ định, chữ trùng nghĩa khác)
la("khu không yên tĩnh, hẻm cụt", ["hem_cut"]);
la("chưa có thang máy", []);
la("ko an ninh lắm", []);
la("bán nhà hẻm 4m Nguyễn Trãi quận 5, 60m2, giá 6 tỷ 5", []);
la("nhà ở từ 2019 rồi", []);
la("Dạ em ghi nhận rồi ạ", []);
la("gần chỗ làm của con", []);
// Từ điển: mọi khoá là snake_case, có tên, regex không rỗng; tenNhan
ok("mọi khoá snake_case + có tên", Object.entries(TU_DIEN_NHAN).every(([k, n]) => /^[a-z0-9_]+$/.test(k) && n.ten.length >= 3 && n.khop instanceof RegExp));
ok("NHAN_HOP_LE khớp từ điển", NHAN_HOP_LE.size === Object.keys(TU_DIEN_NHAN).length && NHAN_HOP_LE.has("yen_tinh"));
ok("tenNhan: khoá lạ in thẳng", tenNhan(["yen_tinh", "la_lam"]) === "yên tĩnh · la lam", tenNhan(["yen_tinh", "la_lam"]));
ok("tenNhan: rỗng", tenNhan([]) === "" && tenNhan(null) === "");

console.log(hong ? `\nNHÃN: ${hong}/${tong} CA HỎNG` : `\nNHÃN: ${tong}/${tong} CA ĐẠT`);
process.exit(hong ? 1 : 0);
