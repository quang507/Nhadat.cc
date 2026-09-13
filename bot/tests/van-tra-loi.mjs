// van-tra-loi.mjs — lỗi còn chờ sau lượt bắn 20 tin thật 12/09/2026, phần TS.
// Tiền định: không mạng, không DB, không model.
//   bun bot/tests/van-tra-loi.mjs
//
// Phần SQL (tầng căn hộ, giá "/tháng", tên đường "m Nguyễn Trãi") ở migration
// 20260913a — đã chạy thử trên DB bằng khối DO rollback, không nằm ở đây.
import { chanHuaCoHang, chanNhanLaNguoi, gopGhiChu, laCauGhiNhan, laHoiCoHang, laHuaCoHang, laNhanLaNguoi } from "../supabase/functions/_shared/extraction/van-tra-loi.ts";
import { docTien, gonGiaKyHan } from "../supabase/functions/_shared/extraction/luat-tien.ts";
import { tuXungTuCau } from "../supabase/functions/_shared/extraction/khop-cau-tra-loi.ts";
import { soanTinNhap } from "../supabase/functions/_shared/tin-nhap.ts";
import { CAU_TIEN_DINH, dienCau } from "../supabase/functions/_shared/prompts.ts";

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

console.log(hong ? `\nVAN TRẢ LỜI: ${hong}/${tong} CA HỎNG` : `\nVAN TRẢ LỜI: ${tong}/${tong} CA ĐẠT`);
process.exit(hong ? 1 : 0);
