// boc-cau-rao.mjs — lượt bắn 14 tin RAO BÁN thật 14/09/2026, phần tiền định.
// Không mạng, không DB, không model.   bun bot/tests/boc-cau-rao.mjs
//
// Phần SQL của cùng lượt bắn (fact "cách mặt tiền" vào cột, "p5" dính tên đường, xe hơi
// trong nhà) ở migration 20260914b.
import { chonGiaRao, dealCauRao, dienTichCauRao, duAnLaTenDuong, DUOI_GIA, laSoNhaHem, ngangNhanDai, phuongTenCauRao, phuongTenKhongDau } from "../supabase/functions/_shared/extraction/boc-cau-rao.ts";
import { bocViTriRao, laBoSungRac, nhanDienFact, nhanDienNhieuFact, phanLoaiCauTraLoi } from "../supabase/functions/_shared/extraction/khop-cau-tra-loi.ts";

let hong = 0, tong = 0;
const ok = (ten, dat, chi = "") => { tong++; if (!dat) hong++; console.log(`${dat ? "✓" : "✗"} ${ten}${dat ? "" : `  → ${chi}`}`); };
const kd = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
// Cùng đuôi giá với chat-reply — một nguồn `DUOI_GIA` (15/09).
const gia = (c) => chonGiaRao(c, dealCauRao(kd(c)), DUOI_GIA);
// 15/09/2026 (bắn thật B1): đuôi giá dừng trước chữ của thứ khác.
for (const [c, mong] of [
  ["co lo dat 5x18 thu duc phuong hiep binh chanh gia 6ty2 shr thanh khoan nhanh ko ban", "6ty2"],
  ["bán nhà q5 giá 5 tỷ thương lượng", "5 tỷ thương lượng"],
  ["bán nhà q5 5 tỷ 8 50m2", "5 tỷ 8"],
  ["nhà mặt tiền giá 32 tỷ sổ hồng riêng, 5x20", "32 tỷ"],
  ["bán đất 2 tỷ 3 hẻm xe hơi", "2 tỷ 3"],
  ["cho thuê 25 triệu/tháng full nội thất", "25 triệu/tháng"],
]) ok("đuôi giá " + JSON.stringify(c.slice(0, 40)) + " → " + mong, gia(c)?.trim() === mong, JSON.stringify(gia(c)));

// ── bán hay cho thuê ──
for (const [c, mong] of [
  ["bán nhà mặt tiền đường Châu Văn Liêm phường 14 quận 5, ngang 4.2m dài 18m, đang cho thuê 45 triệu/tháng, giá 32 tỷ còn thương lượng", "ban"],
  ["sang nhượng mặt bằng quán cà phê Quận 1 đường Nguyễn Trãi, 8x20, thuê 60 triệu/tháng, phí sang 350 triệu", "cho_thue"],
  ["Cần sang nhượng căn hộ The Sun Avenue quận 2 3pn 96m2, HĐMB, giá 5 tỷ", "ban"],
  ["cho thuê căn hộ Sunrise City quận 7, 76m2, 18 triệu một tháng", "cho_thue"],
  ["cho thuê nhà nguyên căn, bán cũng được nếu giá tốt", "cho_thue"],
  ["bán nhà có hợp đồng thuê 20 triệu, giá 9 tỷ", "ban"],
  ["gia đình cần tiền nên để lại căn nhà 4x16 hẻm xe hơi Trần Hưng Đạo", "ban"],
  ["bán đất Củ Chi 100m2 thổ cư, 900tr", "ban"],
]) ok(`deal: '${c.slice(0, 60)}…' → ${mong}`, dealCauRao(kd(c)) === mong, dealCauRao(kd(c)));

// ── giá ──
for (const [c, mong] of [
  ["bán nhà mặt tiền Châu Văn Liêm, đang cho thuê 45 triệu/tháng, giá 32 tỷ còn thương lượng", "32 tỷ còn thương lượng"],
  ["sang nhượng mặt bằng Quận 1, 8x20, thuê 60 triệu/tháng, phí sang 350 triệu", "60 triệu/tháng"],
  ["cho thuê nhà nguyên căn, cọc 2 tháng 30 triệu, giá thuê 15 triệu", "15 triệu"],
  ["bán nhà quận 5 phường 7, 50m2, 6 tỷ", "6 tỷ"],
  ["bán nhà q8, hoa hồng 50 triệu, giá 4 tỷ 2", "4 tỷ 2"],
  ["bán đất thổ cư Nhà Bè 120m2, 45tr/m2 tổng 5 tỷ 4, đã có người cọc 200tr nhưng bể cọc", "45tr/m2 tổng 5 tỷ 4"],
  ["anh nói giá 5 tỷ nha em, nhà 4x15", "5 tỷ nha em"] /* đuôi tiểu từ do chuan_hoa_gia_raw gọt; trước 14/09 ra null vì "nói" khớp "no" (nợ) */,
  ["giá 8 tỷ thương lượng, cọc giữ chỗ 100 triệu", "8 tỷ thương lượng"],
  ["thương lượng 7 tỷ 5", "7 tỷ 5"],
]) ok(`giá: '${c.slice(0, 55)}…' → ${mong}`, gia(c) === mong, String(gia(c)));

// ── diện tích, giá mỗi m² ──
ok("diện tích: '62,5m²' → 62.5", dienTichCauRao(kd("diện tích 62,5m², 1 trệt 1 lầu")) === 62.5);
ok("diện tích: '70m2' → 70", dienTichCauRao(kd("DT: 5x14 (70m2)")) === 70);
ok("diện tích: '5x20' không phải m² → null", dienTichCauRao(kd("lô 5x20, đường 12m")) === null);
// 16/09/2026 (Zalo thật): sàn không phải đất.
ok("diện tích: 'nhà 4 tấm diện tích tổng 240m2' → null (sàn)", dienTichCauRao(kd("nhà 4 tấm diện tích tổng 240m2 giá 6 tỷ")) === null);
ok("diện tích: 'diện tích sàn 240m2, đất 60m2' → 60", dienTichCauRao(kd("diện tích sàn 240m2, đất 60m2")) === 60);
ok("diện tích: 'tổng diện tích 500m2' (không tầng) → 500", dienTichCauRao(kd("bán lô đất tổng diện tích 500m2")) === 500);
ok("diện tích: 'dtsd 120m2' → null", dienTichCauRao(kd("căn hộ dtsd 120m2 3pn")) === null);
ok("ngang × dài: '5x20' → 100 (để nhân giá/m²)", ngangNhanDai(kd("lô đất 5x20, giá 95 triệu/m2")) === 100);
ok("ngang × dài: '4.2m x 18m' → 75.6", ngangNhanDai(kd("ngang 4.2m x 18m")) === 75.6);
// 20/09/2026 (bắn thật mau-y-D): "ngang 4 dài 15, giá 250 triệu/m2" không có "x" → phải nhân được.
ok("ngang × dài: 'ngang 4 dài 15' → 60", ngangNhanDai(kd("mặt tiền Nguyễn Chí Thanh quận 5, ngang 4 dài 15, giá 250 triệu/m2")) === 60);
ok("ngang × dài: 'ngang 5m, dài 20m' → 100", ngangNhanDai(kd("đất ngang 5m, dài 20m thổ cư")) === 100);
ok("ngang × dài: 'ngang 5m còn dọc 16m' → 80", ngangNhanDai(kd("ngang 5m còn dọc 16m")) === 80);
ok("ngang × dài: chỉ 'ngang 5m' → null", ngangNhanDai(kd("ngang 5m hẻm 4m")) === null);

// ── phường tên chữ ──
ok("phường: 'phường Hiệp Bình Chánh TP Thủ Đức' → Phường Hiệp Bình Chánh", phuongTenCauRao("cần bán nhà phường Hiệp Bình Chánh TP Thủ Đức, 62m2") === "Phường Hiệp Bình Chánh", String(phuongTenCauRao("cần bán nhà phường Hiệp Bình Chánh TP Thủ Đức, 62m2")));
ok("phường: 'Phường Bến Nghé Quận 1' → Phường Bến Nghé", phuongTenCauRao("bán nhà Phường Bến Nghé Quận 1") === "Phường Bến Nghé");
ok("phường: 'phường nào cũng được' (chữ thường) → null", phuongTenCauRao("ở phường nào cũng được") === null);
ok("phường: 'phường 7' (số) → null (soPhuong lo)", phuongTenCauRao("bán nhà phường 7") === null);
// 15/09/2026 (bắn thật B1): phường tên chữ KHÔNG DẤU → tên bỏ dấu để tra `wards`.
for (const [c, mong] of [
  ["co lo dat 5x18 thu duc phuong hiep binh chanh gia 6ty2 shr", "hiep binh chanh"],
  ["ban nha phuong tan hung quan 7 50m2", "tan hung"],
  ["ban nha phuong 7 quan 8", null],
  ["o phuong nao cung duoc", null],
  ["ban nha p. an lac binh tan", "an lac"],
]) ok("phường không dấu " + JSON.stringify(c.slice(0, 40)), phuongTenKhongDau(c) === mong, String(phuongTenKhongDau(c)));

// ── dự án trùng tên đường ──
ok("dự án: 'đường Huỳnh Tấn Phát' không phải 'Căn Hộ Cao Cấp Huỳnh Tấn Phát'", duAnLaTenDuong("Căn Hộ Cao Cấp Huỳnh Tấn Phát", "bán nhà phố quận 7 đường Huỳnh Tấn Phát 5x20 giá 11 tỷ"));
ok("dự án: câu nói 'căn hộ Vinhomes Grand Park' → giữ dự án", !duAnLaTenDuong("The Beverly - Vinhomes Grand Park", "bán căn hộ Vinhomes Grand Park Thủ Đức"));
ok("dự án: 'chung cư Huỳnh Tấn Phát' (có chữ chung cư) → giữ", !duAnLaTenDuong("Căn Hộ Cao Cấp Huỳnh Tấn Phát", "bán căn chung cư Huỳnh Tấn Phát quận 7"));
ok("dự án: tên dự án không trùng đường nào → giữ", !duAnLaTenDuong("Sunrise City", "bán nhà hẻm Nguyễn Hữu Thọ quận 7 gần Sunrise City"));

// ── vị trí trong câu rao ──
for (const [c, mong] of [
  ["nhà cấp 4 hẻm ba gác đường Phạm Thế Hiển p6 q8, 3.5x12", "hẻm ba gác đường Phạm Thế Hiển"],
  ["em bên môi giới ạ, có căn nhà phố Tân Bình đường Cộng Hòa p4, 4x20", "đường Cộng Hòa"],
  ["e bán nhà hxh Nguyễn Kiệm Phú Nhuận 4x15 trệt 2 lầu", "hxh Nguyễn Kiệm"],
  ["anh cần bán căn nhà hẻm xe hơi 5m Nguyễn Trãi phường 3 quận 5", "hẻm xe hơi 5m Nguyễn Trãi"],
  ["bán nhà 123/4 An Dương Vương p8 q5", "123/4 An Dương Vương"],
  ["nhà phố đường An Dương Vương q5", "đường An Dương Vương"],
  ["Hẻm 6m Lê Văn Sỹ, P.13, Q.3", "Hẻm 6m Lê Văn Sỹ"],
  // 15/09/2026 (Zalo thật): "mới làm lại" là lời tả, không phải tên đường.
  ["căn hộ 5 tầng có sổ hồng riêng, đường Lê Văn Việt mới làm lại rất rộng, số nhà tôi là số449", "đường Lê Văn Việt"],
]) ok(`vị trí: '${c.slice(0, 50)}' → ${mong}`, bocViTriRao(c) === mong, String(bocViTriRao(c)));

// ── câu bổ sung sau khi tạo tin ──
{
  const f = nhanDienNhieuFact("hẻm rộng tầm 2m5 thôi em, cách mặt tiền 50m");
  const hem = f.find((x) => x.question === "do_rong_hem");
  ok("bổ sung: 'hẻm rộng tầm 2m5' → do_rong_hem 'hẻm 2.5m' (kèm cách mặt tiền 50m)", hem?.answer === "hẻm 2.5m" && f.some((x) => x.question === "cach_mat_tien"), JSON.stringify(f));
}
ok("bổ sung: '5m2' KHÔNG thành hẻm 5.2m", nhanDienFact("hẻm 5m2")?.answer !== "hẻm 5.2m", JSON.stringify(nhanDienFact("hẻm 5m2")));
ok("bổ sung: 'hẻm khoảng 4m' → hẻm 4m", nhanDienFact("hẻm khoảng 4m")?.answer === "hẻm 4m", JSON.stringify(nhanDienFact("hẻm khoảng 4m")));
{
  const t = "à anh nói lại, là đất trống chưa xây nha em";
  const k = phanLoaiCauTraLoi("gap", t);
  ok("gấp: đang hỏi gấp, 'là đất trống chưa xây' → lệch sang loại BĐS (không ghi vào ô gấp)", k.loai === "lech" && k.chuyenSang?.question === "loai_bds", JSON.stringify(k));
  ok("gấp: 'không gấp em' vẫn là câu trả lời gấp", phanLoaiCauTraLoi("gap", "không gấp em, bán được giá thì thôi").loai === "khop");
  ok("gấp: 'cần tiền nên bán nhanh' → khớp", phanLoaiCauTraLoi("gap", "cần tiền nên muốn bán nhanh").loai === "khop");
}
ok("loại: 'đất trống chưa xây' → loai_bds đất trống", nhanDienFact("là đất trống chưa xây nha")?.question === "loai_bds");
ok("loại: 'đất được xây 5 tầng' KHÔNG phải đổi loại", nhanDienFact("đất được xây 5 tầng")?.question !== "loai_bds", JSON.stringify(nhanDienFact("đất được xây 5 tầng")));
{
  const f = nhanDienNhieuFact("🏡 CHÍNH CHỦ BÁN GẤP NHÀ QUẬN 3\n🏢 Kết cấu: 3 tấm, 4PN 3WC\n📜 Sổ hồng riêng, hoàn công đủ");
  const pl = f.find((x) => x.question === "phap_ly");
  ok("rao Facebook: đáp án bỏ biểu tượng + nhãn ('📜 Sổ hồng riêng' → 'Sổ hồng riêng')", pl?.answer === "Sổ hồng riêng", JSON.stringify(f));
}

{
  // 24/09/2026 (xuất prompt lượt Trần Đình Xu): "và" giữa hai số không phải ranh mảnh; "tầng 1 và 2" không phải căn hộ tầng 1.
  const f = nhanDienNhieuFact("4 phòng ngủ em, còn tầng 1 và 2 là để kinh doanh");
  ok("'tầng 1 và 2 là để kinh doanh' → không cắt ra '2 là để kinh doanh'", !f.some((x) => /^2 là/.test(x.answer)), JSON.stringify(f));
  ok("'tầng 1 và 2' của nhà phố không thành tang=1", !f.some((x) => x.question === "tang"), JSON.stringify(f));
  ok("vẫn đọc 4 phòng ngủ", f.some((x) => x.question === "so_phong_ngu" && x.answer === "4"), JSON.stringify(f));
  const g = nhanDienNhieuFact("3 phòng ngủ và 2 wc");
  ok("'3 phòng ngủ và 2 wc' vẫn tách hai mảnh", g.some((x) => x.question === "so_wc" && x.answer === "2"), JSON.stringify(g));
  ok("'căn hộ tầng 12' vẫn là tang", nhanDienFact("căn hộ tầng 12 em")?.question === "tang");
}

{
  // FR-223 (bắn thật 24/09, rn-test-h): hỏi TIỀN THUÊ mà đáp một số tiền → khớp, KHÔNG lệch sang giá bán.
  ok("hỏi doanh_thu, đáp '150 triệu một tháng em' → khớp (không chuyển sang gia)", phanLoaiCauTraLoi("doanh_thu", "150 triệu một tháng em").loai === "khop", JSON.stringify(phanLoaiCauTraLoi("doanh_thu", "150 triệu một tháng em")));
  ok("hỏi tien_coc, đáp '2 tháng tiền nhà, tầm 30 triệu' → không lệch sang gia", phanLoaiCauTraLoi("tien_coc", "30 triệu em").chuyenSang?.question !== "gia", JSON.stringify(phanLoaiCauTraLoi("tien_coc", "30 triệu em")));
  ok("hỏi GIÁ vẫn nhận tiền như cũ", phanLoaiCauTraLoi("gia", "25 tỷ em").loai === "khop");
}

// 24/09/2026 (chủ dự án test Zalo, tin 152 Trần Đình Xu): hợp đồng THUÊ không phải pháp lý; mảnh rác không vào "📝 Thêm".
{
  const q = (s) => nhanDienFact(s)?.question;
  ok("'Hợp đồng 10 năm cho thuê 4 năm rồi đó' → han_hop_dong_thue (không phải pháp lý)", q("Hợp đồng 10 năm cho thuê 4 năm rồi đó") === "han_hop_dong_thue", q("Hợp đồng 10 năm cho thuê 4 năm rồi đó"));
  ok("'hợp đồng 10 năm' → han_hop_dong_thue", q("hợp đồng 10 năm") === "han_hop_dong_thue");
  ok("'còn hợp đồng 6 năm' → han_hop_dong_thue", q("còn hợp đồng 6 năm") === "han_hop_dong_thue");
  ok("'hợp đồng mua bán công chứng' vẫn là pháp lý", q("hợp đồng mua bán công chứng") === "phap_ly");
  ok("'HĐMB' vẫn là pháp lý", q("HĐMB") === "phap_ly");
  ok("hỏi 'thuê tối thiểu', đáp 'hợp đồng 1 năm' → khớp", phanLoaiCauTraLoi("thoi_han_thue", "hợp đồng 1 năm").loai === "khop");
  ok("hỏi hạn hợp đồng, đáp 'Hợp đồng 10 năm cho thuê 4 năm rồi đó' → khớp", phanLoaiCauTraLoi("han_hop_dong_thue", "Hợp đồng 10 năm cho thuê 4 năm rồi đó").loai === "khop");
  for (const r of ["Quận 1 em ơi", "mới", "phường 2 nha", "ok em"]) ok(`rác bổ sung: ${JSON.stringify(r)}`, laBoSungRac(r));
  for (const r of ["ko có lửng", "tầng 1 và 2 để kinh doanh đang cho techcombank thuê", "sổ đỏ", "gần chợ Bình Tây", "khu an ninh"]) ok(`KHÔNG rác: ${JSON.stringify(r)}`, !laBoSungRac(r));
}

// 24/09/2026 — bắn 10 tin bán đủ loại trên production (ID giả bn10-*).
{
  const ph = (t) => phuongTenCauRao(t);
  ok("rao 'xã Phước Vĩnh An huyện Củ Chi' → Xã Phước Vĩnh An", ph("Bán đất vườn 2000m2 xã Phước Vĩnh An huyện Củ Chi") === "Xã Phước Vĩnh An", ph("Bán đất vườn 2000m2 xã Phước Vĩnh An huyện Củ Chi"));
  ok("rao 'xã Tân Kiên Bình Chánh' → Xã Tân Kiên (cắt tên huyện dính liền)", ph("Bán kho xưởng 1500m2 xã Tân Kiên Bình Chánh, cao 10m") === "Xã Tân Kiên", ph("Bán kho xưởng 1500m2 xã Tân Kiên Bình Chánh, cao 10m"));
  ok("rao 'thị trấn Nhà Bè' → Thị trấn Nhà Bè", ph("Bán nhà hẻm 4m Huỳnh Tấn Phát thị trấn Nhà Bè, 4x12") === "Thị trấn Nhà Bè");
  ok("'phường Bến Thành' giữ nguyên (không cắt 'Thành')", ph("nhà phường Bến Thành") === "Phường Bến Thành", ph("nhà phường Bến Thành"));
  ok("'Phường Hiệp Bình Chánh' không bị cắt thành 'Hiệp'", ph("Phường Hiệp Bình Chánh TP Thủ Đức") === "Phường Hiệp Bình Chánh", ph("Phường Hiệp Bình Chánh TP Thủ Đức"));
  const nn = (t) => nhanDienNhieuFact(t);
  const bt = nn("Bán biệt thự sân vườn Thảo Điền quận 2, đất 300m2, 1 hầm 1 trệt 2 lầu, có hồ bơi");
  ok("'biệt thự sân vườn … quận 2' → KHÔNG ghi cả câu vào ô sân vườn", !bt.some((f) => f.question === "san_vuon"), JSON.stringify(bt));
  ok("'sân trước 20m2' vẫn là sân vườn", nn("sân trước 20m2").some((f) => f.question === "san_vuon" && f.answer === "sân trước 20m2"));
  ok("'cao 10m như anh nói rồi' → chiều cao 10m", nn("cao 10m như anh nói rồi").some((f) => f.question === "chieu_cao" && f.answer === "10m"));
  const chdv = nn("Bán tòa nhà CHDV 20 phòng hẻm 8m Cộng Hòa, 8x20, lấp đầy 100%");
  ok("'toà nhà CHDV 20 phòng' → số phòng 20, KHÔNG phải 20 phòng ngủ", chdv.some((f) => f.question === "so_phong" && f.answer === "20") && !chdv.some((f) => f.question === "so_phong_ngu"), JSON.stringify(chdv));
  ok("'2 lầu 3 phòng' (nhà ở) vẫn là 3 phòng ngủ", nn("2 lầu 3 phòng 2 wc").some((f) => f.question === "so_phong_ngu" && f.answer === "3"));
  ok("'vẫn bán nha em, không phải cho thuê' → loại giao dịch BÁN", nhanDienFact("vẫn bán nha em, không phải cho thuê")?.answer === "ban");
}

// 25/09/2026: số nhà có xuyệt → nhà trong hẻm (hỏi xác nhận); số trần → không suy ra gì.
{
  ok("'105/12 Trần Bình Trọng' → số nhà hẻm", laSoNhaHem("105/12 Trần Bình Trọng"));
  ok("'hẻm 12/3A Lê Lợi' → số nhà hẻm", laSoNhaHem("hẻm 12/3A Lê Lợi"));
  ok("'45 / 7 Nguyễn Trãi' (cách quanh xuyệt) → số nhà hẻm", laSoNhaHem("45 / 7 Nguyễn Trãi, Quận 5"));
  ok("'105 Trần Bình Trọng' → KHÔNG suy ra", !laSoNhaHem("105 Trần Bình Trọng, Quận 10"));
  ok("'Đường 3/2 Quận 10' → KHÔNG (tên đường)", !laSoNhaHem("Đường 3/2 Quận 10"));
  ok("rỗng → KHÔNG", !laSoNhaHem(null) && !laSoNhaHem(""));
}

console.log(hong ? `\nBÓC CÂU RAO: ${hong}/${tong} CA HỎNG` : `\nBÓC CÂU RAO: ${tong}/${tong} CA ĐẠT`);
process.exit(hong ? 1 : 0);
