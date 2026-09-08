// fr177-hoi-nhu-moi-gioi-gioi.mjs — bài kiểm tầng tiền định FR-177:
//   nhanDienFact  — câu lệch đang nói fact NÀO (hỏi một đường, trả lời một nẻo → vẫn ghi)
//   chonCauKe     — câu kế bám theo điều chủ nhà vừa nói, trong nhóm ưu tiên cao nhất
//   laDongY       — chủ nhà gật bản nháp (AGREE_RULES, bản không model)
// Chạy: bun bot/tests/fr177-hoi-nhu-moi-gioi-gioi.mjs
import {
  chonCauKe, laDongY, nhanDienFact, phanLoaiCauTraLoi,
} from "../supabase/functions/_shared/extraction/khop-cau-tra-loi.ts";

let hong = 0, tong = 0;
const ok = (ten, dat, chiTiet = "") => { tong++; if (!dat) { hong++; console.log(`✗ ${ten}\n     → ${chiTiet}`); } else console.log(`✓ ${ten}`); };

// ── nhanDienFact ─────────────────────────────────────────────────────────────
const ND = [
  // [câu, fact mong đợi | null, đáp án mong đợi (regex) | undefined]
  ["sổ hồng riêng rồi em", "phap_ly"],
  ["đã hoàn công", "phap_ly"],
  ["hẻm 4m xe hơi vào được", "do_rong_hem", /4m/],
  ["hẻm xe hơi", "do_rong_hem"],
  ["Ngang 5", "mat_tien", /^5m$/],
  ["mặt tiền 4,5m", "mat_tien", /^4,5m$/],
  ["80m2", "dien_tich", /80m2/],
  ["5x16", "dien_tich", /5x16/],
  ["5 tỷ 8", "gia", /5 ty 8/],
  ["5 tỏi rưỡi", "gia", /5 toi ruoi/],
  ["3 lầu 4 phòng ngủ", "ket_cau"],
  ["1 trệt 2 lầu", "ket_cau"],
  ["4 phòng ngủ", "so_phong_ngu", /^4$/],
  ["phường 5", "phuong", /^Phường 5$/],
  ["p12", "phuong", /^Phường 12$/],
  ["xây 2015", "nam_xay", /^2015$/],
  ["hướng đông nam", "huong"],
  ["không dính quy hoạch", "quy_hoach"],
  ["để ở hay kinh doanh đều được", "tiem_nang"],
  ["16m nha", null],           // số trần, không nhãn → bo_sung
  ["nhà nở hậu chút", null],
  ["ok", null],
  ["Kêu chị nha", null],
];
for (const [cau, fact, re] of ND) {
  const k = nhanDienFact(cau);
  ok(`nhanDienFact "${cau}" → ${fact ?? "không nhận"}`,
    (k?.question ?? null) === fact && (!re || re.test(k?.answer ?? "")), JSON.stringify(k));
}

// ── phanLoaiCauTraLoi: câu lệch trỏ sang fact khác ────────────────────────────
const LECH = [
  ["ket_cau", "sổ hồng riêng rồi em", "phap_ly"],
  ["nam_xay", "5 tỷ", "gia"],
  ["phap_ly", "hẻm 4m xe hơi vào được", "do_rong_hem"],
  ["gia", "ngang 5", "mat_tien"],
  ["phap_ly", "phường 5", "phuong"],
  ["huong", "16m nha", undefined],
  ["dien_tich_dat", "80m2", undefined], // khớp, không lệch
];
for (const [q, cau, sang] of LECH) {
  const k = phanLoaiCauTraLoi(q, cau);
  ok(`hỏi ${q}, nhắn "${cau}" → ${sang ? `lệch, ghi sang ${sang}` : k.loai === "khop" ? "khớp" : "lệch, không nhận ra"}`,
    sang ? k.loai === "lech" && k.chuyenSang?.question === sang : k.chuyenSang === undefined, JSON.stringify(k));
}
ok("hinh_anh: 'chiều gửi em' KHÔNG đóng câu ảnh", phanLoaiCauTraLoi("hinh_anh", "chiều gửi em").loai === "lech");
ok("hinh_anh: 'không có ảnh' là câu trả lời", phanLoaiCauTraLoi("hinh_anh", "không có ảnh em").loai === "khop");

// ── chonCauKe ────────────────────────────────────────────────────────────────
const CB = (k) => ({ fact_key: k, nhom: "co_ban" });
const CM = (k) => ({ fact_key: k, nhom: "chuyen_mon" });
ok("nghe 'ngang 5' (mat_tien) → hỏi diện tích, không hỏi phường trước",
  chonCauKe(["mat_tien"], [CB("phuong"), CB("dien_tich_dat"), CB("gia")]) === "dien_tich_dat");
ok("nghe diện tích → hỏi giá", chonCauKe(["dien_tich"], [CB("phuong"), CB("gia")]) === "gia");
ok("nghe '3 lầu' (ket_cau) → hỏi phòng ngủ trước pháp lý",
  chonCauKe(["ket_cau"], [CM("phap_ly"), CM("so_phong_ngu")]) === "so_phong_ngu");
ok("nghe hẻm → hỏi kết cấu", chonCauKe(["do_rong_hem"], [CM("phap_ly"), CM("ket_cau")]) === "ket_cau");
ok("còn thiếu cơ bản thì KHÔNG nhảy sang chuyên môn dù liên quan",
  chonCauKe(["do_rong_hem"], [CB("gia"), CM("ket_cau")]) === "gia");
ok("không liên quan gì → câu đầu theo priority", chonCauKe(["gia"], [CM("do_rong_hem"), CM("phap_ly")]) === "do_rong_hem");
ok("view cũ không có cột nhom → tra bảng NHOM_FACT", chonCauKe(["mat_tien"], [{ fact_key: "phuong" }, { fact_key: "dien_tich" }]) === "dien_tich");
ok("hết câu → undefined", chonCauKe(["gia"], []) === undefined);

// ── laDongY ──────────────────────────────────────────────────────────────────
for (const s of ["ok", "ok em", "được đó", "đăng đi", "ừ", "vậy đi", "chốt", "👍", "❤️", "[sticker cảm xúc]", "ok nha em, đăng luôn", "Được rồi đăng đi em", "dạ được", "oke"]) {
  ok(`gật: "${s}"`, laDongY(s) === true);
}
for (const s of ["không, sửa giá lại", "sai rồi", "5 tỷ", "ok nhưng sửa giá", "chưa được", "thêm cái hẻm vào", "phí sao em?", "để coi", ""]) {
  ok(`không gật: "${s}"`, laDongY(s) === false);
}

console.log(hong ? `\nFR-177: ${hong}/${tong} CA HỎNG` : `\nFR-177: ${tong}/${tong} CA ĐẠT`);
process.exit(hong ? 1 : 0);
