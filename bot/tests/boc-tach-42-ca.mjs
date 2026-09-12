// boc-tach-42-ca.mjs — tầng bóc tách tiền định trên các câu của lượt bắn 42 ca
// (11/09/2026). Không mạng, không DB, không model. Chạy bằng bun (import .ts):
//   bun bot/tests/boc-tach-42-ca.mjs
//
// Lượt bắn đọc lại DB bằng bong bóng 💾 và lòi ra: giá "9t5"/"4t2"/"3tr5" rơi,
// "4 tỷ rưỡi" thành 4 tỷ, "75 triệu/m2" thành giá cả căn, số đọc bằng chữ không
// bóc được gì, "anh bận" thành tên phường, "sai rồi em, phường 9 chứ không phải
// phường 4" ghi Phường 4, "căn q5" thành mã căn, nhà Hà Nội vào Quận 5. Mỗi ca
// dưới đây là một câu THẬT của lượt đó (hoặc biến thể sát nó).
// Phía SQL (parse_vnd, chuan_hoa_gia_raw, guess_property_type, boc_thong_so) sửa
// ở migration 20260911e; bảng ca tiền chung ở luat/tien.json (doi-chieu-tien.mjs).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { docTien, giaTheoM2, vndThanhChu } from "../supabase/functions/_shared/extraction/luat-tien.ts";
import { soChuThanhSo } from "../supabase/functions/_shared/extraction/so-chu.ts";
import {
  bocViTriRao, cheoPhuDinh, laHoanLai, nhanDienNhieuCan, nhanDienNhieuFact, phanLoaiCauTraLoi, tuXungTuCau, vungPhuDinh,
} from "../supabase/functions/_shared/extraction/khop-cau-tra-loi.ts";
import { vungNgoai } from "../supabase/functions/_shared/dia_ban.ts";

const HERE = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
let hong = 0, tong = 0;
const ok = (ten, dat, chi = "") => {
  tong++;
  if (!dat) hong++;
  console.log(`${dat ? "✓" : "✗"} ${ten}${dat ? "" : `  → ${chi}`}`);
};

// ── Luật tiền (bản TS) trên cả bảng ca chung ────────────────────────────────
const { ca } = JSON.parse(readFileSync(join(HERE, "luat", "tien.json"), "utf8"));
for (const c of ca) if ("mong" in c) ok(`docTien "${c.cau}"`, docTien(c.cau) === c.mong, String(docTien(c.cau)));
ok("giaTheoM2('75 triệu/m2') = 75 triệu", giaTheoM2("75 triệu/m2") === 75_000_000, String(giaTheoM2("75 triệu/m2")));
ok("giaTheoM2('5 tỷ') = null (không phải giá mỗi m²)", giaTheoM2("5 tỷ") === null, String(giaTheoM2("5 tỷ")));
for (const v of [3_750_000_000, 3_050_000_000, 850_000_000, 12_000_000_000]) {
  ok(`vndThanhChu(${v}) đọc lại đúng số`, docTien(vndThanhChu(v)) === v, vndThanhChu(v));
}

// ── Số đọc bằng chữ ─────────────────────────────────────────────────────────
for (const [vao, mong] of [
  ["bán nhà quận năm phường hai diện tích năm mươi mét vuông giá bốn tỷ rưỡi", "bán nhà quận 5 phường 2 diện tích 50m2 giá 4 tỷ rưỡi"],
  ["nhà ba lầu, bốn phòng", "nhà 3 lầu, 4 phòng"],
  ["giá một trăm linh năm triệu", "giá 105 triệu"],
  ["bốn tỷ hai", "4 tỷ 2"],
  ["mới xây năm ngoái, hướng nam", "mới xây năm ngoái, hướng nam"],
  ["giá hai ba tỷ", "giá hai ba tỷ"],
  ["ba mẹ anh ở cùng", "ba mẹ anh ở cùng"],
  ["bán nhà q5 60m2 6 tỷ", "bán nhà q5 60m2 6 tỷ"],
]) ok(`soChuThanhSo "${vao}"`, soChuThanhSo(vao) === mong, soChuThanhSo(vao));

// ── Khách tự xưng ───────────────────────────────────────────────────────────
for (const [vao, mong] of [
  ["e oi a can ban nha o q8 nha 3 lau 4x12 gia 4t2 nhe", "anh"],
  ["chị Lan đây em, chị bán nhà q6 phường 10, 55m2, 4 tỷ", "chị"],
  ["để anh hỏi vợ đã em", "anh"],
  ["hỏi gì hỏi lắm vậy em, anh bận", "anh"],
  ["nhà anh đẹp lắm em, mới xây năm ngoái", "anh"],
  ["sổ hồng riêng", null],
  ["bán nhà q5 60m2 8 tỷ", null],
]) ok(`tuXungTuCau "${vao}"`, tuXungTuCau(vao) === mong, String(tuXungTuCau(vao)));

// ── Bận / hoãn ──────────────────────────────────────────────────────────────
for (const [vao, mong] of [
  ["hỏi gì hỏi lắm vậy em, anh bận", true],
  ["để anh hỏi vợ đã em", true],
  ["để anh bàn với vợ", true],
  ["anh chưa biết nữa em ơi hỏi lại sau", true],
  ["để coi", false],
  ["phường 5 nha, anh bận", false],
  ["Bàn Cờ", false],
  ["sổ hồng riêng", false],
]) ok(`laHoanLai "${vao}"`, laHoanLai(vao) === mong, String(laHoanLai(vao)));

// ── Vế phủ định ─────────────────────────────────────────────────────────────
{
  const s = "sai rồi em, phường 9 chứ không phải phường 4";
  const c = cheoPhuDinh(s);
  ok("cheoPhuDinh giữ nguyên độ dài (chỉ số khớp trên câu gốc vẫn đúng)", c.length === s.length, `${c.length}/${s.length}`);
  ok("cheoPhuDinh che 'phường 4', giữ 'phường 9'", /phường 9/.test(c) && !/phường 4/.test(c), JSON.stringify(c));
  ok("vungPhuDinh tìm đúng một vùng", vungPhuDinh(s).length === 1, JSON.stringify(vungPhuDinh(s)));
  const c2 = cheoPhuDinh("không phải phường 4 mà là phường 9");
  ok("cheoPhuDinh 'không phải X mà là Y' giữ Y", /phường 9/.test(c2) && !/phường 4/.test(c2), JSON.stringify(c2));
  ok("câu không có phủ định giữ nguyên", cheoPhuDinh("phường 9 nha em") === "phường 9 nha em");
}

// ── Phân loại câu trả lời ───────────────────────────────────────────────────
for (const [q, vao, mong] of [
  ["phuong", "hỏi gì hỏi lắm vậy em, anh bận", "hoan"],
  ["vi_tri", "để anh hỏi vợ đã em", "hoan"],
  ["gap", "để anh bàn với vợ", "hoan"],
  ["phuong", "Nguyễn Cư Trinh", "khop"],
  ["phuong", "Bàn Cờ", "khop"],
  ["phuong", "p5", "khop"],
  ["phuong", "anh không biết phường nào nữa em", "lech"],
  ["phuong", "phường Tân Hưng", "khop"],
  ["phuong", "xã Phong Phú", "khop"],
  ["vi_tri", "4m", "lech"],
]) {
  const k = phanLoaiCauTraLoi(q, vao);
  ok(`phanLoaiCauTraLoi [${q}] "${vao}" → ${mong}`, k.loai === mong, k.loai);
}

// ── Fact trong câu rao: mảnh trước cả câu ───────────────────────────────────
{
  const f = nhanDienNhieuFact("bán nhà hxh Nguyễn Trãi p3 q5, 4x16, 1 trệt 2 lầu, shr, 9t5");
  const pl = f.find((x) => x.question === "phap_ly")?.answer;
  ok("fact pháp lý là mảnh 'shr', không phải NGUYÊN câu rao", pl === "shr", JSON.stringify(f));
}

// ── Nhiều căn ───────────────────────────────────────────────────────────────
{
  const nc = nhanDienNhieuCan("anh có 2 căn: 1 căn q5 50m2 6 tỷ, 1 căn q11 40m2 4 tỷ");
  ok("'1 căn q5 …, 1 căn q11 …' → 2 căn, 'q5' là QUẬN không phải mã căn",
    nc.length === 2 && nc[0].quan === "Quận 5" && nc[1].quan === "Quận 11" && !nc[0].ma && !nc[1].ma &&
      nc[0].dt === "50" && nc[0].gia === "6 tỷ" && nc[1].gia === "4 tỷ",
    JSON.stringify(nc));
  const lo = nhanDienNhieuCan("căn A5 8x20 giá 18 tỷ, căn A7 8x20 giá 18 tỷ 5");
  ok("mã căn thật (A5, A7) vẫn là mã căn", lo.length === 2 && lo[0].ma === "A5" && lo[1].ma === "A7" && !lo[0].quan, JSON.stringify(lo));
}

// ── Vùng ngoài địa bàn ──────────────────────────────────────────────────────
for (const [vao, mong] of [
  ["ban nha o ha noi quan cau giay 50m2 9 ty", "Hà Nội|true"],
  ["ban nha da nang gan bien", "Đà Nẵng|true"],
  ["ban nha thu dau mot binh duong", "Bình Dương|false"],
  ["ban dat bien hoa dong nai", "Đồng Nai|false"],
  ["ban nha q5 phuong 2", "null"],
  ["ban dat ben luc long an", "null"],
]) {
  const v = vungNgoai(vao);
  ok(`vungNgoai "${vao}"`, (v ? `${v.ten}|${v.xa}` : "null") === mong, JSON.stringify(v));
}

// ── Câu trả lời kèm lời dặn (Zalo thật 11/09, dự án ehome 3) ────────────────
{
  const { catDapAn } = await import("../supabase/functions/_shared/extraction/khop-cau-tra-loi.ts");
  for (const [q, vao, mong] of [
    ["vi_tri", "Bạn phải ghi dự án chung cư ehome 3 chứ ở hồ ngọc lãm", "hồ ngọc lãm"],
    ["vi_tri", "hẻm 102 Trần Bình Trọng", "hẻm 102 Trần Bình Trọng"],
    ["vi_tri", "sửa lại giúp em, nhà ở hẻm 45 Trần Phú", "hẻm 45 Trần Phú"],
    ["phuong", "Đường hồ ngọc lãm quận 8 phường 6", "Phường 6"],
    ["phuong", "p5 em", "Phường 5"],
    ["phuong", "Nguyễn Cư Trinh", "Nguyễn Cư Trinh"],
    ["gia", "5 tỷ 2", "5 tỷ 2"],
  ]) ok(`catDapAn [${q}] "${vao}"`, catDapAn(q, vao) === mong, catDapAn(q, vao));
}

// ── 12/09/2026 — VỊ TRÍ TRONG CÂU RAO (lượt bắn 20 tin thật: 7/7 tin mất địa chỉ,
// bot hỏi đường vòng vòng, bản nháp không bao giờ bung vì thiếu vị trí) ─────────
for (const [vao, mong] of [
  ["anh cần bán căn nhà hẻm xe hơi 5m Nguyễn Trãi phường 3 quận 5, 60m2, giá 7 tỷ 2", "hẻm xe hơi 5m Nguyễn Trãi"],
  ["gia đình cần tiền nên để lại căn nhà 4x16 hẻm xe hơi Trần Hưng Đạo quận 5, sổ hồng riêng", "hẻm xe hơi Trần Hưng Đạo"],
  ["em ơi nhà anh ở hẻm 102 Trần Bình Trọng phường 1 quận 5, bán 5 tỷ 3", "hẻm 102 Trần Bình Trọng"],
  ["bán nhà hxh Nguyễn Trãi p3 q5, 4x16, 1 trệt 2 lầu, shr, 9t5", "hxh Nguyễn Trãi"],
  ["Đường hồ ngọc lãm quận 8 phường 6", "Đường hồ ngọc lãm"],
  ["nhà mặt tiền đường An Dương Vương quận 5, 5x20", "đường An Dương Vương"],
  ["còn căn nữa: 7 Hồng Bàng phường 12, 80m2", "7 Hồng Bàng"],
  ["hẻm xe hơi 4m, 1 trệt 3 lầu, sổ hồng riêng, 4 phòng ngủ", null],
  ["bán đất nền Bến Lức Long An 5x20 đường nhựa 7m sổ riêng 850tr", null],
  ["nhà hẻm thông không ngập, 50m2", null],
  ["bán nhà q6 phường 2 40m2 3 tỷ 9", null],
]) ok("bocViTriRao " + JSON.stringify(vao.slice(0, 44)), bocViTriRao(vao) === mong, JSON.stringify(bocViTriRao(vao)));

console.log(hong ? `\nBÓC TÁCH 42 CA: ${hong}/${tong} CA HỎNG` : `\nBÓC TÁCH 42 CA: ${tong}/${tong} CA ĐẠT`);
process.exit(hong ? 1 : 0);
