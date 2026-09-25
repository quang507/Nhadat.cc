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
  dienCau(CAU_TIEN_DINH[khoa] ?? "", { ...o, ac: cachGoi, Ac: "Anh", web: "aioinhadat.vercel.app", ten: "R•ai" });

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
    // 17/09/2026: kiến thức thêm (AI đọc / chủ nhà nói lệch câu hỏi) → dòng "📝 Thêm", cũ trước, không lặp.
    { question: "bo_sung", answer: "gần chợ bình tây" },
    { question: "bo_sung", answer: "gần chợ Bình Tây" },
    { question: "bo_sung", answer: "khu an ninh" },
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
la("kiến thức thêm: dòng '📝 Thêm' gom mọi fact bo_sung, cũ trước, không lặp (17/09)", dongNha.some((d) => d === "📝 Thêm: khu an ninh · gần chợ Bình Tây"), dongNha.join(" | "));
la("có đủ khối thông số: diện tích, kết cấu, đường vào, hướng, pháp lý",
  /📐 Diện tích: 60m² · ngang 4m x dài 15m/.test(nha) && /🏗 Kết cấu: trệt \+ 2 lầu · 3 phòng ngủ · 2 WC/.test(nha) &&
  /🛣 Đường vào: hẻm xe hơi 5m/.test(nha) && /🧭 Hướng: Đông Nam/.test(nha) && /📜 Pháp lý: sổ hồng riêng, hoàn công/.test(nha), nha);
// 24/09/2026 (chủ dự án): bỏ "Khách quan tâm nhắn Zalo cho em để hẹn xem nhà" — lời hứa báo lại người rao, có tên
// trợ lý, đứng SAU CÙNG.
la("kết bằng điểm, câu hỏi duyệt, rồi SAU CÙNG '👉 … R•ai báo lại anh …'",
  /^Độ đầy đủ 82\/100, thêm /.test(dongNha.at(-3) ?? "") && /ổn chưa|được chưa/.test(dongNha.at(-2) ?? "") &&
  /^👉 Có khách quan tâm là R•ai báo lại anh liền ạ\.$/.test(dongNha.at(-1) ?? "") && !/hẹn xem nhà/.test(nha),
  dongNha.slice(-3).join(" | "));
la("thiếu tên trợ lý thì BỎ câu 👉, không in '{ten}' hay dòng rỗng",
  (() => { const t = soanTinNhap({ ...NHA_PHO, lai: false, cauTD: (k, o = {}) => dienCau(CAU_TIEN_DINH[k] ?? "", { ...o, ac: "anh", Ac: "Anh" }) });
    return !/👉|\{ten\}/.test(t) && !/\n\s*\n/.test(t); })());
la("KHÔNG đọc mã tin cho khách (FR-178)", !nha.includes("BDS-"), nha);
// FR-221 c (24/09/2026): chủ nói "đăng đi" và tin đã lên kệ → tiêu đề "lên kệ … rồi", KHÔNG còn câu hỏi duyệt.
{
  const daDang = soanTinNhap({ ...NHA_PHO, lai: false, cauTD, daDang: true }).split("\n");
  // (Gạch dài trong danh sách "thiếu" của DB được `boGachDai` lọc ở chỗ gửi đi — van-tra-loi.mjs kiểm.)
  la("tin ĐÃ ĐĂNG: tiêu đề 'lên kệ … rồi nha', không câu hỏi duyệt",
    /lên kệ .* rồi nha anh:$/.test(daDang[0]) && !daDang.some((d) => /ổn chưa|được chưa/.test(d)) &&
    // câu `dang_luon_cuoi` gửi ngay sau đã hứa báo lại — không lặp 👉 trong tin.
    !daDang.some((d) => /^👉/.test(d)),
    daDang[0] + " | " + daDang.at(-1));
}
la("không có dòng rỗng thừa", !/\n\s*\n/.test(nha));
// 24/09/2026 (chủ dự án: "Tiền thuê ghi vào"): tin BÁN đang cho thuê in tiền thuê (số đã đọc từ cột, không in câu chat) + hạn hợp đồng.
{
  const t = soanTinNhap({ ...NHA_PHO, l: { ...NHA_PHO.l, rent_income_vnd: 4e8 }, facts: [...NHA_PHO.facts, { question: "doanh_thu", answer: "Cái này bí mật nhé khoảng 400 triệu" }, { question: "han_hop_dong_thue", answer: "tới năm 2030 em" }], lai: false, cauTD });
  la("tin bán đang cho thuê: '💵 Đang cho thuê: 400 triệu/tháng · hợp đồng tới năm 2030', không in câu chat",
    /^💵 Đang cho thuê: 400 triệu\/tháng · hợp đồng tới năm 2030$/m.test(t) && !/bí mật/.test(t), t);
  la("tin chưa có tiền thuê: không có dòng 💵", !/💵/.test(nha));
  // 24/09/2026 (bắn 10 tin): khách nói "vi bằng", cột lưu giay_tay → in "vi bằng", không in "giấy tay".
  const vb = soanTinNhap({ ...NHA_PHO, l: { ...NHA_PHO.l, legal_status: "giay_tay" }, facts: [{ question: "phap_ly", answer: "vi bằng" }], lai: false, cauTD });
  la("vi bằng: tiêu đề + dòng pháp lý in 'vi bằng'", /, vi bằng, giá/.test(vb) && /📜 Pháp lý: vi bằng/.test(vb) && !/giấy tay/.test(vb), vb);
  const toa = soanTinNhap({ ...NHA_PHO, l: { ...NHA_PHO.l, property_type: "toa_nha", rent_income_vnd: 12e7 }, lai: false, cauTD });
  la("toà nhà: tiền thuê vào khối Khai thác ('thu 120 triệu/tháng'), không có dòng 💵 riêng", /🏢 Khai thác: .*thu 120 triệu\/tháng/.test(toa) && !/💵/.test(toa), toa);
}

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

// 25/09/2026 (chủ dự án test Zalo): "sang tên ngay và luôn" in thành "sang tên ngay và" — "và luôn" là thành ngữ.
{
  const tin = { ...NHA_PHO, facts: [...NHA_PHO.facts, { question: "bo_sung", answer: "sang tên ngay và luôn" }, { question: "bo_sung", answer: "để ở hay cho thuê đều được luôn em" }] };
  const them = dung(tin).split("\n").find((x) => x.startsWith("📝")) ?? "";
  la("VALUON-01 📝 Thêm giữ 'sang tên ngay và luôn', vẫn bỏ tiểu từ đuôi 'luôn em'", /sang tên ngay và luôn/.test(them) && /đều được(?! luôn)/.test(them), them);
}

// 25/09/2026 (chủ dự án "ko ghi trùng"): 📝 Thêm không in lại điều kết cấu / đường vào / sổ / nhãn đã có — lọc cả dữ liệu cũ.
{
  const tin = { ...NHA_PHO, l: { ...NHA_PHO.l, floors_text: "trệt + lửng + 2 lầu + sân thượng", alley_width_m: 3, access_type: "hem_xe_may", nhan: ["san_thuong", "gac_lung"] },
    facts: [...NHA_PHO.facts, { question: "do_rong_hem", answer: "3m" },
      { question: "bo_sung", answer: "sân thượng" }, { question: "bo_sung", answer: "xe hơi không vào được" },
      { question: "bo_sung", answer: "sổ hồng riêng" }, { question: "bo_sung", answer: "trần cao 4m thông suốt" }] };
  const them = dung(tin).split("\n").find((x) => x.startsWith("📝")) ?? "";
  la("TRUNG-01 📝 Thêm bỏ 'sân thượng', 'xe hơi không vào được', 'sổ hồng riêng' (ô đã có), giữ 'trần cao 4m thông suốt'",
    !/sân thượng|xe hơi không vào|sổ hồng riêng/.test(them) && /trần cao 4m thông suốt/.test(them), them);
  const nhanDong = dung(tin).split("\n").find((x) => x.startsWith("🏷")) ?? "";
  const tinNhan = { ...tin, l: { ...tin.l, nhan: ["san_thuong", "gac_lung", "yen_tinh"] }, facts: [...tin.facts, { question: "bo_sung", answer: "khu yên tĩnh" }, { question: "bo_sung", answer: "khu an ninh" }] };
  const them3 = dung(tinNhan).split("\n").find((x) => x.startsWith("📝")) ?? "";
  la("TRUNG-03 📝 Thêm bỏ 'khu yên tĩnh' (tin mang nhãn yên tĩnh), giữ 'khu an ninh' (tin chưa có nhãn an ninh)", !/yên tĩnh/.test(them3) && /khu an ninh/.test(them3), them3);
  la("TRUNG-02 🏷 Nhãn không in lặp 'sân thượng' / 'có gác lửng' khi dòng kết cấu đã có", !/sân thượng|lửng/.test(nhanDong), nhanDong || "(không có dòng nhãn)");
}

console.log(`\n${dat} đạt · ${hong} hỏng`);
if (hong) { console.log("\x1b[31mBẢN NHÁP TIN RAO HỎNG\x1b[0m"); process.exitCode = 1; }
else console.log("\x1b[32mBẢN NHÁP TIN RAO ĐẠT\x1b[0m");
