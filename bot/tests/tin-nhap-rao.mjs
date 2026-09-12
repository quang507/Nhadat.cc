// tin-nhap-rao.mjs — BẢN NHÁP TIN RAO phải đọc như một tin rao thật (mẫu tin lẻ
// mogi.vn). Tiền định: không mạng, không DB, không model.
//   bun bot/tests/tin-nhap-rao.mjs         # kiểm
//   bun bot/tests/tin-nhap-rao.mjs --in    # in cả ba bản nháp mẫu để đọc bằng mắt
//
// Ba mẫu dưới đây là ba hình dạng hay gặp nhất của rổ hàng: nhà phố hẻm xe hơi
// (đủ thông số), căn hộ CHO THUÊ (điều kiện thuê), và đất (chỉ có vài dòng).
import { soanTinNhap, tieuDeTin } from "../supabase/functions/_shared/tin-nhap.ts";
import { CAU_TIEN_DINH, dienCau } from "../supabase/functions/_shared/prompts.ts";

const cachGoi = "anh";
const cauTD = (khoa, o = {}) =>
  dienCau(CAU_TIEN_DINH[khoa] ?? "", { ...o, ac: cachGoi, Ac: "Anh", web: "aioinhadat.vercel.app" });

const NHA_PHO = {
  l: {
    code: "BDS-NP-Q5-0016", property_type: "nha_pho", deal: "ban",
    location_raw: "hẻm 5m Nguyễn Trãi", ward: "Phường 3", district: "Quận 5",
    area_m2: 60, price_raw: "7 tỷ 2", bedrooms: 3, bathrooms: 2,
    floors: 3, floors_text: "trệt + 2 lầu", frontage_m: 4, length_m: 15,
    access_type: "hem_xe_hoi", alley_width_m: 5,
    legal_status: "so_hong_rieng", has_completion: true, direction: "Đông Nam",
    negotiable: true, gap: false,
  },
  facts: [
    { question: "tiem_nang", answer: "ở hoặc cho thuê" },
    { question: "tien_ich_gan", answer: "gần chợ An Đông, trường Hùng Vương" },
    { question: "hien_trang", answer: "nhà mới sửa 2024" },
  ],
  diem: 82, thieu: ["vài tấm ảnh (nhà, sổ, hẻm — ảnh nào cũng được)"], soAnh: 0,
};

const CAN_HO_THUE = {
  l: {
    code: "BDS-CH-Q7-0003", property_type: "chung_cu", deal: "cho_thue",
    location_raw: "Sunrise City, đường Nguyễn Hữu Thọ", ward: "Phường Tân Hưng", district: "Quận 7",
    area_m2: 76, price_raw: "18 triệu", bedrooms: 2, bathrooms: 2, floor: 15,
    furnishing: "full nội thất", legal_status: null, negotiable: false,
  },
  facts: [
    { question: "tien_coc", answer: "cọc 2 tháng" },
    { question: "thoi_han_thue", answer: "1 năm" },
    { question: "phi_quan_ly", answer: "14 nghìn/m2" },
    { question: "view", answer: "view sông" },
  ],
  diem: 74, thieu: ["vài tấm ảnh (nhà, sổ, hẻm — ảnh nào cũng được)"], soAnh: 2,
};

const DAT = {
  l: {
    code: "BDS-DAT-CUCHI-0001", property_type: "dat", deal: "ban",
    location_raw: null, ward: null, district: "Huyện Củ Chi",
    area_m2: 100, price_raw: "900tr", gap: true,
  },
  facts: [{ question: "tho_cu", answer: "100m2" }],
  diem: 47, thieu: ["chiều ngang mặt tiền", "pháp lý (sổ hồng riêng/chung, hoàn công)"], soAnh: 0,
};

const dung = (m, lai = false) => soanTinNhap({ ...m, lai, cauTD });
const fact = (m) => (k) => m.facts.find((f) => f.question === k)?.answer ?? null;

if (process.argv.includes("--in")) {
  for (const m of [NHA_PHO, CAN_HO_THUE, DAT]) {
    console.log("═".repeat(76));
    console.log(dung(m));
    console.log();
  }
  process.exit(0);
}

let dat = 0, hong = 0;
const la = (ten, ok, chiTiet = "") => {
  if (ok) { dat++; console.log(`\x1b[32m✓\x1b[0m ${ten}`); }
  else { hong++; console.log(`\x1b[31m✗\x1b[0m ${ten}${chiTiet ? "\n    " + chiTiet : ""}`); }
};

console.log("BẢN NHÁP TIN RAO — đọc như tin lẻ trên mogi\n");

const tdNha = tieuDeTin(NHA_PHO.l, fact(NHA_PHO));
la("tiêu đề nhà phố: cụm tách bằng dấu phẩy — chỗ nào, bao nhiêu m², nhà thế nào, giấy tờ, KẾT bằng giá",
  /^Bán nhà hẻm xe hơi 5m Nguyễn Trãi P\.3 Q\.5, 60m², trệt \+ 2 lầu, 3PN, SHR, giá 7 tỷ 2$/.test(tdNha), tdNha);
la("tiêu đề KHÔNG lặp 'hẻm 5m' hai lần", (tdNha.match(/hẻm/gi) ?? []).length === 1, tdNha);
la("tiêu đề ≤ 120 ký tự", tdNha.length <= 120, `${tdNha.length} ký tự`);

const tdThue = tieuDeTin(CAN_HO_THUE.l, fact(CAN_HO_THUE));
la("tiêu đề cho thuê: mở bằng 'Cho thuê căn hộ', giá kèm '/tháng'",
  /^Cho thuê căn hộ/.test(tdThue) && /giá 18 triệu\/tháng$/.test(tdThue), tdThue);

const tdDat = tieuDeTin(DAT.l, fact(DAT));
la("tin thiếu đường/kết cấu vẫn ra tiêu đề gọn, có 'cần bán gấp'",
  /^Bán đất Huyện Củ Chi, 100m², cần bán gấp, giá 900tr$/.test(tdDat), tdDat);

const nha = dung(NHA_PHO);
const dongNha = nha.split("\n");
la("dòng 1 câu mở (KHÔNG kèm điểm), dòng 2 TIÊU ĐỀ, dòng 3 địa chỉ 📍 viết HOA, dòng 4 GIÁ 💰",
  /^📋 Em đăng tin như vầy nha anh:$/.test(dongNha[0]) && dongNha[1] === tdNha && /^📍 Hẻm 5m Nguyễn Trãi/.test(dongNha[2]) && /^💰 /.test(dongNha[3]),
  dongNha.slice(0, 4).join(" | "));
la("giá có '(còn thương lượng)' khi cột negotiable = true", /^💰 7 tỷ 2 \(còn thương lượng\)$/.test(dongNha[3]), dongNha[3]);
la("có đủ khối thông số: diện tích, kết cấu, đường vào, hướng, pháp lý",
  /📐 Diện tích: 60m² · ngang 4m x dài 15m/.test(nha) && /🏗 Kết cấu: trệt \+ 2 lầu · 3 phòng ngủ · 2 WC/.test(nha) &&
  /🛣 Đường vào: hẻm xe hơi 5m/.test(nha) && /🧭 Hướng: Đông Nam/.test(nha) && /📜 Pháp lý: sổ hồng riêng, hoàn công/.test(nha), nha);
la("kết bằng lời mời liên hệ rồi câu hỏi duyệt",
  /👉 /.test(dongNha.at(-3) ?? "") && /^Độ đầy đủ 82\/100 — thêm /.test(dongNha.at(-2) ?? "") && /ổn chưa|được chưa/.test(dongNha.at(-1) ?? ""),
  dongNha.slice(-3).join(" | "));
la("KHÔNG đọc mã tin cho khách (FR-178)", !nha.includes("BDS-"), nha);
la("không có dòng rỗng thừa", !/\n\s*\n/.test(nha));

const thue = dung(CAN_HO_THUE);
la("cho thuê: giá kèm '/tháng', có khối điều kiện thuê, có ảnh",
  /💰 18 triệu\/tháng \(giá cố định\)/.test(thue) && /📝 Điều kiện thuê: cọc 2 tháng · thuê tối thiểu 1 năm · phí QL 14 nghìn\/m2/.test(thue) &&
  /📷 2 ảnh/.test(thue), thue);
la("cho thuê: tầng 15 và nội thất vào đúng khối kết cấu / nội thất",
  /🏗 Kết cấu: tầng 15 · 2 phòng ngủ · 2 WC · view sông/.test(thue) && /🛋 Nội thất: full nội thất/.test(thue), thue);

const datNhap = dung(DAT);
la("tin nghèo thông tin: chỉ có mấy dòng, không bịa dòng nào",
  datNhap.split("\n").length <= 8 && !/🏗|🧭|📜/.test(datNhap), datNhap);
la("gửi lại sau khi sửa thì câu cuối đổi", /Em sửa lại rồi/.test(dung(NHA_PHO, true)), dung(NHA_PHO, true).split("\n").at(-1));

console.log(`\n${dat} đạt · ${hong} hỏng`);
if (hong) { console.log("\x1b[31mBẢN NHÁP TIN RAO HỎNG\x1b[0m"); process.exitCode = 1; }
else console.log("\x1b[32mBẢN NHÁP TIN RAO ĐẠT\x1b[0m");
