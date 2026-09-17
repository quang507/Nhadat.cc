// van-tra-loi.mjs — lỗi còn chờ sau lượt bắn 20 tin thật 12/09/2026, phần TS.
// Tiền định: không mạng, không DB, không model.
//   bun bot/tests/van-tra-loi.mjs
//
// Phần SQL (tầng căn hộ, giá "/tháng", tên đường "m Nguyễn Trãi") ở migration
// 20260913a — đã chạy thử trên DB bằng khối DO rollback, không nằm ở đây.
import { boCauGhiNhan, boHoiMucDich, chanHuaCoHang, dapHoiNguocTienDinh, laLoiMeta, motCauHoi, chanNhanLaNguoi, gopGhiChu, laCauGhiNhan, laHoiCoHang, laHoiMucDich, laHuaCoHang, laNhanLaNguoi, locHoSoMua, suaTuXungMua, doiTuXung } from "../supabase/functions/_shared/extraction/van-tra-loi.ts";
import { docTien, gonGiaKyHan } from "../supabase/functions/_shared/extraction/luat-tien.ts";
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

// ── 14/09 FR-207: 💾 đã báo thì bỏ ghi nhận lần hai; tóm tắt nói đủ dự án/tầng/nội thất ─
{
  const ra = boCauGhiNhan([
    "Dạ em ghi số phòng ngủ 4 rồi ạ.",
    "Hẻm xe hơi thì thanh khoản cao quá. Dạ em ghi 1 trệt 3 lầu, 4 phòng, sổ hồng riêng rồi. Nhà mình ở đường nào vậy ạ?",
  ]);
  ok("bỏ bong bóng chỉ có câu ghi nhận; bỏ câu ghi nhận giữa bong bóng, giữ khen + câu hỏi",
    ra.length === 1 && ra[0] === "Hẻm xe hơi thì thanh khoản cao quá. Nhà mình ở đường nào vậy ạ?", JSON.stringify(ra));
  const ra2 = boCauGhiNhan(["Dạ em ghi 9 tỷ 5, 1 trệt 2 lầu, 4 phòng ngủ rồi ạ. Nhà mình ở phường nào vậy?"]);
  ok("câu đầu 'Dạ em ghi …' bị bỏ → câu còn lại mở bằng 'Dạ'", ra2[0] === "Dạ nhà mình ở phường nào vậy?", JSON.stringify(ra2));
  const giu = ["📋 Em đăng tin như vầy nha anh:\nBán nhà…", "💾 Vừa lưu: giá: \"6 tỷ 5\"", "Dạ em ghi nhận rồi ạ.", "Sổ riêng thì khách chốt nhanh lắm anh."];
  ok("không đụng bản nháp, 💾, ghi nhận trơ trọi, câu khen", JSON.stringify(boCauGhiNhan(giu)) === JSON.stringify(giu), JSON.stringify(boCauGhiNhan(giu)));
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
  ok("tomTatTrongCau đọc lại tóm tắt từ 💾 lượt tạo lẫn 📦 lượt sau",
    tomTatTrongCau("💾 Đã lưu: Nhà phố bán · 60m²\nSai chỗ nào…") === "Nhà phố bán · 60m²" &&
    tomTatTrongCau('💾 Vừa lưu: hướng: "đông nam"\n📦 Tin giờ: Nhà phố bán · hướng Đông Nam') === "Nhà phố bán · hướng Đông Nam");
  const mua = vuaLuuMua({ area: "Quận 5" }, { area: "Quận 5", budget: "7 tỷ", deal: "ban", ten_tro_ly: "H•ai", xung_ho: "chị", gan_tien_ich_loc: { m: 1000 } },
    [["deal", "mua hay thuê"], ["area", "khu vực muốn tìm (phường nào)"], ["budget", "khoảng giá"]]);
  ok("người mua: chỉ khoá ĐỔI, không khoá nội bộ, deal 'ban' đọc là 'mua'", mua === "💾 Đã lưu nhu cầu: mua hay thuê: mua · khoảng giá: 7 tỷ", String(mua));
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
  const b = boHoiMucDich(["💾 Đã lưu nhu cầu: mua", "Dạ em lọc Quận 6 tầm 4 tỷ cho anh nhé. Anh tìm nhà hẻm hay mặt tiền, để ở hay đầu tư ạ?"]);
  ok("dò mục đích: bỏ đúng câu hỏi, giữ 💾 và câu trước", b.daBo && b.replies.length === 2 && b.replies[1] === "Dạ em lọc Quận 6 tầm 4 tỷ cho anh nhé.", JSON.stringify(b));
  const c = boHoiMucDich(["Mình tìm để ở hay đầu tư ạ?"]);
  ok("dò mục đích: bỏ hết thì giữ nguyên (không gửi lượt im)", !c.daBo && c.replies.length === 1, JSON.stringify(c));
}
ok("gõ dính: 'Emghi nhận…' → 'Em ghi nhận…'", suaTuXungMua("Emghi nhận nhu cầu của mình ạ.") === "Em ghi nhận nhu cầu của mình ạ.", suaTuXungMua("Emghi nhận nhu cầu của mình ạ."));
ok("gõ dính: 'Emmy', 'em gái' giữ nguyên", suaTuXungMua("Emmy và em gái") === "Emmy và em gái", suaTuXungMua("Emmy và em gái"));
ok("gõ dính + 💾: câu 'Emghi nhận nhu cầu…, sắp lọc…' bị bỏ", boCauGhiNhan(["Dạ được.", suaTuXungMua("Emghi nhận nhu cầu của mình, sắp lọc được căn phù hợp liền ạ.")]).length === 1);
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
  ["💾 Vừa lưu: giá: \"4 tỷ\"", "💾 Vừa lưu: giá: \"4 tỷ\""],
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

console.log(hong ? `\nVAN TRẢ LỜI: ${hong}/${tong} CA HỎNG` : `\nVAN TRẢ LỜI: ${tong}/${tong} CA ĐẠT`);
process.exit(hong ? 1 : 0);
