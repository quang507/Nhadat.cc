// van-tra-loi.mjs — lỗi còn chờ sau lượt bắn 20 tin thật 12/09/2026, phần TS.
// Tiền định: không mạng, không DB, không model.
//   bun bot/tests/van-tra-loi.mjs
//
// Phần SQL (tầng căn hộ, giá "/tháng", tên đường "m Nguyễn Trãi") ở migration
// 20260913a — đã chạy thử trên DB bằng khối DO rollback, không nằm ở đây.
import { boCauTrung, boKhenKhongCanCu, boMauThuanCan, boTenRiengBia, boCauGhiNhan, boGachCheo, boHoiMucDich, chanHuaCoHang, dapHoiNguocTienDinh, laLoiMeta, laNoiVoiBot, laXinBoTruong, laXinSoKhach, laXinXoaDuLieu, boCauSuaLaiModel, motCauHoi, chanNhanLaNguoi, gopGhiChu, laCauGhiNhan, laHoiCoHang, laHoiMucDich, laHuaCoHang, laNhanLaNguoi, locHoSoMua, suaTuXungMua, doiTuXung, vuaKhen, boCauKhen } from "../supabase/functions/_shared/extraction/van-tra-loi.ts";
import { boCanBia, boCauVongLai, boDoanPhuongDiaDanh, chanBiaDuKien, chanHuaGuiHinh, laHuaGuiHinh, laHuaHoiChu, suaBotXungNhamKhach, suaKhenNguocNghia } from "../supabase/functions/_shared/extraction/van-tra-loi.ts";
import { boCauGhiTienKhongCo } from "../supabase/functions/_shared/extraction/van-tra-loi.ts";
import { canGanManh, donManh } from "../supabase/functions/_shared/extraction/gan-manh-loc.ts";
import { nhanDienNhieuCan, tachTheoCan } from "../supabase/functions/_shared/extraction/khop-cau-tra-loi.ts";
import { docTien, donViGiaDep, gonGiaKyHan } from "../supabase/functions/_shared/extraction/luat-tien.ts";
import { nhanDienFact } from "../supabase/functions/_shared/extraction/khop-cau-tra-loi.ts";
import { tuXungTuCau } from "../supabase/functions/_shared/extraction/khop-cau-tra-loi.ts";
import { soanTinNhap } from "../supabase/functions/_shared/tin-nhap.ts";
import { CAU_TIEN_DINH, dienCau } from "../supabase/functions/_shared/prompts.ts";
import { kemLuotTao, tomTatDaLuu, tomTatTrongCau, vuaLuuMua } from "../supabase/functions/_shared/bao_lai.ts";

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
  ok("người mua: chỉ khoá ĐỔI, không khoá nội bộ, deal 'ban' đọc là 'mua'", mua === "🤖 Đã lưu nhu cầu: mua hay thuê: mua · khoảng giá: 7 tỷ", String(mua));
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
  ok("canGanManh: một tin thì không bao giờ hỏi model", !canGanManh("15 tỉ còn nhà muốn 7 tỉ", [ds[0]], "BDS-Q5-0001"));
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

console.log(hong ? `\nVAN TRẢ LỜI: ${hong}/${tong} CA HỎNG` : `\nVAN TRẢ LỜI: ${tong}/${tong} CA ĐẠT`);
process.exit(hong ? 1 : 0);
