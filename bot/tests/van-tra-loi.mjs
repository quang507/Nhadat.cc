// van-tra-loi.mjs — lỗi còn chờ sau lượt bắn 20 tin thật 12/09/2026, phần TS.
// Tiền định: không mạng, không DB, không model.
//   bun bot/tests/van-tra-loi.mjs
//
// Phần SQL (tầng căn hộ, giá "/tháng", tên đường "m Nguyễn Trãi") ở migration
// 20260913a — đã chạy thử trên DB bằng khối DO rollback, không nằm ở đây.
import { boCauTrung, boDoanGioiDauCau, boKhenKhongCanCu, boMauThuanCan, boTenRiengBia, boCauGhiNhan, boGachCheo, boHoiMucDich, chanHuaCoHang, dapHoiNguocTienDinh, laLoiMeta, laNoiVoiBot, laXinBoTruong, laXinSoKhach, laXinXoaDuLieu, boCauSuaLaiModel, motCauHoi, chanNhanLaNguoi, gopGhiChu, laCauGhiNhan, laHoiCoHang, laHoiMucDich, laHuaCoHang, laNhanLaNguoi, locHoSoMua, suaTuXungMua, doiTuXung, vuaKhen, boCauKhen } from "../supabase/functions/_shared/extraction/van-tra-loi.ts";
import { boHuaDaDang, laHoiLechKhoa, laSoDoBia, thayCauHoiLech } from "../supabase/functions/_shared/extraction/van-tra-loi.ts";
import { boCanBia, boCauVongLai, boDoanPhuongDiaDanh, chanBiaDuKien, chanHuaGuiHinh, laHuaGuiHinh, laHuaHoiChu, suaBotXungNhamKhach, suaKhenNguocNghia } from "../supabase/functions/_shared/extraction/van-tra-loi.ts";
import { boCauGhiTienKhongCo, boCauM2KhongCo, boGachDai, boHoiHoanCong, laKhachBaoHieuNham, themXinLoiKhiHieuNham, laKhenSai, boMenhDeKhenSai, boMaTinKhach, coNhacCan, bongBongGoiYCan, boCauHoiDo, boDacDiemKhongCo } from "../supabase/functions/_shared/extraction/van-tra-loi.ts";
import { LOI_CHAO } from "../supabase/functions/_shared/prompts.ts";
import { canGanManh, donManh } from "../supabase/functions/_shared/extraction/gan-manh-loc.ts";
import { chonCauKe, nhanDienNhieuCan, tachTheoCan, themTangPhu, phanLoaiCauTraLoi, ghepMotChieu, soNhaDau, bocViTriRao, catDapAn, laNoiDaTraLoi, laNgungRao } from "../supabase/functions/_shared/extraction/khop-cau-tra-loi.ts";
import { docTien, donViGiaDep, gonGiaKyHan } from "../supabase/functions/_shared/extraction/luat-tien.ts";
import { nhanDienFact } from "../supabase/functions/_shared/extraction/khop-cau-tra-loi.ts";
import { tuXungTuCau } from "../supabase/functions/_shared/extraction/khop-cau-tra-loi.ts";
import { soanTinNhap } from "../supabase/functions/_shared/tin-nhap.ts";
import { CAU_TIEN_DINH, dienCau } from "../supabase/functions/_shared/prompts.ts";
import { bocTachTaoTin, kemLuotTao, tomTatDaLuu, tomTatTrongCau, vuaLuuBan, vuaLuuMua } from "../supabase/functions/_shared/bao_lai.ts";

let hong = 0, tong = 0;
const ok = (ten, dat, chi = "") => {
  tong++;
  if (!dat) hong++;
  console.log(`${dat ? "✓" : "✗"} ${ten}${dat ? "" : `  → ${chi}`}`);
};

// ── Câu hứa có hàng (chỉ bị chặn khi model không có căn nào trong tay) ───────
for (const [cau, mong] of [
  ["Dạ có em.", true],
  ["Có ạ!", true],
  ["Em đang có vài căn 3 phòng, hẻm xe hơi tầm 7 tỷ gần các bệnh viện khu Quận 5.", true],
  ["Bên em hiện có 3 căn đúng tầm giá này.", true],
  ["Để em xem xem căn nào phù hợp nhất với chị nhé.", true],
  ["Em có nhà mặt tiền Quận 10 nè anh.", true],
  // KHÔNG được chặn
  ["Anh tìm để ở hay đầu tư kinh doanh ạ?", false],
  ["Chị có muốn nhà hẻm xe hơi không ạ?", false],
  ["Bên em có anh Thu phụ trách khu vực Sài Gòn.", false],
  ["Có căn mới hợp là em báo anh/chị liền nha.", false],
  ["Anh có cần gần trường không ạ?", false],
  ["Dạ được chị.", false],
  ["Chị cần mấy phòng ngủ vậy ạ?", false],
  ["Nếu có căn nào hợp em gửi chị liền.", false],
]) ok(`laHuaCoHang "${cau}"`, laHuaCoHang(cau) === mong, String(laHuaCoHang(cau)));

ok("'Dạ có ạ.' trả lời câu KHÔNG hỏi hàng → không chặn", !laHuaCoHang("Dạ có ạ.", false));
// 23/09/2026 (bắn thật, người thuê Q7, kho trống): hứa lọc căn rồi không gửi gì. Câu HỎI tiêu chí không bắt.
for (const [cau, mong] of [["Dạ em lọc căn 2PN Quận 7 quanh 15 triệu cho anh nhé :)", true], ["Để em tìm căn hộ 2 phòng ngủ cho chị nha", true],
  ["Dạ cháu tìm nhà cho chú liền ạ", true], ["Em lọc căn cho anh theo khu vực nào ạ?", false], ["Anh cần căn mấy phòng ngủ ạ?", false]])
  ok(`laHuaCoHang hứa lọc ${JSON.stringify(cau)} → ${mong}`, laHuaCoHang(cau) === mong, String(laHuaCoHang(cau)));
ok("'em đang có vài căn' vẫn chặn dù khách không hỏi hàng", laHuaCoHang("Em đang có vài căn 3 phòng.", false));
// 20/09/2026 (bắn thật mau-y-C): hai lượt né "để em kiểm tra … rồi báo" khi kho trống.
for (const cau of [
  "Dạ mình để em kiểm tra hẻm 4m Nguyễn Trãi rồi báo liền ạ.",
  "Em kiểm tra kho rồi báo mình liền ạ.",
  "Đang kiểm tra hẻm 4m Nguyễn Trãi và mở rộng khu vực gần đó, sắp báo mình liền.",
]) ok(`né kho trống: "${cau}" bị chặn`, laHuaCoHang(cau, false));
ok("câu trả lời thật không bị chặn: 'Dạ hiện bên em chưa có căn nào khớp…'", !laHuaCoHang("Dạ hiện bên em chưa có căn nào khớp đúng nhu cầu này ạ.", false));
ok("câu hỏi nhu cầu không bị chặn", !laHuaCoHang("Anh muốn ở khu nào để em lọc cho gần?", false));
// 20/09/2026 (bắn thật mau-y-A): hỏi phí KHÔNG DẤU vẫn có đáp án tiền định.
ok("dapHoiNguocTienDinh phí không dấu", /1%/.test(dapHoiNguocTienDinh("phi ben minh sao, co bat ky doc quyen ko", "anh", "phí chỉ thu khi giao dịch thành công, 1% giá chốt") ?? ""));
for (const [cau, mong] of [
  ["có căn nào quận 10 tầm 5 tỷ không em", true],
  ["còn nhà nào tầm 7 tỷ hông em", true],
  ["bên em có căn nào gần bệnh viện ko", true],
  ["có hỗ trợ vay không em", false],
  ["3 phòng ngủ em, hẻm xe hơi là được", false],
  ["bên em có thu phí không", false],
]) ok(`laHoiCoHang "${cau}"`, laHoiCoHang(cau) === mong, String(laHoiCoHang(cau)));

{
  const loi = "hiện bên em chưa có căn nào khớp đúng nhu cầu này ạ. Em ghi lại rồi, có căn mới hợp là em báo chị liền nha.";
  const a = chanHuaCoHang(
    ["Dạ được chị. Em đang có vài căn 3 phòng, hẻm xe hơi tầm 7 tỷ gần các bệnh viện khu Quận 5. Để em xem xem căn nào phù hợp nhất với chị nhé."],
    loi,
  );
  ok("chặn: giữ 'Dạ được chị.', lời thật đứng thay đúng chỗ, không lặp",
    a.daChan && a.replies.length === 1 && a.replies[0] === `Dạ được chị. Hiện bên em chưa có căn nào khớp đúng nhu cầu này ạ. Em ghi lại rồi, có căn mới hợp là em báo chị liền nha.`,
    JSON.stringify(a.replies));
  const b = chanHuaCoHang(["Dạ có em. Anh tìm để ở hay đầu tư kinh doanh ạ?"], "em lọc kho theo đúng nhu cầu của anh/chị rồi báo lại liền nha.");
  ok("chặn: câu đầu bị bỏ thì lời thật mở bằng 'Dạ', câu hỏi còn nguyên",
    b.replies[0] === "Dạ em lọc kho theo đúng nhu cầu của anh/chị rồi báo lại liền nha. Anh tìm để ở hay đầu tư kinh doanh ạ?",
    JSON.stringify(b.replies));
  const c = chanHuaCoHang(["Dạ chị cần mấy phòng ngủ ạ?"], loi);
  ok("không vi phạm → trả nguyên mảng", !c.daChan && c.replies[0] === "Dạ chị cần mấy phòng ngủ ạ?", JSON.stringify(c));
}

// ── 13/09 lượt bắn thứ hai: hai kẽ van kho + nhận là người thật ─────────────
ok("kho: 'Dạ có anh/chị!' (dấu gạch chéo) vẫn là hứa", laHuaCoHang("Dạ có anh/chị!"));
ok("kho: 'Dạ em tìm vài căn hẻm xe hơi… cho chị xem nha' là hứa", laHuaCoHang("Dạ em tìm vài căn hẻm xe hơi 3 phòng gần bệnh viện quanh tầm 7 tỷ cho chị xem nha."));
ok("kho: 'Em gửi 2 căn này chị xem nha' — CÓ căn thì tầng trên không gọi van; câu vẫn nhận là hứa", laHuaCoHang("Em gửi 2 căn này chị xem nha."));
for (const [cau, mong] of [
  ["Em là người thật, không phải máy đâu anh/chị.", true],
  ["Dạ em là người thật ạ.", true],
  ["Em không phải bot đâu chị.", true],
  ["Mình là con người bình thường thôi anh.", true],
  // KHÔNG được chặn
  ["Dạ em là M•ai bên AI Ơi Nhà Đất ạ.", false],
  ["Bên em có anh Thu là người thật phụ trách khu vực.", false],
  ["Không phải ai cũng mua được giá này đâu chị.", false],
  ["Nhà không phải máy lạnh âm trần đâu anh.", false],
  ["Em là trợ lý AI bên AI Ơi Nhà Đất ạ.", false],
]) ok(`laNhanLaNguoi "${cau}"`, laNhanLaNguoi(cau) === mong, String(laNhanLaNguoi(cau)));
{
  const ra = chanNhanLaNguoi(["Dạ em là M•ai bên AI Ơi Nhà Đất ạ. Em là người thật, không phải máy đâu anh/chị. Bây giờ mình đang tìm mua hay thuê nhà ạ?"], "mình");
  ok("thay câu nhận là người bằng câu thật, giữ lời chào và câu hỏi quay lại việc",
    ra.length === 1 && /^Dạ em là M•ai bên AI Ơi Nhà Đất ạ\. Em là trợ lý AI bên AI Ơi Nhà Đất.*theo sát mình ạ\. Bây giờ mình đang tìm mua/.test(ra[0]) && !/người thật, không phải máy/.test(ra[0]),
    JSON.stringify(ra));
  const y = ["Dạ chị cần mấy phòng ngủ ạ?"];
  ok("không vi phạm → trả nguyên mảng", chanNhanLaNguoi(y, "chị") === y);
}

// ── Ghi chú người mua không lặp ─────────────────────────────────────────────
ok("gộp: model trả lại cả ý cũ lẫn ý mới → chỉ thêm ý mới",
  gopGhiChu("mẹ già ở cùng", "mẹ già ở cùng; muốn gần bệnh viện") === "mẹ già ở cùng; muốn gần bệnh viện",
  String(gopGhiChu("mẹ già ở cùng", "mẹ già ở cùng; muốn gần bệnh viện")));
ok("gộp: y hệt ý cũ (khác dấu chấm) → null", gopGhiChu("mẹ già ở cùng; muốn gần bệnh viện", "Mẹ già ở cùng.") === null,
  String(gopGhiChu("mẹ già ở cùng; muốn gần bệnh viện", "Mẹ già ở cùng.")));
ok("gộp: ý mới đầy đủ hơn → thay ý cũ",
  gopGhiChu("mẹ già ở cùng", "mẹ già ở cùng, đi lại khó") === "mẹ già ở cùng, đi lại khó",
  String(gopGhiChu("mẹ già ở cùng", "mẹ già ở cùng, đi lại khó")));
ok("gộp: ý ngắn không nuốt ý khác ('gần chợ' ≠ 'gần chợ Bến Thành đi bộ')",
  gopGhiChu("gần chợ Bến Thành đi bộ", "gần chợ") === "gần chợ Bến Thành đi bộ; gần chợ",
  String(gopGhiChu("gần chợ Bến Thành đi bộ", "gần chợ")));

// ── Không ghi nhận hai lần ──────────────────────────────────────────────────
for (const [cau, mong] of [
  ["Dạ em sửa lại 6 tỷ 5 và Phường 9 rồi ạ. Nhà mình ở đường nào vậy anh/chị?", true],
  ["Em ghi lại: hẻm xe hơi 4m, 1 trệt 3 lầu rồi anh/chị. Nhà mình ở đường nào?", true],
  ["Em ghi 9 tỷ 5 rồi anh. Nhà mình ở phường mấy vậy ạ?", true],
  ["Nhà mình ở đường nào vậy anh/chị?", false],
  ["Sổ riêng thì khách chốt cọc nhanh lắm anh.", false],
  ["Em gửi anh bản nháp nha.", false],
  ["Dạ em ghi nhận rồi ạ.", false],
  ["Em cập nhật rồi nha anh.", false],
]) ok(`laCauGhiNhan "${cau.slice(0, 40)}"`, laCauGhiNhan(cau) === mong, String(laCauGhiNhan(cau)));

// ── Giá thuê kèm kỳ hạn ─────────────────────────────────────────────────────
for (const [vao, mong] of [
  ["18 triệu 1 tháng", "18 triệu/tháng"],
  ["18 triệu một tháng", "18 triệu/tháng"],
  ["12 triệu 5 mỗi tháng", "12 triệu 5/tháng"],
  ["15tr / tháng", "15tr/tháng"],
  ["7 tỷ 2", "7 tỷ 2"],
  ["1 tỷ 1 năm", "1 tỷ 1 năm"],
  ["3 tỷ 9 thương lượng", "3 tỷ 9 thương lượng"],
]) {
  const ra = gonGiaKyHan(vao);
  ok(`gonGiaKyHan "${vao}"`, ra === mong, ra);
}
ok("gonGiaKyHan giữ đúng số: '12 triệu 5 mỗi tháng' đọc lại 12,5 triệu", docTien(gonGiaKyHan("12 triệu 5 mỗi tháng")) === 12_500_000,
  String(docTien(gonGiaKyHan("12 triệu 5 mỗi tháng"))));

// ── Tự xưng giữa câu (bàn giao 11/09 lỗi a) ─────────────────────────────────
for (const [vao, mong] of [
  ["chào em, anh cần bán căn nhà quận 5", "anh"],
  ["dạ em, chị gửi ảnh sổ nha", "chị"],
  ["ok em, anh đang ở ngoài, tối anh gửi", "anh"],
  ["alo em ơi chị muốn bán nhà", "chị"],
  ["bán nhà quận 10 phường 12, 48m2, giá 5 tỷ 2", null],
  ["có căn nào quận 10 tầm 5 tỷ không em", null],
  ["nhà hàng xóm, anh ấy bán rồi", null],
]) ok(`tuXungTuCau "${vao}"`, tuXungTuCau(vao) === mong, String(tuXungTuCau(vao)));

// ── Bản nháp: tiểu từ chat không lọt vào tin rao ─────────────────────────────
{
  const cauTD = (khoa, o = {}) => dienCau(CAU_TIEN_DINH[khoa] ?? "", { ...o, ac: "anh", Ac: "Anh", web: "AI Ơi Nhà Đất" });
  const tin = soanTinNhap({
    l: { code: "BDS-NP-Q5-0001", property_type: "nha_pho", deal: "ban", location_raw: "hẻm xe hơi 5m Nguyễn Trãi",
      ward: "Phường 3", district: "Quận 5", area_m2: 60, price_raw: "7 tỷ 2", direction: "Đông Nam" },
    facts: [{ question: "tiem_nang", answer: "để ở hoặc cho thuê đều được em" }, { question: "hien_trang", answer: "nhà mới sửa luôn nha anh" }],
    diem: 90, thieu: [], soAnh: 2, lai: null, cauTD,
  });
  ok("💡 không còn đuôi 'em'", /💡 Phù hợp: để ở hoặc cho thuê đều được\n/.test(tin), tin.split("\n").find((d) => d.startsWith("💡")) ?? "(không có dòng 💡)");
  ok("hiện trạng không còn 'luôn nha anh'", !/luôn nha anh/.test(tin), tin);
}

// ── 14/09 FR-207: 🤖 đã báo thì bỏ ghi nhận lần hai; tóm tắt nói đủ dự án/tầng/nội thất ─
{
  const ra = boCauGhiNhan([
    "Dạ em ghi số phòng ngủ 4 rồi ạ.",
    "Hẻm xe hơi thì thanh khoản cao quá. Dạ em ghi 1 trệt 3 lầu, 4 phòng, sổ hồng riêng rồi. Nhà mình ở đường nào vậy ạ?",
  ]);
  ok("bỏ bong bóng chỉ có câu ghi nhận; bỏ câu ghi nhận giữa bong bóng, giữ khen + câu hỏi",
    ra.length === 1 && ra[0] === "Hẻm xe hơi thì thanh khoản cao quá. Nhà mình ở đường nào vậy ạ?", JSON.stringify(ra));
  const ra2 = boCauGhiNhan(["Dạ em ghi 9 tỷ 5, 1 trệt 2 lầu, 4 phòng ngủ rồi ạ. Nhà mình ở phường nào vậy?"]);
  ok("câu đầu 'Dạ em ghi …' bị bỏ → câu còn lại mở bằng 'Dạ'", ra2[0] === "Dạ nhà mình ở phường nào vậy?", JSON.stringify(ra2));
  const giu = ["📋 Em đăng tin như vầy nha anh:\nBán nhà…", "🤖 Đã lưu: giá: \"6 tỷ 5\"", "Dạ em ghi nhận rồi ạ.", "Sổ riêng thì khách chốt nhanh lắm anh."];
  ok("không đụng bản nháp, 🤖, ghi nhận trơ trọi, câu khen", JSON.stringify(boCauGhiNhan(giu)) === JSON.stringify(giu), JSON.stringify(boCauGhiNhan(giu)));
  // 25/09/2026: câu ghi nhận dính câu hỏi bằng dấu phẩy → giữ vế hỏi, không mất câu hỏi.
  const ra3 = boCauGhiNhan(["Dạ em ghi địa chỉ 45 Ngô Y Linh rồi ạ, nhà mình thuộc phường nào vậy?"]);
  ok("ghi nhận + ', <câu hỏi>?' → còn 'Dạ nhà mình thuộc phường nào vậy?'", ra3.length === 1 && ra3[0] === "Dạ nhà mình thuộc phường nào vậy?", JSON.stringify(ra3));
  const ra4 = boCauGhiNhan(["Dạ em ghi 9 tỷ 5, 4 phòng ngủ rồi ạ."]);
  ok("ghi nhận có phẩy mà không hỏi → vẫn bỏ cả câu", ra4.length === 0, JSON.stringify(ra4));
}
{
  const nhan = { tang: "tầng", view: "view", ly_do_ban: "lý do bán", dien_tich: "diện tích", tho_cu: "diện tích thổ cư" };
  const kem = kemLuotTao([
    { question: "view", answer: "view sông" }, { question: "tang", answer: "15" }, { question: "dien_tich", answer: "76m2" },
  ], nhan);
  ok("lượt tạo tin: 'Kèm' chỉ fact tóm tắt cột chưa nói (view), không lặp tầng/diện tích", kem === 'Kèm: view: "view sông"', String(kem));
  ok("lượt tạo tin: không còn fact nào ngoài tóm tắt → không có dòng Kèm", kemLuotTao([{ question: "dien_tich", answer: "60m2" }], nhan) === null);
  const tt = tomTatDaLuu({ property_type: "chung_cu", deal: "cho_thue", ward: "Phường Tân Hưng", district: "Quận 7", area_m2: 76,
    bedrooms: 2, price_raw: "18 triệu/tháng", price_vnd: 18e6, floor: 15, furnishing: "full", projects: { name: "Sunrise City" } }, [], {}, "thay_doi");
  ok("tóm tắt căn hộ nói dự án ĐÃ GẮN, tầng căn, nội thất (bắn thật 14/09: thiếu cả ba)",
    /dự án Sunrise City/.test(tt) && /tầng 15/.test(tt) && /nội thất đầy đủ/.test(tt) && !/trệt/.test(tt), tt);
  ok("tomTatTrongCau đọc lại tóm tắt từ 🤖 lượt tạo lẫn 📦 lượt sau",
    tomTatTrongCau("🤖 Đã lưu: Nhà phố bán · 60m²\nSai chỗ nào…") === "Nhà phố bán · 60m²" &&
    tomTatTrongCau('🤖 Đã lưu: hướng: "đông nam"\n📦 Tin giờ: Nhà phố bán · hướng Đông Nam') === "Nhà phố bán · hướng Đông Nam");
  const mua = vuaLuuMua({ area: "Quận 5" }, { area: "Quận 5", budget: "7 tỷ", deal: "ban", ten_tro_ly: "H•ai", xung_ho: "chị", gan_tien_ich_loc: { m: 1000 } },
    [["deal", "mua hay thuê"], ["area", "khu vực muốn tìm (phường nào)"], ["budget", "khoảng giá"]]);
  ok("người mua: chỉ khoá ĐỔI, không khoá nội bộ, deal 'ban' đọc là 'mua'", mua === '🤖 Bóc tách được: mua hay thuê: "mua" · khoảng giá: "7 tỷ"', String(mua));
}

// ── 14/09 bắn lại kịch bản 7 (người mua) ──────────────────────────────────────
ok("kho: 'Chị xem những căn này có hợp không ạ?' là nói như đã gửi căn", laHuaCoHang("Chị xem những căn này có hợp không ạ?"));
ok("kho: 'Chị thấy căn này thế nào ạ?' (một căn khách đang hỏi) không dính mẫu 'những căn này'", !laHuaCoHang("Chị thấy căn này thế nào ạ?"));
ok("kho: 'Dạ chị, em tìm cho mấy căn 3PN hẻm xe hơi…' (chữ 'cho' chen giữa) là hứa có căn", laHuaCoHang("Dạ chị, em tìm cho mấy căn 3PN hẻm xe hơi quanh bệnh viện Chợ Rẫy trong tầm 7 tỷ."));
ok("kho: 'em tìm cho chị vài căn' vẫn bắt; 'em tìm cho chị nha' không có căn nào thì không", laHuaCoHang("Em tìm cho chị vài căn nha.") && !laHuaCoHang("Em tìm cho chị nha."));
ok("ghi nhận: 'Dạ chị, em ghi lại: mua nhà Quận 5…' là ghi nhận có nội dung", laCauGhiNhan("Dạ chị, em ghi lại: mua nhà Quận 5 tầm 7 tỷ, gần bệnh viện cho mẹ. Chị cần mấy phòng ngủ ạ?"));
{
  const ra = boCauGhiNhan(["Dạ chị, em ghi lại: mua nhà Quận 5 tầm 7 tỷ, gần bệnh viện cho mẹ. Chị cần mấy phòng ngủ và nhà hẻm hay mặt tiền thì tìm dễ hơn ạ?"]);
  ok("người mua: bỏ câu ghi nhận lần hai, câu hỏi còn lại mở bằng 'Dạ'", ra[0] === "Dạ chị cần mấy phòng ngủ và nhà hẻm hay mặt tiền thì tìm dễ hơn ạ?", JSON.stringify(ra));
}

// ── 14/09 bắn 16 hội thoại người mua: hồ sơ bịa, "chúng mình", hứa có nhiều ────
{
  const P0 = { name: null, deal: null, area: null, budget: null, purpose: null, property_type: null, bedrooms: null, alley: null, timeline: null, notes: null };
  const a = locHoSoMua({ ...P0, area: "Bình Thạnh", purpose: "để ở", timeline: "trong tháng này" }, "cần mua gấp trong tháng này, quận bình thạnh tầm 8 tỷ, nhà mặt tiền");
  ok("hồ sơ: 'gấp, mặt tiền' không nói mục đích → gỡ 'để ở'; giữ timeline 'trong tháng này'", a.profile.purpose === null && a.profile.timeline === "trong tháng này" && a.bo.join() === "purpose", JSON.stringify(a));
  const b = locHoSoMua({ ...P0, timeline: "chiều thứ 7" }, "cuối tuần anh đi xem nhà được không, anh rảnh chiều thứ 7");
  ok("hồ sơ: giờ đi XEM NHÀ không phải timeline → gỡ", b.profile.timeline === null, JSON.stringify(b));
  const c = locHoSoMua({ ...P0, notes: "Khách muốn xem danh sách căn ngay, chưa hỏi chi tiết" }, "hỏi hoài vậy, có căn nào thì gửi đi");
  ok("hồ sơ: ghi chú là thái độ của khách → gỡ", c.profile.notes === null, JSON.stringify(c));
  const d = locHoSoMua({ ...P0, notes: "anh có 2 tỷ, vay thêm được không để mua nhà 4 tỷ" }, "anh có 2 tỷ, vay thêm được không để mua nhà 4 tỷ quận 6");
  ok("hồ sơ: ghi chú chép gần nguyên câu khách → gỡ", d.profile.notes === null, JSON.stringify(d));
  // KHÔNG được gỡ
  const e = locHoSoMua({ ...P0, purpose: "để ở", notes: "có mẹ già ở cùng, cần gần bệnh viện" }, "chị tìm mua nhà quận 5 để ở, nhà có mẹ già nên muốn gần bệnh viện");
  ok("hồ sơ: khách NÓI 'để ở' + hoàn cảnh thật → giữ cả hai", e.profile.purpose === "để ở" && e.profile.notes === "có mẹ già ở cùng, cần gần bệnh viện", JSON.stringify(e));
  const f = locHoSoMua({ ...P0, purpose: "cho thuê lại" }, "mua để cho thuê lại, khu nào quận 5 dòng tiền tốt em");
  ok("hồ sơ: 'mua để cho thuê lại' → giữ mục đích", f.profile.purpose === "cho thuê lại", JSON.stringify(f));
  const g = locHoSoMua({ ...P0, timeline: "trước Tết", notes: "4 người ở" }, "dọn vào trước tết em, nhà 4 người");
  ok("hồ sơ: 'dọn vào trước tết' giữ timeline; '4 người ở' (ngắn) giữ ghi chú", g.profile.timeline === "trước Tết" && g.profile.notes === "4 người ở", JSON.stringify(g));
}
ok("xưng hô: 'căn hộ có ban công chúng mình có nhiều' → 'bên em'", suaTuXungMua("Dạ căn hộ có ban công chúng mình có nhiều.") === "Dạ căn hộ có ban công bên em có nhiều.", suaTuXungMua("Dạ căn hộ có ban công chúng mình có nhiều."));
ok("xưng hô: đầu câu 'Chúng mình…' → 'Bên em…'; 'nhà mình' (gọi khách) giữ nguyên", suaTuXungMua("Chúng mình báo lại liền. Nhà mình ở đâu ạ?") === "Bên em báo lại liền. Nhà mình ở đâu ạ?", suaTuXungMua("Chúng mình báo lại liền. Nhà mình ở đâu ạ?"));
ok("kho: 'căn hộ có ban công chúng mình có nhiều' là hứa", laHuaCoHang("Dạ căn hộ có ban công chúng mình có nhiều."));
ok("kho: 'Em tìm căn khớp 4 người ở quanh trường … rồi' là hứa", laHuaCoHang("Em tìm căn khớp 4 người ở quanh trường tiểu học Quận 3 tầm 6 tỷ rồi."));
ok("kho: 'bên em có nhiều khách hỏi khu này' không phải hứa có hàng", !laHuaCoHang("Bên em có nhiều khách hỏi khu này lắm."));
// bắn lại sau siết
ok("kho: 'để em gửi căn cho mình xem luôn ạ' là hứa", laHuaCoHang("Dạ em hiểu, để em gửi căn cho mình xem luôn ạ."));
ok("kho: 'em ghi nhận lịch chiều thứ 7 cho mình' là nhận hẹn khi chưa có căn", laHuaCoHang("Dạ được, em ghi nhận lịch chiều thứ 7 cho mình ạ."));
ok("kho: 'có căn mới em gửi mình liền' không phải hứa", !laHuaCoHang("Có căn mới hợp là em gửi mình liền nha."));
ok("kho: 'mình rảnh lịch nào để em sắp xếp khi có căn' không bắt (không có giờ cụ thể)", !laHuaCoHang("Khi có căn khớp em sắp xếp lịch cho mình nha."));

// bắn lần 3 (14/09)
ok("dò mục đích: thuê căn hộ → 'để ở hay để cho thuê lại vậy ạ?' là câu dò", laHoiMucDich("Trong khi chờ, mình cần căn hộ để ở hay để cho thuê lại vậy ạ?"));
ok("dò mục đích: 'hẻm hay mặt tiền, để ở hay đầu tư ạ?' là câu dò", laHoiMucDich("Anh tìm nhà hẻm hay mặt tiền, để ở hay đầu tư ạ?"));
ok("dò mục đích: câu kể 'mua để ở hay đầu tư đều được' (không hỏi) không bắt", !laHoiMucDich("Mua để ở hay đầu tư thì khu này đều hợp ạ."));
ok("dò mục đích: 'hẻm xe hơi hay mặt tiền ạ?' không bắt", !laHoiMucDich("Chị thích hẻm xe hơi hay mặt tiền ạ?"));
{
  const b = boHoiMucDich(["🤖 Đã lưu nhu cầu: mua", "Dạ em lọc Quận 6 tầm 4 tỷ cho anh nhé. Anh tìm nhà hẻm hay mặt tiền, để ở hay đầu tư ạ?"]);
  ok("dò mục đích: bỏ đúng câu hỏi, giữ 🤖 và câu trước", b.daBo && b.replies.length === 2 && b.replies[1] === "Dạ em lọc Quận 6 tầm 4 tỷ cho anh nhé.", JSON.stringify(b));
  const c = boHoiMucDich(["Mình tìm để ở hay đầu tư ạ?"]);
  ok("dò mục đích: bỏ hết thì giữ nguyên (không gửi lượt im)", !c.daBo && c.replies.length === 1, JSON.stringify(c));
}
ok("gõ dính: 'Emghi nhận…' → 'Em ghi nhận…'", suaTuXungMua("Emghi nhận nhu cầu của mình ạ.") === "Em ghi nhận nhu cầu của mình ạ.", suaTuXungMua("Emghi nhận nhu cầu của mình ạ."));
ok("gõ dính: 'Emmy', 'em gái' giữ nguyên", suaTuXungMua("Emmy và em gái") === "Emmy và em gái", suaTuXungMua("Emmy và em gái"));
ok("gõ dính + 🤖: câu 'Emghi nhận nhu cầu…, sắp lọc…' bị bỏ", boCauGhiNhan(["Dạ được.", suaTuXungMua("Emghi nhận nhu cầu của mình, sắp lọc được căn phù hợp liền ạ.")]).length === 1);
ok("gộp: '4 người ở cùng, cần gần trường tiểu học' vào 'cần gần trường tiểu học Quận 3' không lặp",
  gopGhiChu("cần gần trường tiểu học Quận 3", "4 người ở cùng, cần gần trường tiểu học") === "cần gần trường tiểu học Quận 3; 4 người ở cùng",
  String(gopGhiChu("cần gần trường tiểu học Quận 3", "4 người ở cùng, cần gần trường tiểu học")));

// bắn lần 4 (14/09)
ok("dò mục đích: 'Mình ở hoặc đầu tư ạ?' là câu dò", laHoiMucDich("Mình ở hoặc đầu tư ạ?"));
ok("dò mục đích: 'Mình đang tìm mua hay để ở nhà Quận 5 vậy?' là câu dò", laHoiMucDich("Mình đang tìm mua hay để ở nhà Quận 5 vậy?"));
ok("dò mục đích: 'Mình muốn ở khu nào, tầm giá bao nhiêu ạ?' không bắt", !laHoiMucDich("Mình muốn ở khu nào, tầm giá bao nhiêu ạ?"));
ok("dò mục đích: 'Mình tìm mua hay thuê ạ?' không bắt", !laHoiMucDich("Mình tìm mua hay thuê ạ?"));
ok("kho: 'Hiện kho em còn vài căn ở khu đó' là hứa", laHuaCoHang("Hiện kho em còn vài căn ở khu đó, em lọc rồi báo lại mình ngay nha."));
ok("kho: 'bên em còn căn nào khác không' không bắt", !laHuaCoHang("Mình hỏi giúp em bên em còn căn nào khác không ạ?"));
ok("kho: 'em còn cần biết thêm khu vực' không bắt", !laHuaCoHang("Em còn cần biết thêm khu vực mình muốn ạ."));
ok("xưng hô: 'thì bạn cũng bị ảnh hưởng' → 'mình'", suaTuXungMua("Nếu người khác bán phần của họ thì bạn cũng bị ảnh hưởng.") === "Nếu người khác bán phần của họ thì mình cũng bị ảnh hưởng.", suaTuXungMua("Nếu người khác bán phần của họ thì bạn cũng bị ảnh hưởng."));
ok("xưng hô: 'bạn bè', 'người bạn có nhà' giữ nguyên", suaTuXungMua("Nhà gần bạn bè, người bạn có nhà ở đó.") === "Nhà gần bạn bè, người bạn có nhà ở đó.", suaTuXungMua("Nhà gần bạn bè, người bạn có nhà ở đó."));
ok("gộp: 'muốn gần bệnh viện' vào 'có mẹ già ở cùng, cần gần bệnh viện' → null",
  gopGhiChu("có mẹ già ở cùng, cần gần bệnh viện", "muốn gần bệnh viện") === null,
  String(gopGhiChu("có mẹ già ở cùng, cần gần bệnh viện", "muốn gần bệnh viện")));

// 15/09/2026 FR-177: một lượt một câu hỏi (phía bán) — cắt câu hỏi thứ hai của model.
for (const [vao, mong] of [
  ["Hẻm 5m ô tô tới cửa thì khách chuộng lắm anh. Nhà mình mấy lầu ạ? Có sổ hồng riêng chưa ạ?", "Hẻm 5m ô tô tới cửa thì khách chuộng lắm anh. Nhà mình mấy lầu ạ?"],
  ["Nhà mình mấy lầu ạ?", "Nhà mình mấy lầu ạ?"],
  ["Nhà mình mấy lầu ạ? Để em ghi vào tin.", "Nhà mình mấy lầu ạ?"],
  ["Anh/chị cần ra hàng gấp hay ưu tiên đạt giá mong muốn?", "Anh/chị cần ra hàng gấp hay ưu tiên đạt giá mong muốn?"],
  ["Dạ em ghi nhận rồi ạ.", "Dạ em ghi nhận rồi ạ."],
  ["🤖 Đã lưu: giá: \"4 tỷ\"", "🤖 Đã lưu: giá: \"4 tỷ\""],
]) ok("motCauHoi " + JSON.stringify(vao.slice(0, 40)), motCauHoi([vao])[0] === mong, JSON.stringify(motCauHoi([vao])));

// 15/09/2026 (bắn thật F2): câu hỏi về ảnh có đáp án hệ thống.
for (const [vao, mong] of [
  ["bên bạn có cần mình gửi hình không hay sao", true],
  ["có cần chụp ảnh sổ không em", true],
  ["phí bên bạn tính sao", false],
  ["giá ảnh hưởng gì không", false],
  ["bạn có biết xung quanh khu này có tiện ích gì không", false],
]) ok("dapHoiNguocTienDinh " + JSON.stringify(vao), (dapHoiNguocTienDinh(vao, "anh") !== null) === mong, String(dapHoiNguocTienDinh(vao, "anh")));
ok("dapHoiNguocTienDinh gọi đúng cách xưng hô", dapHoiNguocTienDinh("có cần gửi hình không", "chị") === "Dạ chị gửi ảnh thẳng vào đây là em cất vào tin luôn ạ.");

// 15/09/2026 (bắn thật P1/P2): đáp án hệ thống cho "bot hả" / "phí sao"; lời model trả lời CÂU LỆNH bị bỏ.
ok("dapHoiNguocTienDinh 'bên em là bot hả' → nói thật là AI", /trợ lý AI/.test(dapHoiNguocTienDinh("mà bên em là bot hả?", "anh") ?? ""), String(dapHoiNguocTienDinh("mà bên em là bot hả?", "anh")));
ok("dapHoiNguocTienDinh 'phí sao' + phí → câu phí", dapHoiNguocTienDinh("phí sao, với bên em có gọi điện phiền tôi không", "anh", "phí bên em chỉ thu khi giao dịch thành công, 1% giá chốt") === "Dạ phí bên em chỉ thu khi giao dịch thành công, 1% giá chốt ạ.", String(dapHoiNguocTienDinh("phí sao", "anh", "x")));
ok("dapHoiNguocTienDinh 'phí quản lý bao nhiêu' → không phải phí môi giới", dapHoiNguocTienDinh("phí quản lý bao nhiêu 1 tháng", "anh", "x") === null);
ok("dapHoiNguocTienDinh 'máy lạnh còn không' → không phải hỏi bot", dapHoiNguocTienDinh("máy lạnh còn không em", "anh") === null);
for (const [vao, mong] of [
  ["Em hiểu rồi ạ. Em là Kh•ai, trợ lý AI Ơi Nhà Đất. Khi chủ nhà hỏi ngược, em trả lời câu đó TRƯỚC bằng 1–2 câu ngắn, rồi mới hỏi tiếp. Sẵn sàng nhận hội thoại.", true],
  ["Một tin duy nhất, 25–50 từ, câu hỏi cuối là \"vị trí cụ thể\" — không chuyển sang thứ khác.", true],
  ["Dạ phí bên em chỉ thu khi bán xong, 1% anh nha. Nhà mình ở đường nào vậy anh?", false],
  ["Hẻm 5m xe hơi tới cửa là khách chuộng lắm anh. Mình cần ra hàng gấp hay được giá thì thôi?", false],
  ["Dạ em ghi nhận rồi ạ.", false],
]) ok("laLoiMeta " + JSON.stringify(vao.slice(0, 50)), laLoiMeta(vao) === mong, String(laLoiMeta(vao)));

// 17/09/2026 (Zalo thật): "cháu là người hỗ trợ" là nhận mình là người → thay bằng câu thật.
ok("chanNhanLaNguoi 'cháu là người hỗ trợ'", /trợ lý AI/.test(chanNhanLaNguoi(["Cháu ghi nhận chú hỏi, cháu là người hỗ trợ. Chú gửi ảnh nha?"], "chú")[0]) && !/người hỗ trợ/.test(chanNhanLaNguoi(["cháu là người hỗ trợ."], "chú")[0]), JSON.stringify(chanNhanLaNguoi(["Cháu ghi nhận chú hỏi, cháu là người hỗ trợ. Chú gửi ảnh nha?"], "chú")));
// 16/09/2026: khách chú/cô/bác → bot tự xưng "cháu"; anh/chị giữ "em"; không đụng "em gái", "xem".
for (const [xh, vao, mong] of [
  ["chú", "Dạ em ghi nhận rồi ạ. Em hỏi thêm chú một chút nha.", "Dạ cháu ghi nhận rồi ạ. Cháu hỏi thêm chú một chút nha."],
  ["cô", "Bên em có anh Thu phụ trách, tụi em sẽ xem kỹ.", "Bên cháu có anh Thu phụ trách, tụi cháu sẽ xem kỹ."],
  ["bác", "em gái em cũng ở đó, EM NHA", "em gái cháu cũng ở đó, CHÁU NHA"],
  // 23/09/2026: khách xưng ông/bà.
  ["ông", "Dạ em ghi nhận rồi ạ. Ông gửi ảnh cho em nha.", "Dạ cháu ghi nhận rồi ạ. Ông gửi ảnh cho cháu nha."],
  ["bà", "Em hỏi thêm bà một chút nha.", "Cháu hỏi thêm bà một chút nha."],
  ["thím", "Dạ em ghi nhận rồi ạ.", "Dạ cháu ghi nhận rồi ạ."],
  ["anh", "Dạ em ghi nhận rồi ạ.", "Dạ em ghi nhận rồi ạ."],
  [null, "Dạ em ghi nhận rồi ạ.", "Dạ em ghi nhận rồi ạ."],
]) ok(`doiTuXung(${xh}) ${JSON.stringify(vao.slice(0, 30))}`, doiTuXung([vao], xh)[0] === mong, JSON.stringify(doiTuXung([vao], xh)));

// ── 18/09/2026: "lâu lâu thì khen thôi" — vuaKhen đọc 3 tin bot gần nhất, boCauKhen bỏ câu khen giữ câu hỏi ──
ok("vuaKhen: 3 tin gần nhất có 'rất sáng sủa' → true", vuaKhen(["Dạ em ghi nhận.", "Nhà mới sơn sửa lại trông rất sáng sủa. Phường mấy cô?", "Dạ cô."]) === true);
ok("vuaKhen: chỉ tin thứ 4 trở về trước khen → false", vuaKhen(["Hẻm xe hơi là khách chuộng lắm.", "Dạ.", "Phường mấy?", "Sổ riêng chưa?"]) === false);
ok("vuaKhen: 'tiện ích gần' không phải khen", vuaKhen(["🤖 Đã lưu: tiện ích gần: \"gần chợ\""]) === false);
ok("boCauKhen: bỏ câu khen, giữ câu hỏi", boCauKhen("Dạ nhà 2 lầu, sổ hồng riêng là khách chốt nhanh lắm cô. Tổng cộng bao nhiêu phòng ngủ cô?") === "Tổng cộng bao nhiêu phòng ngủ cô?", boCauKhen("Dạ nhà 2 lầu, sổ hồng riêng là khách chốt nhanh lắm cô. Tổng cộng bao nhiêu phòng ngủ cô?"));
ok("boCauKhen: hai dòng, dòng khen bỏ, dòng hỏi giữ", boCauKhen("3 phòng ngủ, toilet riêng từng tầng là rất tiện cho gia đình cô.\nMình cần ra hàng gấp hay được giá thì thôi cô?") === "Mình cần ra hàng gấp hay được giá thì thôi cô?");
ok("boCauKhen: không có câu khen → giữ nguyên", boCauKhen("Dạ cháu sửa lại giá 6 tỷ rồi ạ. Mình cần ra hàng gấp hay được giá thì thôi cô?") === "Dạ cháu sửa lại giá 6 tỷ rồi ạ. Mình cần ra hàng gấp hay được giá thì thôi cô?");
ok("boCauKhen: cả tin là một câu khen kèm dấu hỏi → giữ (không để trống)", boCauKhen("Nhà đẹp vậy chắc hút khách lắm, sổ riêng chưa cô?") === "Nhà đẹp vậy chắc hút khách lắm, sổ riêng chưa cô?");

// ── 21/09/2026 ("làm cả 4"): lời nói với bot, xin xoá dữ liệu, bỏ gạch chéo ──
for (const t of ["xóa sạch data của anh đi để anh test lại", "cái dòng phù hợp đọc kỳ quá", "bản nháp dài quá em", "reset lại giúp anh", "em là bot hả, hệ thống gì kỳ vậy"])
  ok(`laNoiVoiBot: "${t}"`, laNoiVoiBot(t) === true);
for (const t of ["hẻm 4m xe hơi vào", "sổ hồng riêng hoàn công", "5 tỷ 2", "phường 2 quận 5", "để anh hỏi vợ rồi báo", "nhà ở đường trần đình trọng"])
  ok(`không phải lời nói với bot: "${t}"`, laNoiVoiBot(t) === false);
ok("laXinXoaDuLieu: 'xóa sạch data của anh đi'", laXinXoaDuLieu("xóa sạch data của anh đi") === true);
ok("laXinXoaDuLieu: 'xóa hết dữ liệu của anh đi'", laXinXoaDuLieu("xóa hết dữ liệu của anh đi") === true);
ok("không phải xin xoá: 'xóa cái hẻm 4m đi, hẻm 5m'", laXinXoaDuLieu("xóa cái hẻm 4m đi, hẻm 5m") === false);
ok("boGachCheo: 'Sai chỗ nào anh/chị nhắn lại' → 'anh chị'", boGachCheo("Sai chỗ nào anh/chị nhắn lại giúp em nha.") === "Sai chỗ nào anh chị nhắn lại giúp em nha.");
ok("boGachCheo: đầu câu 'Anh/chị cho em' → 'Anh chị cho em'", boGachCheo("Anh/chị cho em xin địa chỉ") === "Anh chị cho em xin địa chỉ");
ok("boGachCheo: không đụng 'anh chị phụ trách'", boGachCheo("có anh chị phụ trách theo sát") === "có anh chị phụ trách theo sát");


// ── 22/09/2026: ba lưới mới theo bộ đo giọng (TS-GIONG-02) ─────────────────────
{
  const td = "Dạ em là trợ lý AI bên AI Ơi Nhà Đất, việc cần người thật thì có anh chị phụ trách theo sát mình ạ.";
  const md = "Em là trợ lý AI bên AI Ơi Nhà Đất, việc gì cần người thật thì có anh chị phụ trách khu vực theo sát anh ạ. Sổ hồng nhà mình riêng chưa anh?";
  ok("boCauTrung: câu tiền định + model chép lại gần nguyên văn → giữ MỘT, câu hỏi giữ",
    JSON.stringify(boCauTrung([td, md])) === JSON.stringify([td, "Sổ hồng nhà mình riêng chưa anh?"]), JSON.stringify(boCauTrung([td, md])));
  {
    // 24/09/2026 (tin thật 152 Trần Đình Xu): dòng 📍 địa chỉ trùng chữ với tiêu đề bản nháp — trước bị bỏ.
    const nhap = "📋 Em đăng tin như vầy nha anh:\nBán nhà 152 Trần Đình Xu Phường Cầu Ông Lãnh Q.1, 120m², trệt + 4 lầu, 4PN, SHR, giá 65 tỉ\n📍 152 Trần Đình Xu, Phường Cầu Ông Lãnh, Quận 1\n💰 65 tỉ";
    ok("boCauTrung: dòng 📍 địa chỉ của bản nháp KHÔNG bị bỏ dù trùng chữ với tiêu đề", /📍 152 Trần Đình Xu/.test(boCauTrung([nhap]).join("\n")), JSON.stringify(boCauTrung([nhap])));
  }
  // 24/09/2026 (bắn 10 tin): chưa biết anh hay chị mà câu mở bằng "Anh cần bán gấp…".
  ok("boDoanGioiDauCau: 'Anh cần bán gấp…' → 'Anh chị cần bán gấp…'", boDoanGioiDauCau("Hẻm xe hơi tới cửa. Anh cần bán gấp hay chờ được giá thôi?") === "Hẻm xe hơi tới cửa. Anh chị cần bán gấp hay chờ được giá thôi?", boDoanGioiDauCau("Hẻm xe hơi tới cửa. Anh cần bán gấp hay chờ được giá thôi?"));
  ok("boDoanGioiDauCau: 'Anh chị xem…', 'Anh Thu…' giữ nguyên", boDoanGioiDauCau("Anh chị xem ổn chưa ạ? Anh Thu phụ trách.") === "Anh chị xem ổn chưa ạ? Anh Thu phụ trách.");
  ok("boCauTrung: câu ngắn trùng ('Dạ em ghi 3 lầu rồi ạ.') KHÔNG bị bỏ", boCauTrung(["Dạ em ghi 3 lầu rồi ạ.", "Dạ em ghi 3 lầu rồi ạ. Sổ riêng chưa anh?"]).length === 2);
  const bb = ["📝 Em ghi nhận: Nhà phố bán · Phường 5 · 60m² · giá 6 tỷ.\nSai chỗ nào anh chị nhắn lại giúp em nha."];
  ok("boCauTrung: không bỏ gì thì trả nguyên mảng (giữ xuống dòng, `===`)", boCauTrung(bb) === bb);
  ok("boCauTrung: bỏ câu ở dòng 2 vẫn giữ dòng 1 và dấu xuống dòng",
    boCauTrung([td, `Dạ anh.\n${td}\nSổ riêng chưa anh?`])[1] === "Dạ anh.\nSổ riêng chưa anh?", JSON.stringify(boCauTrung([td, `Dạ anh.\n${td}\nSổ riêng chưa anh?`])));
  const khen = ["Hẻm 5m ô tô vào tới cửa là khách chuộng lắm anh. Nhà mình xây mấy tầng rồi anh?"];
  ok("boKhenKhongCanCu: chủ chỉ nói 'hẻm 5m' → bỏ câu 'ô tô vào tới cửa', giữ câu hỏi",
    JSON.stringify(boKhenKhongCanCu(khen, "anh bán nhà hẻm 5m Trần Bình Trọng p1 q5, 4x15, 7 tỷ 2")) === JSON.stringify(["Nhà mình xây mấy tầng rồi anh?"]));
  ok("boKhenKhongCanCu: chủ đã nói 'xe hơi vào tận nhà' → giữ nguyên (`===`)", boKhenKhongCanCu(khen, "hẻm 5m xe hơi vào tận nhà") === khen);
  ok("boKhenKhongCanCu: câu HỎI 'ô tô vào được không anh?' giữ", boKhenKhongCanCu(["Hẻm 5m ô tô vào được không anh?"], "hẻm 5m").length === 1);
  ok("boKhenKhongCanCu: 'xuyên thoáng' / 'nở hậu' chủ chưa nói → bỏ", boKhenKhongCanCu(["Nhà xuyên thoáng lại nở hậu là hiếm anh."], "nhà 4x15 3 lầu").length === 0);
  const canHem = { access_type: "hem_xe_hoi", alley_width_m: 6, legal_status: "so_hong_rieng", location_raw: "12 Trần Hưng Đạo" };
  ok("boMauThuanCan: căn hẻm 6m mà nói 'mặt tiền kinh doanh' → bỏ câu đó, giữ câu hỏi",
    JSON.stringify(boMauThuanCan(["Dạ căn 12 Trần Hưng Đạo mặt tiền kinh doanh được anh. Anh muốn xem hôm nào?"], canHem)) === JSON.stringify(["Anh muốn xem hôm nào?"]));
  ok("boMauThuanCan: nói đúng 'hẻm 6m' → giữ nguyên", boMauThuanCan(["Dạ căn 12 Trần Hưng Đạo hẻm 6m, mở quán ăn thì em hỏi lại chủ nhà cho anh nha."], canHem).length === 1);
  ok("boMauThuanCan: sổ riêng mà nói 'sổ chung' → bỏ; không có căn → không đụng",
    boMauThuanCan(["Căn này sổ chung anh nhé."], canHem).length === 0 && boMauThuanCan(["Căn này sổ chung anh nhé."], null).length === 1);
  ok("boCauGhiNhan: giữ lời SỬA THẬT 'Dạ em sửa lại giá 7 tỷ 5 rồi ạ', vẫn bỏ 'Dạ em ghi 3 lầu rồi ạ'",
    JSON.stringify(boCauGhiNhan(["Dạ em sửa lại giá 7 tỷ 5 rồi ạ.", "Dạ em ghi 3 lầu rồi ạ. Sổ riêng chưa anh?"])) === JSON.stringify(["Dạ em sửa lại giá 7 tỷ 5 rồi ạ.", "Dạ sổ riêng chưa anh?"]),
    JSON.stringify(boCauGhiNhan(["Dạ em sửa lại giá 7 tỷ 5 rồi ạ.", "Dạ em ghi 3 lầu rồi ạ. Sổ riêng chưa anh?"])));
}

{
  const nc = "#BDS-Q5-0001 · 12 Trần Hưng Đạo Phường 4 · 5,8 tỷ · 50m2 · gần chợ Hoà Bình · gần chợ";
  const bia = ["Dạ em có căn 12 Trần Hưng Đạo hẻm 6m, gần chợ Hàng Thịt lắm. Anh muốn xem hôm nào?"];
  ok("boTenRiengBia: 'chợ Hàng Thịt' không có trong kho → còn 'gần chợ lắm'",
    boTenRiengBia(bia, nc)[0] === "Dạ em có căn 12 Trần Hưng Đạo hẻm 6m, gần chợ lắm. Anh muốn xem hôm nào?", JSON.stringify(boTenRiengBia(bia, nc)));
  const that = ["Căn này gần chợ Hoà Bình, đi bộ 3 phút anh."];
  ok("boTenRiengBia: 'chợ Hoà Bình' có trong kho → giữ nguyên (`===`)", boTenRiengBia(that, nc) === that);
  ok("boTenRiengBia: 'trường Trần Đại Nghĩa' bịa → 'gần trường'; 'gần chợ' trần không đụng",
    boTenRiengBia(["Gần trường Trần Đại Nghĩa và gần chợ."], nc)[0] === "Gần trường và gần chợ.", JSON.stringify(boTenRiengBia(["Gần trường Trần Đại Nghĩa và gần chợ."], nc)));
  ok("boTenRiengBia: 'dự án Sunrise Quận 5' không có trong kho → 'dự án'; 'Chung cư Lakai' có → giữ (FR-114 e)",
    boTenRiengBia(["Có Chung cư Lakai và dự án Sunrise Quận 5 nữa ạ."], "• Chung cư Lakai - CĐT Lakai · Số 5 Nguyễn Tri Phương")[0] === "Có Chung cư Lakai và dự án nữa ạ.",
    JSON.stringify(boTenRiengBia(["Có Chung cư Lakai và dự án Sunrise Quận 5 nữa ạ."], "• Chung cư Lakai - CĐT Lakai · Số 5 Nguyễn Tri Phương")));
  ok("boTenRiengBia: tên có trong LỊCH SỬ (khách nói) → giữ", boTenRiengBia(["gần chợ An Đông đúng ý anh nè."], "khách: tìm nhà gần chợ An Đông").length === 1 && /An Đông/.test(boTenRiengBia(["gần chợ An Đông đúng ý anh nè."], "khách: tìm nhà gần chợ An Đông")[0]));
}

ok("laCauGhiNhan: 'Dạ em đã lưu nhu cầu: mua nhà Quận 5, tầm 6 tỷ để ở ạ' là câu ghi nhận có nội dung (22/09)", laCauGhiNhan("Dạ em đã lưu nhu cầu: mua nhà Quận 5, tầm 6 tỷ để ở ạ") === true);
ok("laCauGhiNhan: 'Dạ em lưu ý rồi ạ' KHÔNG tính", laCauGhiNhan("Dạ em lưu ý rồi ạ.") === false);
ok("boCauGhiNhan: bỏ 'Dạ em đã lưu nhu cầu…', giữ câu hỏi, mở lại bằng 'Dạ'",
  JSON.stringify(boCauGhiNhan(["Dạ em đã lưu nhu cầu: mua nhà Quận 5, tầm 6 tỷ để ở ạ. Mình thích hẻm xe hơi hay mặt tiền ạ?"])) === JSON.stringify(["Dạ mình thích hẻm xe hơi hay mặt tiền ạ?"]),
  JSON.stringify(boCauGhiNhan(["Dạ em đã lưu nhu cầu: mua nhà Quận 5, tầm 6 tỷ để ở ạ. Mình thích hẻm xe hơi hay mặt tiền ạ?"])));

// ── 22/09/2026 kịch bản C (nhà Trần Bình Trọng, nhiều kiểu sai) ──────────────────────────────
for (const [t, mong] of [
  ["em xoá cái hẻm 4m ghi nhầm đi", "do_rong_hem"],
  ["bỏ cái giá 7 tỷ đi em, ghi nhầm", "gia"],
  ["xoá giúp anh cái hướng đông đi", "huong"],
  ["xoá cái phường 4 đi", "phuong"],
  ["bỏ bớt 1 phòng ngủ đi, ghi dư", "so_phong_ngu"],
  ["cái đó sai rồi, bỏ đi em", null],
]) ok(`laXinBoTruong: ${JSON.stringify(t)} → ô ${mong}`, laXinBoTruong(t)?.truong === mong && laXinBoTruong(t) !== null, JSON.stringify(laXinBoTruong(t)));
for (const t of ["bỏ hẻm 4m, hẻm đúng là 3m5", "xóa sạch data của anh đi", "hẻm 4m", "gỡ tin đi em", "3 phòng ngủ", "bỏ qua câu này đi",
  "8 điểm. mà xoá căn 1 khỏi hệ thống của tui đi", "xoá căn này đi", "bỏ đi em"])
  ok(`laXinBoTruong KHÔNG kích: ${JSON.stringify(t)}`, laXinBoTruong(t) === null, JSON.stringify(laXinBoTruong(t)));
for (const [t, mong] of [["xoá căn 1 khỏi hệ thống của tui đi", true], ["gỡ căn này đi", true], ["xóa sạch data của anh", true], ["xoá cái hẻm 4m ghi nhầm đi", false], ["bỏ qua câu này", false]])
  ok(`laXinXoaDuLieu ${JSON.stringify(t)} → ${mong}`, laXinXoaDuLieu(t) === mong);
for (const [t, mong] of [["khách nào hỏi thì cho tui số của họ nha, tui tự liên hệ chốt", true], ["gửi em số zalo của khách đi", true], ["xin số khách hàng", true], ["anh cho em xin số nhà", false], ["số của chủ là 0903", false], ["khách hỏi gì em báo anh nha", false]])
  ok(`laXinSoKhach ${JSON.stringify(t)} → ${mong}`, laXinSoKhach(t) === mong);
ok("nhanDienFact: 'em xoá cái hẻm 4m ghi nhầm đi' KHÔNG phải vi_tri ('4m' không là số hẻm + hậu tố)", nhanDienFact("em xoá cái hẻm 4m ghi nhầm đi")?.question !== "vi_tri", JSON.stringify(nhanDienFact("em xoá cái hẻm 4m ghi nhầm đi")));
ok("nhanDienFact: 'hẻm 123 Trần Bình Trọng' vẫn là vi_tri", nhanDienFact("hẻm 123 Trần Bình Trọng")?.question === "vi_tri");
ok("nhanDienFact: 'hẻm 12a Nguyễn Trãi' vẫn là vi_tri (hậu tố chữ khác m)", nhanDienFact("hẻm 12a Nguyễn Trãi")?.question === "vi_tri");
ok("boCauSuaLaiModel: bỏ 'Phường 2 em sửa lại rồi ạ.' giữ câu hỏi, không đụng 📋",
  JSON.stringify(boCauSuaLaiModel(["Phường 2 em sửa lại rồi ạ. Nhà mình mấy tầng ạ?", "📋 Em đăng tin"])) === JSON.stringify(["Nhà mình mấy tầng ạ?", "📋 Em đăng tin"]),
  JSON.stringify(boCauSuaLaiModel(["Phường 2 em sửa lại rồi ạ. Nhà mình mấy tầng ạ?", "📋 Em đăng tin"])));
ok("boCauSuaLaiModel: câu không có 'sửa lại … rồi' giữ nguyên", boCauSuaLaiModel(["Nhà mình mấy tầng ạ?"])[0] === "Nhà mình mấy tầng ạ?");
for (const [t, mong] of [["7ty2", "7 tỷ 2"], ["7ti5", "7 tỷ 5"], ["4 ty 3", "4 tỷ 3"], ["3tr5", "3 triệu 5"], ["18tr/thang", "18 triệu/thang"], ["5 toi 6 ty", "5 toi 6 tỷ"], ["7 tỉ 5", "7 tỷ 5"], ["1 tỷ 1 năm", "1 tỷ 1 năm"]])
  ok(`donViGiaDep: ${JSON.stringify(t)} → ${JSON.stringify(mong)}`, donViGiaDep(t) === mong, JSON.stringify(donViGiaDep(t)));
for (const [t, mong] of [["7 ti 5", 7500000000], ["7ti5", 7500000000], ["2 ti rưỡi", 2500000000]])
  ok(`docTien 'ti' không dấu: ${t}`, docTien(t) === mong, String(docTien(t)));

// ── 23/09/2026 (bắn 26 tin kịch bản bán/mua, căn Trần Bình Trọng) ──
{
  const KHO = "#BDS-NP-Q5-0001 · Trần Bình Trọng Phường 2 · 8 tỷ 2 · 70m2 · 3PN · 4x17.5m · hẻm xe hơi 4m · sổ hồng riêng";
  const b = chanBiaDuKien(["Dạ căn này hướng Đông, thoáng và sáng lắm ạ. Chưa có quy hoạch gì, để em xác nhận lại chủ nhà nhé"], KHO);
  ok("chanBiaDuKien: 'hướng Đông' + 'chưa có quy hoạch' khi kho không có → bỏ, nhãn hướng nhà + quy hoạch",
    b.bo.includes("hướng nhà") && b.bo.includes("quy hoạch") && !/Đông|quy hoạch/.test(b.replies.join(" ")), JSON.stringify(b));
  const c = chanBiaDuKien(["Căn này hướng Đông Nam ạ."], KHO + " · hướng Đông Nam");
  ok("chanBiaDuKien: kho CÓ hướng Đông Nam → giữ nguyên", c.bo.length === 0 && c.replies[0] === "Căn này hướng Đông Nam ạ.", JSON.stringify(c));
  const d = chanBiaDuKien(["Mình muốn nhà hướng Đông hay hướng Nam ạ?", "Để em hỏi chủ về quy hoạch rồi báo mình nha."], KHO);
  ok("chanBiaDuKien: câu HỎI hướng và lời hứa hỏi quy hoạch → KHÔNG bỏ", d.bo.length === 0, JSON.stringify(d));
  const e = chanBiaDuKien(["Nhà xây năm 2018 ạ."], KHO);
  ok("chanBiaDuKien: 'xây năm 2018' không có trong kho → bỏ (năm xây)", e.bo.includes("năm xây"), JSON.stringify(e));
  const g = chanBiaDuKien(["Căn này không dính quy hoạch ạ."], KHO + " · quy_hoach: không quy hoạch");
  ok("chanBiaDuKien: kho có chữ quy hoạch → giữ", g.bo.length === 0, JSON.stringify(g));
}
ok("laHuaGuiHinh: 'Em gửi hình liền đây :)'", laHuaGuiHinh("Em gửi hình liền đây :)"));
ok("laHuaGuiHinh: 'gửi ảnh anh xem nè' KHÔNG ('gửi ảnh anh' không kèm liền/ngay)", !laHuaGuiHinh("Anh gửi ảnh sổ cho em nha"));
ok("chanHuaGuiHinh: thay đúng bong bóng hứa bằng lời thật",
  JSON.stringify(chanHuaGuiHinh(["Dạ em có căn Trần Bình Trọng ạ", "Em gửi hình liền đây :)"], "Căn này chủ nhà chưa gửi hình ạ.")) === JSON.stringify(["Dạ em có căn Trần Bình Trọng ạ", "Căn này chủ nhà chưa gửi hình ạ."]),
  JSON.stringify(chanHuaGuiHinh(["Dạ em có căn Trần Bình Trọng ạ", "Em gửi hình liền đây :)"], "Căn này chủ nhà chưa gửi hình ạ.")));
ok("laHuaHoiChu: 'Về giá, để em hỏi lại chủ nhà rồi báo anh liền.'", laHuaHoiChu(["Về giá, để em hỏi lại chủ nhà rồi báo anh liền."]));
ok("laHuaHoiChu: 'chủ nhà đang ở Q5' KHÔNG", !laHuaHoiChu(["Chủ nhà đang ở Q5 nên xem nhà dễ ạ."]));
ok("suaBotXungNhamKhach: khách ông, 'Dạ, ông ghi nhận rồi ạ.' → 'Dạ, cháu ghi nhận rồi ạ.'",
  suaBotXungNhamKhach(["Dạ, ông ghi nhận rồi ạ."], "ông")[0] === "Dạ, cháu ghi nhận rồi ạ.", suaBotXungNhamKhach(["Dạ, ông ghi nhận rồi ạ."], "ông")[0]);
ok("suaBotXungNhamKhach: khách chú, 'Dạ, chú ghi nhớ rồi ạ.' → 'Dạ, cháu ghi nhớ rồi ạ.'",
  suaBotXungNhamKhach(["Dạ, chú ghi nhớ rồi ạ."], "chú")[0] === "Dạ, cháu ghi nhớ rồi ạ.", suaBotXungNhamKhach(["Dạ, chú ghi nhớ rồi ạ."], "chú")[0]);
ok("suaBotXungNhamKhach: 'chú xem nhà lúc mấy giờ ạ?' (khách làm) giữ nguyên",
  suaBotXungNhamKhach(["Chú xem nhà lúc mấy giờ ạ?"], "chú")[0] === "Chú xem nhà lúc mấy giờ ạ?");
ok("suaBotXungNhamKhach: khách không phải chú/cô/bác → không đụng", suaBotXungNhamKhach(["Dạ, chú ghi nhớ rồi ạ."], "anh")[0] === "Dạ, chú ghi nhớ rồi ạ.");
ok("suaKhenNguocNghia: 'Căn góc view thoáng khó bán lắm cô' → 'khó kiếm lắm'",
  suaKhenNguocNghia(["Căn góc view thoáng khó bán lắm cô."])[0] === "Căn góc view thoáng khó kiếm lắm cô.", suaKhenNguocNghia(["Căn góc view thoáng khó bán lắm cô."])[0]);
ok("suaKhenNguocNghia: 'giá cao quá thì khó bán lắm' (không phải ưu điểm) giữ",
  suaKhenNguocNghia(["Giá cao quá thì khó bán lắm cô."])[0] === "Giá cao quá thì khó bán lắm cô.");
{
  const p = boDoanPhuongDiaDanh(["Dạ chú, chợ An Đông là khu P12 Quận 5 phải không ạ?"], "chú muốn mua nhà gần chợ An Đông");
  ok("boDoanPhuongDiaDanh: 'chợ An Đông là khu P12' không ai nói P12 → bỏ", !!p.bo && p.replies.length === 0, JSON.stringify(p));
  const q = boDoanPhuongDiaDanh(["Chợ An Đông ở phường 9 cũ đúng không chú?"], "chợ An Đông ở phường 9 cũ, đường An Dương Vương");
  ok("boDoanPhuongDiaDanh: khách đã nói phường 9 → giữ", !q.bo, JSON.stringify(q));
}
ok("boCauVongLai: 'Mai 9h sáng có được không?' vọng lại câu khách → bỏ, giữ câu kia",
  JSON.stringify(boCauVongLai(["Dạ được ạ.", "Mai 9h sáng có được không?"], "cho em xin số chủ nhà với, mai 9h sáng em qua xem được không")) === JSON.stringify(["Dạ được ạ."]));
ok("boCauVongLai: câu hỏi mới 'Mình cần mấy phòng ngủ ạ?' giữ",
  boCauVongLai(["Mình cần mấy phòng ngủ ạ?"], "anh cần nhà quận 5 tầm 8 tỷ").length === 1);
{
  const n = nhanDienNhieuCan("Sale bên em đang giữ 2 căn hộ The Everrich Infinity q5: căn A 1pn 52m2 giá 4.8 tỷ, căn B 2pn 80m2 giá 7 tỷ 1, full nội thất");
  ok("nhanDienNhieuCan: 'căn A …, căn B …' → 2 căn, thứ tự 1 và 2", n.length === 2 && n[0].thu === 1 && n[1].thu === 2 && n[1].gia === "7 tỷ 1", JSON.stringify(n));
  ok("nhanDienNhieuCan: 'căn A12-05' là mã căn, không phải thứ tự", nhanDienNhieuCan("căn A12-05 giá 3 tỷ, căn B7-01 giá 4 tỷ").every((c) => !c.thu));
  ok("tachTheoCan: 'căn B sổ hồng riêng' → thứ tự 2", JSON.stringify(tachTheoCan("căn B sổ hồng riêng, căn A đúc 3 tấm")) === JSON.stringify([{ thu: 2, manh: "sổ hồng riêng" }, { thu: 1, manh: "đúc 3 tấm" }]), JSON.stringify(tachTheoCan("căn B sổ hồng riêng, căn A đúc 3 tấm")));
}

ok("boCanBia: 'căn này hẻm xe hơi 4m P12, 50m2, 7,9 tỷ' → bỏ cả bong bóng",
  JSON.stringify(boCanBia(["Dạ chưa có căn khớp ạ.", "Chú ơi, căn này hẻm xe hơi 4m P12, 50m2, 7,9 tỷ. Chú có quan tâm không ạ?"])) === JSON.stringify(["Dạ chưa có căn khớp ạ."]));
ok("boCanBia: nhắc lại tiêu chí 'căn hẻm xe hơi 3 phòng tầm 8 tỷ' → giữ", boCanBia(["Dạ em lọc căn hẻm xe hơi 3 phòng tầm 8 tỷ ở Quận 5."]).length === 1);
ok("boCanBia: câu không có số tiền/diện tích → giữ", boCanBia(["Chú cần hẻm xe hơi không ạ?"]).length === 1);
ok("boCanBia: câu bịa có 'khoảng 600m' (không đứng trước tiền) → vẫn bỏ", boCanBia(["Dạ.", "Căn này hẻm xe hơi 4m P12, 50m2, 7,9 tỷ — gần chợ chỉ khoảng 600m."]).length === 1);
ok("boCanBia: câu nêu mã tin thật '#BDS-Q5-0006 … 8 tỷ' → giữ", boCanBia(["Dạ có căn #BDS-Q5-0006 nè anh, hẻm xe hơi 8 tỷ"]).length === 1);

// ── FR-214 b/d/e (23/09/2026): gán mảnh theo tin + câu "đã ghi" phải khớp DB ──
{
  const ds = [
    { code: "BDS-Q5-0001", property_type: "nha_pho", district: "Quận 11", street: "Kênh Tân Hoá", location_raw: "đường kênh Tân Hoá" },
    { code: "BDS-Q5-0002", property_type: "dat", district: "Long An", street: "Tỉnh lộ 830", location_raw: "tỉnh lộ 830" },
  ];
  ok("canGanManh: một tin, câu thường (không 'còn/thêm <loại>') → không hỏi model", !canGanManh("15 tỉ nhé cháu, 2 tầng", [ds[0]], "BDS-Q5-0001"));
  ok("canGanManh: một tin, trả lời câu treo RỒI 'À anh còn miếng đất …' → hỏi model (bắn thật 23/09)", canGanManh("phường 9 em. À anh còn miếng đất ở Nhơn Trạch 2 tỷ 3 nữa", [ds[0]], "BDS-Q5-0001"));
  ok("canGanManh: một tin, câu MỞ ĐẦU bằng 'còn nhà …' (không có phần trả lời trước) → không hỏi model", !canGanManh("còn nhà thì 4 phòng ngủ", [ds[0]], "BDS-Q5-0001"));
  ok("canGanManh: một tin, không có câu treo → không hỏi model", !canGanManh("phường 9 em. À anh còn miếng đất ở Nhơn Trạch", [ds[0]], null));
  ok("canGanManh: hai số tiền trong một câu → hỏi", canGanManh("15 tỉ nhé cháu còn nhà ở quận 11 cũ muốn 7 tỉ", ds, "BDS-Q5-0002"));
  ok("canGanManh: 'còn nhà …' → hỏi", canGanManh("còn nhà thì 4 phòng ngủ", ds, "BDS-Q5-0002"));
  ok("canGanManh: nói loại NHÀ khi đang hỏi lô đất, người đó có tin nhà → hỏi", canGanManh("Nhà phố mà thổ cư full nhà 3 phòng ngủ shr", ds, "BDS-Q5-0002"));
  ok("canGanManh: nhắc quận của tin KHÁC → hỏi", canGanManh("bên quận 11 thì 60m2", ds, "BDS-Q5-0002"));
  ok("canGanManh: trả lời thường cho câu đang treo → không hỏi", !canGanManh("15 tỉ nhé cháu", ds, "BDS-Q5-0002"));
  ok("canGanManh: nhắc quận của CHÍNH tin đang treo → không hỏi", !canGanManh("quận 11 cháu", ds, "BDS-Q5-0001"));
  const text = "15 tỉ nhé cháu còn nhà ở quận 11 cũ muốn 7 tỉ";
  const m = donManh({ manh: [{ trich: "15 tỉ nhé cháu", ma_tin: "bds-q5-0002" }, { trich: "còn nhà ở quận 11 cũ muốn 7 tỉ", ma_tin: "BDS-Q5-0001" }] }, text, ds.map((t) => t.code));
  ok("donManh: giữ mảnh nguyên văn + mã hợp lệ (mã viết thường vẫn nhận)", m.length === 2 && m[0].ma === "BDS-Q5-0002" && m[1].ma === "BDS-Q5-0001", JSON.stringify(m));
  ok("donManh: mảnh không có trong tin (model chép sai/bịa) → bỏ", donManh({ manh: [{ trich: "nhà 9 tỉ", ma_tin: "BDS-Q5-0001" }] }, text, ds.map((t) => t.code)).length === 0);
  ok("donManh: mã không thuộc người này → bỏ; MOI/KHONG → giữ", JSON.stringify(donManh({ manh: [{ trich: "15 tỉ", ma_tin: "BDS-Q5-0099" }, { trich: "còn nhà", ma_tin: "MOI" }, { trich: "nhé cháu", ma_tin: "KHONG" }] }, text, ds.map((t) => t.code)).map((x) => x.ma)) === JSON.stringify(["MOI", "KHONG"]));
  ok("donManh: đầu ra rỗng/null → []", donManh(null, text, []).length === 0 && donManh({ manh: [] }, text, []).length === 0);
  ok("boCauGhiTienKhongCo: 'cháu ghi 9 tỷ' khi DB chỉ có 15 tỷ và 7 tỷ → bỏ câu đó, giữ câu hỏi",
    JSON.stringify(boCauGhiTienKhongCo(["Dạ cháu ghi 9 tỷ cho căn Quận 11 rồi cô. Lô đất mình hướng nào cô?"], [15e9, 7e9], docTien)) === JSON.stringify(["Lô đất mình hướng nào cô?"]),
    JSON.stringify(boCauGhiTienKhongCo(["Dạ cháu ghi 9 tỷ cho căn Quận 11 rồi cô. Lô đất mình hướng nào cô?"], [15e9, 7e9], docTien)));
  ok("boCauGhiTienKhongCo: số khớp DB → giữ nguyên", boCauGhiTienKhongCo(["Dạ cháu ghi 15 tỷ căn Long An, 7 tỷ căn Quận 11 rồi cô."], [15e9, 7e9], docTien).length === 1);
  ok("boCauGhiTienKhongCo: bong bóng 💾/📝 (đọc từ DB) không đụng", boCauGhiTienKhongCo(["📝 Cháu ghi vào tin BDS-Q5-0001: giá 9 tỷ."], [], docTien).length === 1);
  ok("boCauGhiTienKhongCo: câu không nói 'ghi/lưu' → không đụng", boCauGhiTienKhongCo(["Khu này giá tầm 9 tỷ cô ạ."], [7e9], docTien).length === 1);
}

// ── FR-218 (23/09/2026): lời chào không kèm "anh Thu phụ trách"; hiểu nhầm ý khách thì xin lỗi ──
ok("LOI_CHAO không còn câu 'phụ trách khu vực' / 'anh Thu'", !/phụ trách|anh Thu/.test(LOI_CHAO) && /mua, thuê hay/.test(LOI_CHAO), LOI_CHAO);
for (const [cau, mong] of [
  ["không phải vậy em, ý anh là mua để ở", true],
  ["em hiểu nhầm rồi, anh cần thuê chứ không mua", true],
  ["hieu sai r e oi", true],
  ["anh đâu có nói quận 7", true],
  ["em ghi nhầm rồi, 7 tỷ 5 chứ", true],
  ["ko phai the, can ho chu k phai nha pho", true],
  ["trả lời lạc đề quá", true],
  ["ý chị là căn góc", true],
  // KHÔNG được kích
  ["không phải chính chủ, anh là môi giới", false],
  ["sai rồi, giá 7 tỷ 5 nha", false],
  ["nhà không phải hẻm cụt", false],
  ["quy hoạch không có gì", false],
  ["tuy anh là môi giới nhưng", false],
  ["không phải trả phí à em", false],
  ["cần mua nhà quận 5 tầm 6 tỷ", false],
  ["nhầm số nhà rồi, số 12 mới đúng", false],
]) ok(`laKhachBaoHieuNham ${JSON.stringify(cau)} → ${mong}`, laKhachBaoHieuNham(cau) === mong);
{
  const r = themXinLoiKhiHieuNham("không phải vậy, ý anh là thuê", ["🤖 Đã lưu nhu cầu: thuê", "Dạ anh cần thuê khu nào ạ?"], "anh");
  ok("themXinLoi: chèn sau dòng máy 🤖, gộp 'Dạ' đầu bong bóng", r.length === 2 && r[1] === "Dạ em xin lỗi anh, em hiểu nhầm ạ. Anh cần thuê khu nào ạ?", JSON.stringify(r));
  const r2 = themXinLoiKhiHieuNham("hiểu sai rồi", ["Dạ em xin lỗi, em sửa lại liền ạ."], null);
  ok("themXinLoi: model đã xin lỗi → giữ nguyên", r2.length === 1 && r2[0] === "Dạ em xin lỗi, em sửa lại liền ạ.", JSON.stringify(r2));
  const r3 = themXinLoiKhiHieuNham("cần mua nhà quận 5", ["Dạ anh cần tầm giá bao nhiêu ạ?"], "anh");
  ok("themXinLoi: khách không báo nhầm → không chèn", r3[0] === "Dạ anh cần tầm giá bao nhiêu ạ?", JSON.stringify(r3));
  const r4 = doiTuXung(themXinLoiKhiHieuNham("ý chú là bán chứ không phải cho thuê", ["Dạ chú bán giá bao nhiêu ạ?"], "chú"), "chú");
  ok("themXinLoi + doiTuXung: khách là chú → 'Dạ cháu xin lỗi chú, cháu hiểu nhầm ạ.'", /^Dạ cháu xin lỗi chú, cháu hiểu nhầm ạ\. Chú bán/.test(r4[0]), JSON.stringify(r4));
  const r5 = themXinLoiKhiHieuNham("hiểu nhầm rồi", ["Dạ.", "Mình cần gì ạ?"], null);
  ok("themXinLoi: chưa biết cách gọi → không 'xin lỗi mình'; bong bóng 'Dạ.' trần thành lời xin lỗi", r5[0] === "Dạ em xin lỗi, em hiểu nhầm ạ." && r5[1] === "Mình cần gì ạ?", JSON.stringify(r5));
}

// ── 23/09/2026 bắn thật 5 bán + 2 mua: khen sai theo MỆNH ĐỀ, mã tin gửi khách mua ──
{
  const r4 = boMenhDeKhenSai(["Hẻm 2m5 ngang 4m thì nhà mình chốn rất được khách tìm. Mình cần bán gấp hay có thể chờ giá thích hợp ạ?"], "Bán nhà hẻm xe máy 2m5 đường Nguyễn Trãi");
  ok("khen hẻm xe máy 2m5 'rất được khách tìm' → bỏ câu khen, giữ câu hỏi", r4.length === 1 && r4[0] === "Mình cần bán gấp hay có thể chờ giá thích hợp ạ?", JSON.stringify(r4));
  const r5 = boMenhDeKhenSai(["Hẻm 5m ô tô vào tận nhà là khách sẵn sàng cọc nhanh, anh chị cần bán gấp hay được giá đẹp thì thôi ạ?"], "hẻm 5m, ô tô đậu ngay trước cửa");
  ok("'ô tô đậu trước cửa' mà bot nói 'ô tô vào tận nhà' → bỏ mệnh đề đó, câu hỏi còn nguyên", r5.length === 1 && r5[0] === "Anh chị cần bán gấp hay được giá đẹp thì thôi ạ?", JSON.stringify(r5));
  const r5b = boMenhDeKhenSai(["Xe hơi vào tận nhà thì khách chuộng lắm. Mình cần bán gấp không ạ?"], "xe hơi vào tận nhà, có gara");
  ok("chủ CÓ nói 'xe hơi vào tận nhà' → giữ lời khen", r5b[0].startsWith("Xe hơi vào tận nhà"), JSON.stringify(r5b));
  const r5c = boMenhDeKhenSai(["Hẻm xe hơi 6m quay đầu thoải mái thì khách chuộng lắm."], "hẻm xe hơi 6m quay đầu thoải mái");
  ok("hẻm 6m xe hơi có căn cứ → giữ lời khen", r5c.length === 1 && /chuộng/.test(r5c[0]), JSON.stringify(r5c));
  ok("laKhenSai: 'hẻm 2m' + 'khách chuộng' → sai", laKhenSai("Hẻm 2m khách chuộng lắm", "hẻm 2m"));
  ok("laKhenSai: 'Mặt tiền kinh doanh khách hay chốt nhanh' khi chủ nói mặt tiền → không sai", !laKhenSai("Mặt tiền An Dương Vương khách hay chốt nhanh lắm", "nhà mặt tiền An Dương Vương"));
  ok("laKhenSai: câu hỏi 'ô tô vào tận nhà được không?' → không đụng", !laKhenSai("Ô tô vào tận nhà được không ạ?", ""));
  // FR-227 b (25/09/2026): từ 3m là hẻm xe hơi; "hxm" khách nói rõ thì vẫn là hẻm xe máy.
  ok("laKhenSai: 'hẻm 3m' + 'khách chuộng' → không còn là hẻm nhỏ", !laKhenSai("Hẻm 3m khách chuộng lắm", "hẻm 3m"));
  ok("laKhenSai: 'hẻm 2m9' + 'khách chuộng' → sai", laKhenSai("Hẻm 2m9 khách chuộng lắm", "hẻm 2m9"));
  ok("laKhenSai: 'hxm' + 'khách chuộng' → sai", laKhenSai("Hxm này khách chuộng lắm", "hxm 3m"));
  const r6 = boMenhDeKhenSai(["Hẻm 3m ô tô vào được thì khách chuộng lắm =) Em tra thấy đường Ngô Y Linh thuộc Phường An Lạc, đúng không anh chị?"], "cần bán nhà hxm 3m đường Ngô Y Linh");
  ok("lx-25: khen 'ô tô vào' dính câu hỏi sau '=)' khi khách nói hxm → bỏ khen, giữ câu hỏi", r6.length === 1 && r6[0] === "Em tra thấy đường Ngô Y Linh thuộc Phường An Lạc, đúng không anh chị?", JSON.stringify(r6));
  const r7 = boMenhDeKhenSai(["Hẻm xe hơi 5m, khách chuộng lắm. Mình cần bán gấp không ạ?"], "bán nhà hẻm 3m đường Lê Văn Việt");
  ok("lx-24: vế chính bị cắt, còn 'khách chuộng lắm' → bỏ luôn mẩu cụt", r7.length === 1 && r7[0] === "Mình cần bán gấp không ạ?", JSON.stringify(r7));
  const m1 = boMaTinKhach(["Dạ em lưu lại rồi. Em có căn #BDS-NP-Q5-0004 · Hùng Vương Phường 4 · 6 tỷ 9 · 56m2 · 3PN, mình xem thử nha?"], {});
  ok("mã tin + '·' → bỏ mã và dấu, giữ địa chỉ", m1[0] === "Dạ em lưu lại rồi. Em có căn Hùng Vương Phường 4 · 6 tỷ 9 · 56m2 · 3PN, mình xem thử nha?", JSON.stringify(m1));
  const m2 = boMaTinKhach(["Dạ có căn #BDS-Q5-0001 hợp anh nè"], { "BDS-Q5-0001": "Trần Hưng Đạo" });
  ok("mã tin trong câu → thay bằng tên đường của căn", m2[0] === "Dạ có căn Trần Hưng Đạo hợp anh nè", JSON.stringify(m2));
  const m3 = boMaTinKhach(["📝 Em ghi vào tin BDS-Q5-0001: giá 9 tỷ."], {});
  ok("dòng máy 📝 (đọc từ DB) → không đụng", m3[0] === "📝 Em ghi vào tin BDS-Q5-0001: giá 9 tỷ.", JSON.stringify(m3));
  const m4 = boMaTinKhach(["Căn BDS-Q5-0001 và căn BDS-Q5-0002 đều hợp anh"], { "BDS-Q5-0001": "Trần Hưng Đạo" });
  ok("mã không có trong kho → bỏ, không để 'căn căn'", m4[0] === "Căn Trần Hưng Đạo và căn đều hợp anh", JSON.stringify(m4));
}

// ── 24/09/2026 FR-218 b: đủ quận + giá mà model chỉ hỏi dò → đưa căn ──
{
  const cans = [
    { code: "BDS-NP-Q5-0005", ten: "Trần Bình Trọng", dong: "Trần Bình Trọng Phường 1 · 6 tỷ 5 · 60m² · trệt + lửng + 2 lầu · 3 phòng ngủ" },
    { code: "BDS-NP-Q5-0003", ten: "Nguyễn Trãi", dong: "Nguyễn Trãi Phường 2 · 6 tỷ 3 · 56m²" },
    { code: "BDS-NP-Q5-0001", ten: "Hùng Vương", dong: "Hùng Vương Phường 4 · 6 tỷ 7" },
  ];
  ok("coNhacCan: nhắc tên đường KHÔNG dấu vẫn tính", coNhacCan(["Dạ căn tran binh trong hợp mình nè"], cans));
  ok("coNhacCan: nhắc mã tin", coNhacCan(["căn #BDS-NP-Q5-0003 nè"], cans));
  ok("coNhacCan: chỉ câu hỏi dò → chưa nhắc căn", !coNhacCan(["Dạ mình có ba mẹ ở cùng hay phòng riêng vậy?"], cans));
  ok("coNhacCan: bong bóng 🤖 báo lưu có tên đường → không tính", !coNhacCan(["🤖 Đã lưu nhu cầu: khu vực muốn tìm: Nguyễn Trãi"], cans));
  const bb = bongBongGoiYCan(cans, "chị");
  ok("bongBongGoiYCan: 2 căn đầu, không mã, kết bằng MỘT câu hỏi, viết hoa đầu câu hỏi",
    /Trần Bình Trọng/.test(bb) && /Nguyễn Trãi/.test(bb) && !/Hùng Vương/.test(bb) && !/BDS-/.test(bb) && (bb.match(/\?/g) ?? []).length === 1 && /\nChị thấy căn nào/.test(bb), bb);
  const hd = boCauHoiDo(["🤖 Đã lưu nhu cầu: mua", "Dạ mình có ba mẹ ở cùng hay phòng riêng vậy?", "Quận 5 bên em có Lakai và Dragon Riverside ạ."]);
  ok("boCauHoiDo: bỏ câu hỏi dò ngắn, giữ báo lưu + câu có nội dung", hd.length === 2 && hd[0].startsWith("🤖") && /Lakai/.test(hd[1]), JSON.stringify(hd));
}

// ── 24/09/2026 FR-218 c: câu khẳng định đặc điểm căn không ghi; alley bịa trong hồ sơ mua ──
{
  const cans = [
    { ten: "Châu Văn Liêm", du_lieu: "Châu Văn Liêm P10 · trệt + 2 lầu · 3PN · chủ tả: phòng nào cũng có cửa sổ đón gió" },
    { ten: "Hùng Vương", du_lieu: "Hùng Vương P4 · trệt + 2 lầu · chủ tả: phía sau có khoảng đất trống rộng cho chó mèo" },
    { ten: "Trần Bình Trọng", du_lieu: "Trần Bình Trọng P1 · chủ tả: có 1 phòng ngủ ngay tầng trệt tiện cho ông bà" },
  ];
  const d1 = boDacDiemKhongCo(["• Châu Văn Liêm P10 · 6 tỷ 8\n• Hùng Vương P4 · 6 tỷ 7\n\nCả 2 căn đều có phòng ngủ ở tầng trệt cho ba mẹ. Mình xem căn nào trước ạ?"], cans);
  ok("'Cả 2 căn đều có phòng ngủ ở tầng trệt' cho 2 căn không ghi → thay bằng 'em hỏi lại chủ', giữ danh sách + câu hỏi",
    d1.bo.length === 1 && !/đều có phòng ngủ/.test(d1.replies[0]) && /hỏi lại chủ/.test(d1.replies[0]) && /Châu Văn Liêm/.test(d1.replies[0]) && /xem căn nào trước ạ\?$/.test(d1.replies[0]), JSON.stringify(d1));
  const giu = [
    ["căn CÓ ghi phòng ngủ trệt", "Căn Trần Bình Trọng có 1 phòng ngủ ngay tầng trệt cho ba mẹ nha."],
    ["'sân sau' khớp 'đất trống phía sau'", "Căn Hùng Vương có sân sau rộng cho cún chạy."],
    ["câu phủ định", "Căn Châu Văn Liêm không có thang máy ạ."],
    ["câu hỏi", "Căn Châu Văn Liêm có thang máy không ạ?"],
    ["dòng máy 🤖", "🤖 Đã lưu nhu cầu: cần phòng ngủ ở tầng trệt"],
    ["không gắn với căn nào", "Nhà có phòng ngủ ở tầng trệt thì ba mẹ đỡ leo cầu thang lắm."],
  ];
  for (const [ten, cau] of giu) {
    const r = boDacDiemKhongCo([cau], cans);
    ok(`giữ nguyên: ${ten}`, r.bo.length === 0 && r.replies[0] === cau, JSON.stringify(r));
  }
  const d2 = boDacDiemKhongCo(["Căn Châu Văn Liêm có thang máy, sân thượng rộng."], cans);
  ok("thang máy căn không ghi → thay", d2.bo.includes("thang máy") && !/có thang máy/.test(d2.replies[0]), JSON.stringify(d2));
  const h1 = locHoSoMua({ alley: "hẻm xe hơi" }, "tìm nhà quận 5 tầm 6 tới 7 tỷ, có phòng ngủ dưới trệt cho ba mẹ già");
  ok("hồ sơ mua: alley 'hẻm xe hơi' khi khách không nói gì về đường vào → gỡ", h1.profile.alley === null && h1.bo.includes("alley"), JSON.stringify(h1));
  const h2 = locHoSoMua({ alley: "hẻm xe hơi" }, "cần hẻm ô tô vào được");
  ok("hồ sơ mua: khách nói 'hẻm ô tô' → giữ alley", h2.profile.alley === "hẻm xe hơi", JSON.stringify(h2));
}

// ── 24/09/2026: 🤖 "Bóc tách được" — chỉ thứ bóc từ tin vừa nhắn, giá trị trong ngoặc kép ──
{
  const t1 = bocTachTaoTin({ property_type: "nha_pho", deal: "ban", location_raw: "hẻm 4m Nguyễn Trãi", ward: "Phường 2", district: "Quận 5", area_m2: 56, price_raw: "5 tới 6", price_vnd: null, bedrooms: 2 });
  ok("bocTachTaoTin: lượt tạo tin in từng cột trong ngoặc kép, giá không ra số nói rõ",
    t1 === '🤖 Bóc tách được: loại: "Nhà phố bán" · địa chỉ: "hẻm 4m Nguyễn Trãi, Phường 2, Quận 5" · diện tích: "56m²" · phòng ngủ: "2" · giá: "5 tới 6 (chưa đọc ra số)"', String(t1));
  const t2 = bocTachTaoTin({ property_type: "nha_pho", deal: "ban", location_raw: "hẻm 12 Hồ Ngọc Lãm", district: null, area_m2: 50, price_raw: "3 tỷ", price_vnd: 3e9 });
  ok("bocTachTaoTin: chưa rõ quận → nói '(chưa rõ quận)', không bịa Quận 5", /địa chỉ: "hẻm 12 Hồ Ngọc Lãm \(chưa rõ quận\)"/.test(t2 ?? "") && !/Quận 5/.test(t2 ?? ""), String(t2));
  const t0 = bocTachTaoTin({ property_type: "nha_pho", deal: "ban", location_raw: null, ward: null, district: null });
  // FR-226 a (25/09/2026, chủ dự án: "Nhà người ta chưa có gì mà nó tự nhận là nhà phố"): tin nhà chưa có dấu hiệu nhà phố → "Nhà".
  ok("bocTachTaoTin: chưa có địa chỉ → KHÔNG in 'địa chỉ: \"(chưa rõ)…\"'; chưa có dấu hiệu nhà phố → 'Nhà bán'", t0 === '🤖 Bóc tách được: loại: "Nhà bán"', String(t0));
  ok("bocTachTaoTin: câu rao 'bán nhà 4 tấm' / cột số tầng 3 → 'Nhà phố bán'",
    /"Nhà phố bán"/.test(bocTachTaoTin({ property_type: "nha_pho", deal: "ban", description: "bán nhà 4 tấm" }) ?? "") && /"Nhà phố bán"/.test(bocTachTaoTin({ property_type: "nha_pho", deal: "ban", floors: 3 }) ?? ""));
  const t3 = vuaLuuBan([{ question: "so_phong_ngu", answer: "3" }, { question: "ket_cau", answer: "4 tầng" }], { ket_cau: "kết cấu", so_phong_ngu: "số phòng ngủ" });
  ok("vuaLuuBan: lượt sau → 'Bóc tách được' + đúng các fact lượt đó", t3 === '🤖 Bóc tách được: kết cấu: "4 tầng" · số phòng ngủ: "3"', String(t3));
}

// ── 24/09/2026: "ở Nguyễn Trãi quận 5" là ĐỊA CHỈ, không phải tiềm năng "để ở" ──
for (const [cau, laTiemNang] of [
  ["ở Nguyễn Trãi quận 5", false], ["ở nguyễn trãi q5", false], ["nhà ở Trần Hưng Đạo", false], ["ở phường 2", false],
  ["để ở", true], ["ở", true], ["ở gia đình", true], ["hợp để ở hoặc cho thuê", true], ["kinh doanh", true],
]) {
  const r = nhanDienFact(cau);
  ok(`tiềm năng: ${JSON.stringify(cau)} → ${laTiemNang ? "tiem_nang" : "không phải tiem_nang"}`, (r?.question === "tiem_nang") === laTiemNang, JSON.stringify(r));
}

// ── 24/09/2026 FR-219: thứ tự "chủ nhà dễ trả lời trước"; câu liên quan không vượt dải (vật lý → tiền → pháp lý → phường) ──
{
  const CB = (k, p) => ({ fact_key: k, priority: p, nhom: "co_ban" });
  const nhaPho = [CB("ket_cau", 4), CB("so_phong_ngu", 5), CB("do_rong_hem", 7), CB("gia", 12), CB("phap_ly", 16), CB("phuong", 17), CB("gap", 18), CB("hinh_anh", 19)];
  ok("vừa nói diện tích → hỏi KẾT CẤU (không kéo giá lên dù giá 'liên quan' diện tích)", chonCauKe(["dien_tich_dat"], nhaPho) === "ket_cau", String(chonCauKe(["dien_tich_dat"], nhaPho)));
  ok("vừa nói kết cấu → hỏi phòng ngủ (liên quan, cùng dải)", chonCauKe(["ket_cau"], nhaPho.slice(1)) === "so_phong_ngu");
  ok("vừa nói giá → hỏi PHÁP LÝ, không nhảy sang phường", chonCauKe(["gia"], [CB("phap_ly", 16), CB("phuong", 17), CB("gap", 18)]) === "phap_ly");
  ok("vừa nói vị trí → hỏi diện tích, không nhảy sang phường", chonCauKe(["vi_tri"], [CB("dien_tich_dat", 3), CB("ket_cau", 4), CB("phuong", 17)]) === "dien_tich_dat");
  ok("vừa nói hẻm → kết cấu còn thiếu thì hỏi kết cấu (liên quan, cùng dải vật lý)", chonCauKe(["do_rong_hem"], [CB("so_phong_ngu", 5), CB("ket_cau", 4), CB("gia", 12)]) === "ket_cau");
}

// ── 24/09/2026 FR-220: trả lời "có tầng lửng, sân thượng hay tầng hầm không" → chen vào kết cấu chữ ──
{
  const ca = [
    ["trệt + 2 lầu", 3, "có lửng với sân thượng", "trệt + lửng + 2 lầu + sân thượng"],
    ["trệt + 2 lầu", 3, "không có lửng, có sân thượng", "trệt + 2 lầu + sân thượng"],
    ["trệt + 2 lầu", 3, "lửng thì có, hầm không", "trệt + lửng + 2 lầu"],
    ["trệt + 2 lầu", 3, "không có lửng mà có sân thượng", "trệt + 2 lầu + sân thượng"],
    ["1 trệt 2 lầu", 3, "có gác lửng", "1 trệt + lửng + 2 lầu"],
    [null, 4, "có tầng hầm và sân thượng", "hầm + trệt + 3 lầu + sân thượng"],
    ["4 tầng", 4, "có lửng", "4 tầng + lửng"],
    ["trệt", 1, "có áp mái", "trệt + áp mái"],
    ["trệt + 2 lầu", 3, "không có", null],
    ["trệt + 2 lầu", 3, "có", null],
    ["trệt + 2 lầu", 3, "có sân thượng không em?", null],
    [null, null, "có lửng", null],
    ["trệt + lửng + 2 lầu", 3, "có lửng", null],
  ];
  for (const [kc, t, dap, mong] of ca) ok(`tầng phụ "${dap}" trên "${kc ?? t + " tầng"}" → ${mong}`, themTangPhu(kc, t, dap) === mong, String(themTangPhu(kc, t, dap)));
  for (const dap of ["có sân thượng", "không có", "sân thượng thì có", "ko"]) ok(`"${dap}" là câu trả lời KHỚP cho tang_phu`, phanLoaiCauTraLoi("tang_phu", dap).loai === "khop", phanLoaiCauTraLoi("tang_phu", dap).loai);
}

// ── 24/09/2026 (chủ dự án test Zalo, người bán Gò Vấp) ──
{
  ok("'đường số 59 Gò vấp' → vị trí 'đường số 59'", bocViTriRao("Anh cần bán nhà ở đường số 59 Gò vấp,") === "đường số 59", String(bocViTriRao("Anh cần bán nhà ở đường số 59 Gò vấp,")));
  ok("'đường Số 7 phường An Lạc' → 'đường Số 7'", bocViTriRao("bán nhà đường Số 7 phường An Lạc") === "đường Số 7", String(bocViTriRao("bán nhà đường Số 7 phường An Lạc")));
  ok("'hẻm 5m Lê Đức Thọ' không đổi", bocViTriRao("hẻm 5m Lê Đức Thọ gò vấp") === "hẻm 5m Lê Đức Thọ", String(bocViTriRao("hẻm 5m Lê Đức Thọ gò vấp")));
  const T = "137/28 nhé em, cần bán gấp giá 5 tỏi 9 thương lượng 5 tỏi 5 là bán được";
  ok("câu vị trí '137/28 nhé em, cần bán gấp…' → '137/28'", catDapAn("vi_tri", T) === "137/28", catDapAn("vi_tri", T));
  ok("câu vị trí '137/28 Nguyễn Trãi, phường 3' giữ nguyên", catDapAn("vi_tri", "137/28 Nguyễn Trãi, phường 3") === "137/28 Nguyễn Trãi, phường 3", catDapAn("vi_tri", "137/28 Nguyễn Trãi, phường 3"));
  const sn = soNhaDau(T);
  ok("số nhà đầu câu: '137/28' + phần còn lại", sn?.soNha === "137/28" && /^cần bán gấp/.test(sn?.conLai ?? ""), JSON.stringify(sn));
  ok("'số nhà 12/3A' → '12/3A'", soNhaDau("số nhà 12/3A nha")?.soNha === "12/3A");
  ok("'5 tỷ 9, thương lượng' không phải số nhà", soNhaDau("5 tỷ 9, thương lượng") === null);
  ok("'4m, hẻm xe hơi' không phải số nhà", soNhaDau("4m, hẻm xe hơi") === null);
  ok("'dài 16m' + ngang 5 đã có → 'ngang 5m dài 16m'", ghepMotChieu("dien_tich_dat", "dài 16m", "5", null) === "ngang 5m dài 16m", String(ghepMotChieu("dien_tich_dat", "dài 16m", "5", null)));
  ok("'Ngang 5' trần → null (đi đường cũ: ghi mặt tiền, câu diện tích treo)", ghepMotChieu("dien_tich", "Ngang 5", null, 18) === null);
  ok("'dài 16m' mà chưa có ngang → null", ghepMotChieu("dien_tich_dat", "dài 16m", null, null) === null);
  ok("'5x16' đủ hai chiều → null (đường cũ)", ghepMotChieu("dien_tich_dat", "5x16", "5", null) === null);
  ok("đang hỏi giá thì không ghép", ghepMotChieu("gia", "dài 16m", "5", null) === null);
  // 24/09/2026 (chủ dự án test Zalo, nhà mặt tiền Trần Đình Xu)
  const tdx = "Quận 1 8x15m 3 tầng · Góc 2 mặt tiền\nHợp đồng thuê Sacombank đến năm 2031 · 150 triệu/tháng\nGóc hai mặt tiền ngay nút giao Trần Đình Xu – Nguyễn Cư Trinh";
  ok("địa chỉ KHÔNG đi xuyên dấu xuống dòng ('mặt tiền⏎Hợp đồng' không phải địa chỉ)", !/Hợp đồng/.test(bocViTriRao(tdx) ?? ""), String(bocViTriRao(tdx)));
  ok("'mặt tiền ngay nút giao Trần Đình Xu' → giữ trọn tên đường", /Trần Đình Xu$/.test(bocViTriRao("Góc hai mặt tiền ngay nút giao Trần Đình Xu – Nguyễn Cư Trinh") ?? ""), String(bocViTriRao("Góc hai mặt tiền ngay nút giao Trần Đình Xu – Nguyễn Cư Trinh")));
  ok("'đã cho thuê là nhà đã hoàn thiện hết rồi em, đăng rao bán đi' KHÔNG phải báo bán rồi", laNgungRao("đã cho thuê là nhà đã hoàn thiện hết rồi em, đăng rao bán đi") === null, String(laNgungRao("đã cho thuê là nhà đã hoàn thiện hết rồi em, đăng rao bán đi")));
  ok("'nhà đang cho ngân hàng thuê, hợp đồng tới 2031' KHÔNG phải báo bán rồi", laNgungRao("nhà đã cho ngân hàng thuê, hợp đồng tới 2031") === null, String(laNgungRao("nhà đã cho ngân hàng thuê, hợp đồng tới 2031")));
  ok("'bán rồi em' vẫn là bán rồi", laNgungRao("bán rồi em") === "ban_roi");
  ok("'cho thuê được rồi em' vẫn là bán rồi (tin cho thuê)", laNgungRao("cho thuê được rồi em") === "ban_roi");
  ok("'đã có người cọc rồi' vẫn là bán rồi", laNgungRao("đã có người cọc rồi") === "ban_roi", String(laNgungRao("đã có người cọc rồi")));
  for (const t of ["đã trả lời rồi này", "anh nói rồi mà", "trả lời ở trên rồi em", "gửi rồi đó", "nhắn lúc nãy rồi"]) ok(`'${t}' là câu 'đã trả lời'`, laNoiDaTraLoi(t));
  for (const t of ["4 tầng, 4 phòng ngủ nhé", "nhà trả lời điện thoại suốt", "anh nói chung là nhà đẹp lắm, 4 tầng, hẻm xe hơi, sổ hồng riêng đầy đủ"]) ok(`'${t}' KHÔNG phải câu 'đã trả lời'`, !laNoiDaTraLoi(t));
  const bia = ["137m2 trên sổ, giá 5 tỷ 9 thương lượng 5 tỷ 5, khuôn đất này dễ xây lắm anh. Nhà mình xây mấy tầng rồi ạ?"];
  const ra = boCauM2KhongCo(bia, [], "137/28 nhé em, cần bán gấp giá 5 tỏi 9");
  ok("model nói '137m2' mà DB không có, khách không gõ → bỏ câu đó, giữ câu hỏi", ra.length === 1 && !/137m2/.test(ra[0]) && /xây mấy tầng/.test(ra[0]), JSON.stringify(ra));
  ok("model nói '80m2' khớp DB → giữ", boCauM2KhongCo(["80m2 vuông vức, dễ bán lắm anh."], [80], "")[0] === "80m2 vuông vức, dễ bán lắm anh.");
  ok("khách tự gõ 'sàn 200m2' → giữ câu model nhắc 200m2", boCauM2KhongCo(["Sàn 200m2 rộng rãi anh."], [80], "sàn 200m2 nha")[0] === "Sàn 200m2 rộng rãi anh.");
  ok("gạch dài giữa câu → dấu phẩy", boGachDai("Độ đầy đủ 85/100 — thêm tiềm năng là đủ ạ.") === "Độ đầy đủ 85/100, thêm tiềm năng là đủ ạ.", boGachDai("Độ đầy đủ 85/100 — thêm tiềm năng là đủ ạ."));
  ok("gạch giữa hai số → '-'", boGachDai("tầm 5–6 tỷ") === "tầm 5-6 tỷ", boGachDai("tầm 5–6 tỷ"));
  ok("gạch đầu dòng → '- '", boGachDai("— căn 1\n— căn 2") === "- căn 1\n- căn 2", JSON.stringify(boGachDai("— căn 1\n— căn 2")));
  ok("gạch cuối câu không để lại ', .'", boGachDai("Dạ em ghi rồi —.") === "Dạ em ghi rồi.", boGachDai("Dạ em ghi rồi —."));
  ok("bong bóng 🤖 không đụng", boCauM2KhongCo(["🤖 Bóc tách được: diện tích: \"137m2\""], [], "")[0].startsWith("🤖"));
  // 24/09/2026 (chủ dự án: "hoàn công xong chưa cứ hỏi lung tung vậy ko dc"): bot không tự hỏi hoàn công.
  const hc = (x) => boHoiHoanCong([x]);
  ok("'sổ riêng hay chung, đã hoàn công chưa anh?' → bỏ vế hoàn công, giữ 'anh?'", hc("Sổ hồng nhà mình là sổ riêng hay sổ chung, đã hoàn công chưa anh?")[0] === "Sổ hồng nhà mình là sổ riêng hay sổ chung anh?", JSON.stringify(hc("Sổ hồng nhà mình là sổ riêng hay sổ chung, đã hoàn công chưa anh?")));
  ok("câu hỏi chỉ một ý hoàn công → bỏ cả câu, giữ câu ghi nhận", JSON.stringify(hc("Dạ em ghi 4 phòng ngủ rồi.\nNhà mình đã hoàn công xong chưa anh?")) === JSON.stringify(["Dạ em ghi 4 phòng ngủ rồi."]), JSON.stringify(hc("Dạ em ghi 4 phòng ngủ rồi.\nNhà mình đã hoàn công xong chưa anh?")));
  ok("hai câu hỏi: bỏ câu hoàn công, giữ câu kia", JSON.stringify(hc("Nhà đã hoàn công chưa ạ? Anh muốn bán gấp không?")) === JSON.stringify(["Anh muốn bán gấp không?"]));
  ok("'Hoàn công năm nào anh?' → bỏ hết", hc("Hoàn công năm nào anh?").length === 0);
  ok("câu KHẲNG ĐỊNH nhắc hoàn công (chủ đã nói) → giữ", hc("Sổ hồng riêng, hoàn công đủ thì khách yên tâm lắm. Anh muốn rao giá bao nhiêu ạ?")[0] === "Sổ hồng riêng, hoàn công đủ thì khách yên tâm lắm. Anh muốn rao giá bao nhiêu ạ?");
  ok("bong bóng 💾 đọc DB có 'hoàn công' → không đụng", hc("💾 Đã lưu: sổ hồng riêng, hoàn công?")[0] === "💾 Đã lưu: sổ hồng riêng, hoàn công?");
  ok("không nhắc hoàn công → trả nguyên mảng", (() => { const a = ["Sổ riêng hay sổ chung anh?"]; return boHoiHoanCong(a) === a; })());
}

// 25/09/2026 (bắn thật lx-07): số nhà trần → model tự nói "Nhà mặt tiền …". Chủ chưa nói mặt tiền / hẻm thì bỏ mệnh đề đó.
{
  const rao = "Bán nhà 105 Trần Bình Trọng quận 10, 4x15, 1 trệt 2 lầu, 3 phòng ngủ, sổ hồng riêng, giá 12 tỷ";
  const r = boMenhDeKhenSai(["Nhà mặt tiền Trần Bình Trọng, ngang sâu vừa vặn, dễ bán lắm. Em đang rao, có khách hỏi là báo mình liền nha :)"], rao)[0];
  ok("MT-01 số nhà trần, bot nói 'Nhà mặt tiền …' → bỏ mệnh đề đó, giữ phần còn lại", !/mặt tiền/i.test(r) && /Ngang sâu vừa vặn/.test(r) && /có khách hỏi/.test(r), r);
  ok("MT-02 chủ ĐÃ nói 'mặt tiền' → giữ", boMenhDeKhenSai(["Nhà mặt tiền Trần Bình Trọng dễ cho thuê lắm ạ."], "bán nhà mặt tiền 105 Trần Bình Trọng")[0] === "Nhà mặt tiền Trần Bình Trọng dễ cho thuê lắm ạ.");
  ok("MT-03 chủ nói 'MT' viết tắt → giữ", boMenhDeKhenSai(["Nhà mặt tiền kinh doanh tốt ạ."], "ban nha MT Tran Binh Trong 12 ty")[0] === "Nhà mặt tiền kinh doanh tốt ạ.");
  ok("MT-04 'mặt tiền 4m' là chiều ngang, không phải vị trí → giữ", boMenhDeKhenSai(["Mặt tiền 4m nở hậu nhẹ là đẹp rồi ạ."], "4x15 no hau")[0] === "Mặt tiền 4m nở hậu nhẹ là đẹp rồi ạ.");
  ok("MT-05 câu HỎI mặt tiền hay hẻm → giữ", boMenhDeKhenSai(["Nhà mình mặt tiền hay trong hẻm vậy anh?"], rao)[0] === "Nhà mình mặt tiền hay trong hẻm vậy anh?");
  const h = boMenhDeKhenSai(["Nhà trong hẻm yên tĩnh, ở sướng lắm. Anh cần bán gấp không ạ?"], rao)[0];
  ok("MT-06 số nhà trần, bot nói 'nhà trong hẻm' → bỏ, giữ câu hỏi", !/hẻm/.test(h) && /bán gấp/.test(h), h);
  ok("MT-07 số nhà có xuyệt '105/12' → 'trong hẻm' có căn cứ, giữ", boMenhDeKhenSai(["Nhà trong hẻm yên tĩnh lắm ạ."], "bán nhà 105/12 Trần Bình Trọng")[0] === "Nhà trong hẻm yên tĩnh lắm ạ.");
  ok("MT-08 chủ nói 'HXH' → 'hẻm' có căn cứ, giữ", boMenhDeKhenSai(["Hẻm rộng thoáng ạ."], "nha HXH 6m")[0] === "Hẻm rộng thoáng ạ.");
}

// 25/09/2026 (bắn thật lx-09 / lx-08): câu hỏi model lệch khoá code chọn; "đã đăng lên web" khi tin chưa đăng.
{
  const gapMau = "Mình cần ra hàng gấp hay được giá thì thôi anh chị?";
  ok("LK-01 khoá gap, model hỏi hẻm → lệch", laHoiLechKhoa("Dạ, hẻm nhà mình rộng mấy mét, ô tô vào được không anh chị?", "gap"));
  ok("LK-02 thay câu hỏi lệch bằng câu mẫu, giữ phần ghi nhận", thayCauHoiLech("Dạ em ghi rồi ạ. Hẻm nhà mình rộng mấy mét anh chị?", "gap", gapMau) === `Dạ em ghi rồi ạ. ${gapMau}`);
  ok("LK-03 khoá gap, model hỏi 'có cần bán gấp không' → KHÔNG lệch", !laHoiLechKhoa("Dạ vâng. Nhà mình có cần bán gấp không anh?", "gap"));
  ok("LK-04 khoá ket_cau, model hỏi 'mấy lầu' → KHÔNG lệch", !laHoiLechKhoa("Nhà mình xây mấy lầu rồi chị?", "ket_cau"));
  ok("LK-05 khoá phuong, câu hỏi không mang chủ đề nào → KHÔNG lệch (không đoán)", !laHoiLechKhoa("Nhà mình thuộc khu nào vậy anh?", "phuong"));
  ok("LK-06 khoá không có trong bảng → KHÔNG soi", !laHoiLechKhoa("Hẻm rộng mấy mét anh?", "tien_ich"));
  ok("LK-07 không có câu hỏi → KHÔNG lệch", !laHoiLechKhoa("Dạ em ghi nhận rồi ạ.", "gap"));
  ok("LK-08 khoá so_phong_ngu, model hỏi sổ → lệch", laHoiLechKhoa("Sổ hồng riêng hay sổ chung vậy anh?", "so_phong_ngu"));
  const dd = boHuaDaDang(["Em cảm ơn mình tin nhé, đã đăng lên web AI Ơi Nhà Đất rồi :) Em tra thấy đường Trần Bình Trọng thuộc Phường Vườn Lài (Quận 10 cũ), đúng không anh chị?"])[0];
  ok("DD-01 'đã đăng lên web … rồi' → bỏ mệnh đề, giữ lời cảm ơn và câu hỏi", !/đăng/.test(dd) && /Em cảm ơn mình tin nhé/.test(dd) && /Phường Vườn Lài/.test(dd), dd);
  ok("DD-02 'tin đã lên web luôn rồi ạ' → bỏ", boHuaDaDang(["Dạ tin đã lên web luôn rồi ạ. Nhà mình mấy tầng anh?"])[0] === "Nhà mình mấy tầng anh?");
  ok("DD-03 'chưa đăng' (phủ định) → giữ", boHuaDaDang(["Tin chưa đăng đâu ạ, còn thiếu giá."])[0] === "Tin chưa đăng đâu ạ, còn thiếu giá.");
  ok("DD-04 'em sẽ đăng' (tương lai) → giữ", boHuaDaDang(["Đủ thông tin là em sẽ đăng lên web ngay ạ."])[0] === "Đủ thông tin là em sẽ đăng lên web ngay ạ.");
  ok("DD-05 bong bóng 📝 → không đụng", boHuaDaDang(["📝 Đã đăng: 105 Trần Bình Trọng"])[0] === "📝 Đã đăng: 105 Trần Bình Trọng");
}

// 25/09/2026 (bắn thật lx-13): 🤖 "thông số: … lửng … sân thượng" rồi "nhãn: sân thượng · có gác lửng" — không in lặp.
{
  const b = bocTachTaoTin({ property_type: "nha_pho", deal: "ban", location_raw: "105/12 Trần Bình Trọng", ward: "Phường Chợ Quán", district: "Quận 5", floors_text: "trệt + lửng + 2 lầu + sân thượng", frontage_m: 4, length_m: 15, nhan: ["san_thuong", "gac_lung", "yen_tinh"] });
  ok("NL-01 bocTachTaoTin: nhãn bỏ 'sân thượng' / 'có gác lửng' (thông số đã có), giữ 'yên tĩnh'", /nhãn: "yên tĩnh"/.test(b) && !/nhãn: "[^"]*(?:sân thượng|lửng)/.test(b), b);
}

// FR-225 a (25/09/2026, chủ dự án test Zalo): khách "nở hậu nhé" → bot "Anh nói nở hậu 4.5 nhỉ, em ghi rồi" (số lấy từ ví dụ prompt).
{
  const bc = "5x12 · nở hậu nhé · a bán 4t";
  ok("SOBIA-01 'nở hậu 4.5' khi khách không nói số → bịa", laSoDoBia("Anh nói nở hậu 4.5 nhỉ", bc));
  ok("SOBIA-02 'nở hậu 4m5' ↔ khách '4m5' / '4,5' ↔ '4.5' → không bịa", !laSoDoBia("nở hậu 4m5 nha", "nở hậu 4m5") && !laSoDoBia("nở hậu 4,5m", "no hau 4.5"));
  ok("SOBIA-03 'ngang 5 dài 12' từ '5x12' → không bịa", !laSoDoBia("ngang 5 dài 12", bc));
  ok("SOBIA-04 'hẻm 3m' khi khách nói 'hẻm 3m5' → bịa", laSoDoBia("hẻm 3m", "hẻm 3m5"));
  const r = boMenhDeKhenSai(boKhenKhongCanCu(["Anh nói nở hậu 4.5 nhỉ, em ghi rồi. Còn giá bán anh định rao là bao nhiêu?"], bc), bc);
  ok("SOBIA-05 câu bịa bị bỏ, câu hỏi giá giữ", r.length === 1 && !/4\.5/.test(r[0]) && /giá bán/.test(r[0]), JSON.stringify(r));
}

console.log(hong ? `\nVAN TRẢ LỜI: ${hong}/${tong} CA HỎNG` : `\nVAN TRẢ LỜI: ${tong}/${tong} CA ĐẠT`);
process.exit(hong ? 1 : 0);
