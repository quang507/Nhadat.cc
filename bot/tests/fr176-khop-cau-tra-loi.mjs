// fr176-khop-cau-tra-loi.mjs — bài kiểm tầng tiền định "câu chủ nhà nhắn có
// phải câu trả lời không" (FR-176). Chạy bằng bun (import thẳng .ts):
//   bun bot/tests/fr176-khop-cau-tra-loi.mjs
// Mỗi dòng dưới là một câu THẬT hoặc gần thật từ log 07/09/2026. Thêm ca khi
// bắt được một câu bot ghi sai chỗ ngoài đời — đó là cách file này lớn lên.
import { batXungHo, phanLoaiCauTraLoi } from "../supabase/functions/_shared/extraction/khop-cau-tra-loi.ts";

const CA = [
  // [câu hỏi đang treo, câu chủ nhà nhắn, loại mong đợi, kiểm thêm]
  ["phap_ly", "Kêu chị nha", "xung_ho", (k) => k.xungHo === "chị"],
  ["phap_ly", "gọi anh đi em", "xung_ho", (k) => k.xungHo === "anh"],
  ["phap_ly", "chị nha", "xung_ho", (k) => k.xungHo === "chị"],
  ["phap_ly", "sổ hồng riêng rồi em", "khop"],
  ["phap_ly", "chị nha, sổ hồng riêng đã hoàn công", "khop", (k) => k.xungHo === "chị"],
  ["phap_ly", "16m nha", "lech"],
  ["phap_ly", "ok", "ack"],
  ["phap_ly", "để coi", "ack"],
  ["phap_ly", "phí bên em sao?", "hoi"],
  ["phap_ly", "chưa có sổ, đang làm", "khop"],
  ["huong", "16m nha", "lech"],
  ["huong", "đông nam", "khop"],
  ["huong", "hướng tây", "khop"],
  ["huong", "không rõ em ơi", "khop"],
  ["dien_tich_dat", "Ngang 5", "lech", (k) => k.chuyenSang?.question === "mat_tien" && k.chuyenSang?.answer === "5m"],
  ["dien_tich_dat", "ngang 4,5m", "lech", (k) => k.chuyenSang?.answer === "4,5m"],
  ["dien_tich_dat", "5x16", "khop"],
  ["dien_tich_dat", "5 x 16m", "khop"],
  ["dien_tich_dat", "80m2", "khop"],
  ["dien_tich_dat", "80", "khop"],
  ["dien_tich_dat", "ngang 5 dài 16", "khop"],
  ["dien_tich", "5 tỷ", "lech"],
  ["ket_cau", "5 tấm em", "khop"],
  ["ket_cau", "1 trệt 2 lầu", "khop"],
  ["ket_cau", "một trệt hai lầu", "khop"],
  ["ket_cau", "Kêu chị nha", "xung_ho"],
  ["nam_xay", "2015", "khop"],
  ["nam_xay", "không nhớ", "khop"],
  ["nam_xay", "5 tỷ", "lech"],
  ["gia", "5 tỷ 8", "khop"],
  ["gia", "5 tỏi rưỡi", "khop"],
  // 11/09/2026, lượt bắn 42 ca: câu xin dừng không phải câu trả lời; tên phường
  // bằng chữ phải ngắn và không có từ nói chuyện; số trần "4m" không đoán.
  ["phuong", "hỏi gì hỏi lắm vậy em, anh bận", "hoan"],
  ["vi_tri", "để anh hỏi vợ đã em", "hoan"],
  ["gap", "để anh bàn với vợ", "hoan"],
  ["phuong", "Nguyễn Cư Trinh", "khop"],
  ["phuong", "Bàn Cờ", "khop"],
  ["phuong", "phường 5 nha, anh bận", "khop"],
  ["vi_tri", "4m", "lech"],
  ["gia", "5 tỷ được không?", "hoi"],
  ["gia", "80m2", "lech"],
  ["quy_hoach", "không dính gì", "khop"],
  ["quy_hoach", "16m nha", "lech"],
  ["hien_trang", "nhà mới toanh, sơn lại năm ngoái", "khop"],
  ["hien_trang", "ừ", "ack"],
  // FR-176 / 20260907e: giá + phường giờ là câu hỏi thật.
  ["phuong", "phường 5", "khop"],
  ["phuong", "5", "khop"],
  ["phuong", "p4", "khop"],
  ["phuong", "Nguyễn Cư Trinh", "khop"],
  ["phuong", "ừ", "ack"],
  ["gia", "10 tỷ rưỡi", "khop"],
  ["gia", "kêu chị nha", "xung_ho"],
];

let hong = 0;
for (const [q, text, mong, them] of CA) {
  const kq = phanLoaiCauTraLoi(q, text);
  const ok = kq.loai === mong && (!them || them(kq));
  if (!ok) hong++;
  console.log(`${ok ? "✓" : "✗"} [${q}] "${text}" → ${kq.loai}${kq.xungHo ? ` (${kq.xungHo})` : ""}${kq.chuyenSang ? ` → ${kq.chuyenSang.question}=${kq.chuyenSang.answer}` : ""}${ok ? "" : `  MONG ${mong}`}`);
}
const xh = [["Kêu chị nha", "chị"], ["kêu anh", "anh"], ["sổ hồng riêng", null], ["em là chị", "chị"], ["anh chứ không phải chị", "anh"]];
for (const [t, mong] of xh) {
  const kq = batXungHo(t);
  const ok = kq === mong;
  if (!ok) hong++;
  console.log(`${ok ? "✓" : "✗"} xưng hô "${t}" → ${kq}${ok ? "" : `  MONG ${mong}`}`);
}
console.log(hong ? `\nFR-176: ${hong}/${CA.length + xh.length} CA HỎNG` : `\nFR-176: ${CA.length + xh.length}/${CA.length + xh.length} CA ĐẠT`);
process.exit(hong ? 1 : 0);
