// hoi-ve-tin.mjs — chủ nhà hỏi về CHÍNH TIN CỦA MÌNH (22/09/2026, bắn thật căn hộ Hùng Vương Plaza).
// Tiền định, không mạng.   bun bot/tests/hoi-ve-tin.mjs
import { dapHoiVeTin, hoiVeTin } from "../supabase/functions/_shared/extraction/hoi-ve-tin.ts";

let hong = 0, tong = 0;
const ok = (ten, dat, chi = "") => { tong++; if (!dat) hong++; console.log(`${dat ? "✓" : "✗"} ${ten}${dat ? "" : `  → ${chi}`}`); };

for (const [t, mong] of [
  ["hồi nãy anh nói giá bao nhiêu nhỉ", "gia"],
  ["giá anh để là bao nhiêu vậy em", "gia"],
  ["có khách nào hỏi chưa em", "khach"],
  ["có ai hỏi căn anh chưa", "khach"],
  ["đã có khách quan tâm chưa em?", "khach"],
  ["tin anh đăng chưa em", "trang_thai"],
  ["tầng mấy nhỉ", "tang"],
  ["diện tích bao nhiêu m2 nhỉ em", "dien_tich"],
  ["pháp lý tin ghi sao em", "phap_ly"],
  ["giá 4 tỷ 3 được không?", null],
  ["giá 4 tỷ 5 nha em", null],
  ["sổ hồng riêng, full nội thất, có thang máy, view sông", null],
  ["3 phòng ngủ", null],
  ["ok em", null],
  ["không gấp em, được giá thì bán", null],
  ["bên em phí sao", null],
  ["em là bot hay người vậy", null],
  ["căn đó bán rồi em, cảm ơn em nha", null],
  ["Được giá, căn tôi sở hữu nhưng chưa vào xem bạn có thông tin thêm về căn này không", null],
  ["hướng đông nam, mà phí bên em tính sao", null],
  // 22/09 kịch bản C: hỏi ĐÃ BÁN CHƯA là hỏi về tin — model từng đáp "để em hỏi chủ nhà" với chính chủ nhà.
  ["bán rồi hả em?", "ban_chua"],
  ["nhà anh bán được chưa em", "ban_chua"],
  ["có ai mua chưa em", "ban_chua"],
  ["bán rồi", null],
  ["giá bán được chưa em", null],
]) ok(`hoiVeTin: ${JSON.stringify(t)} → ${mong}`, hoiVeTin(t) === mong, String(hoiVeTin(t)));

ok("dapHoiVeTin gia có giá", dapHoiVeTin("gia", { price_raw: "4 tỷ 5" }, { quan_tam: 0, hoi: 0 }, "anh") === "Dạ giá mình đang rao là 4 tỷ 5 ạ.");
ok("dapHoiVeTin gia gõ 'ty' không dấu → đọc 'tỷ' (bắn thật 22/09)", dapHoiVeTin("gia", { price_raw: "4 ty 3" }, { quan_tam: 0, hoi: 0 }, "anh") === "Dạ giá mình đang rao là 4 tỷ 3 ạ.");
ok("dapHoiVeTin gia chưa có giá → xin giá", /chưa có giá/.test(dapHoiVeTin("gia", {}, { quan_tam: 0, hoi: 0 }, "chị")));
ok("dapHoiVeTin khách 0 → chưa có khách", /chưa có khách nào hỏi/.test(dapHoiVeTin("khach", {}, { quan_tam: 0, hoi: 0 }, "anh")));
ok("dapHoiVeTin khách 2 quan tâm, 1 câu hỏi", /2 khách quan tâm/.test(dapHoiVeTin("khach", {}, { quan_tam: 2, hoi: 1 }, "anh")) && /1 câu/.test(dapHoiVeTin("khach", {}, { quan_tam: 2, hoi: 1 }, "anh")));
ok("dapHoiVeTin địa chỉ ghép", dapHoiVeTin("dia_chi", { location_raw: "126 Hùng Vương", ward: "Phường 12", district: "Quận 5" }, { quan_tam: 0, hoi: 0 }, "anh") === "Dạ tin ghi địa chỉ 126 Hùng Vương, Phường 12, Quận 5 ạ.");
ok("dapHoiVeTin pháp lý có nhãn", /sổ hồng riêng/.test(dapHoiVeTin("phap_ly", { legal_status: "so_hong_rieng" }, { quan_tam: 0, hoi: 0 }, "anh")));
ok("dapHoiVeTin bán chưa, đang lên kệ, 0 khách → 'chưa bán' + 'có khách chốt là em báo'", /^Dạ chưa bán ạ/.test(dapHoiVeTin("ban_chua", { status: "dang_ban" }, { quan_tam: 0, hoi: 0 }, "anh")) && /báo anh liền/.test(dapHoiVeTin("ban_chua", { status: "dang_ban" }, { quan_tam: 0, hoi: 0 }, "anh")), dapHoiVeTin("ban_chua", { status: "dang_ban" }, { quan_tam: 0, hoi: 0 }, "anh"));
ok("dapHoiVeTin bán chưa, 2 khách quan tâm → nêu số khách", /2 khách quan tâm/.test(dapHoiVeTin("ban_chua", { status: "dang_ban" }, { quan_tam: 2, hoi: 0 }, "anh")));
ok("dapHoiVeTin bán chưa, đã chốt → 'đã chốt'", /đã chốt/.test(dapHoiVeTin("ban_chua", { status: "da_chot" }, { quan_tam: 0, hoi: 0 }, "anh")));
ok("dapHoiVeTin trạng thái đang bán", /lên kệ rồi/.test(dapHoiVeTin("trang_thai", { status: "dang_ban" }, { quan_tam: 0, hoi: 0 }, "anh")));

console.log(hong ? `\nHỎI VỀ TIN: ${hong}/${tong} CA HỎNG` : `\nHỎI VỀ TIN: ${tong}/${tong} CA ĐẠT`);
process.exit(hong ? 1 : 0);
