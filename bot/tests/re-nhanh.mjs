// re-nhanh.mjs — FR-223: bảng rẽ nhánh câu hỏi theo câu trả lời (extraction/re-nhanh.ts). Chạy: bun bot/tests/re-nhanh.mjs
import { reNhanh, apReNhanh, RE_NHANH, nhanhCuaKhoa } from "../supabase/functions/_shared/extraction/re-nhanh.ts";
import { chonCauKe } from "../supabase/functions/_shared/extraction/khop-cau-tra-loi.ts";
import { CAU_HOI_MAU, FACT_LABELS } from "../supabase/functions/_shared/prompts.ts";
let tong = 0, hong = 0;
const ok = (ten, dat, chi = "") => { tong++; if (!dat) hong++; console.log(`${dat ? "✓" : "✗"} ${ten}${dat ? "" : `  → ${chi}`}`); };
const f = (q, a) => ({ question: q, answer: a });
const keys = (r) => r.them.map((t) => t.fact_key);

let r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [f("phap_ly", "sổ hồng riêng")] });
ok("nhà phố + 'sổ hồng riêng' → hỏi hoàn công", keys(r).includes("hoan_cong"), JSON.stringify(r));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [f("phap_ly", "sổ hồng riêng, hoàn công đủ")] });
ok("đã nói 'hoàn công đủ' → KHÔNG hỏi hoàn công", !keys(r).includes("hoan_cong"), JSON.stringify(r));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [f("phap_ly", "sổ hồng riêng"), f("hien_trang", "đang cho Sacombank thuê")] });
ok("sổ riêng + đang cho thuê → KHÔNG hỏi hoàn công, bỏ hiện trạng + nội thất", !keys(r).includes("hoan_cong") && r.bo.has("hien_trang") && r.bo.has("noi_that"), JSON.stringify({ ...r, bo: [...r.bo] }));
// 24/09/2026 (chủ dự án, tin 152 Trần Đình Xu): đang cho thuê / kinh doanh LÀ tiềm năng sử dụng — không hỏi lại.
ok("đang cho thuê → bỏ câu tiềm năng sử dụng", r.bo.has("tiem_nang"), JSON.stringify([...r.bo]));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [f("bo_sung", "tầng 1 và 2 để kinh doanh đang cho techcombank thuê")] });
ok("'tầng 1 và 2 để kinh doanh đang cho techcombank thuê' → nhánh đang cho thuê, bỏ tiềm năng", r.bo.has("tiem_nang"), JSON.stringify([...r.bo]));
ok("đang cho thuê chưa nói hạn hợp đồng, chưa nói tiền thuê → hỏi hạn hợp đồng rồi tiền thuê", keys(r).join() === "han_hop_dong_thue,doanh_thu", JSON.stringify(r));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [f("hien_trang", "đang cho thuê 30 triệu/tháng")] });
ok("'đang cho thuê 30 triệu/tháng' → không hỏi lại tiền thuê", !keys(r).includes("doanh_thu"), JSON.stringify(r));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [f("_mo_ta", "bán nhà mặt tiền, đang cho ngân hàng thuê, giá 25 tỷ"), f("han_hop_dong_thue", "tới năm 2030 em")] }, ["han_hop_dong_thue"]);
ok("'cho ngân hàng thuê, giá 25 tỷ' KHÔNG phải tiền thuê → trả lời hạn hợp đồng xong thì hỏi tiền thuê (bắn thật 24/09 rn-test-g)", keys(r).join() === "doanh_thu", JSON.stringify(r));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [f("kien_thuc", "hợp đồng thuê Sacombank đến năm 2031")] });
ok("đã nói 'đến năm 2031' → KHÔNG hỏi hạn hợp đồng", !keys(r).includes("han_hop_dong_thue"), JSON.stringify(r));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [f("_mo_ta", "bán nhà mặt tiền Nguyễn Trãi, đang cho ngân hàng thuê, giá 25 tỷ"), f("phap_ly", "sổ hồng riêng")] });
ok("câu RAO gốc 'đang cho ngân hàng thuê' (không có fact) → nhánh đang cho thuê, KHÔNG hỏi hoàn công (bắn thật 24/09)", !keys(r).includes("hoan_cong") && r.bo.has("hoan_cong") && keys(r).includes("han_hop_dong_thue"), JSON.stringify({ ...r, bo: [...r.bo] }));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [], rent_income_vnd: 150000000 });
ok("cột thu nhập thuê có số → coi là đang cho thuê", r.bo.has("hien_trang"), JSON.stringify({ ...r, bo: [...r.bo] }));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [f("phap_ly", "chưa có sổ, hợp đồng mua bán")] });
ok("'chưa có sổ, HĐMB' → đã biết giấy tờ (HĐMB) nên chỉ hỏi bao giờ ra sổ, không hỏi hoàn công", keys(r).join() === "du_kien_ra_so" && !keys(r).includes("hoan_cong"), JSON.stringify(r));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [f("phap_ly", "chưa có sổ em")] });
ok("'chưa có sổ' trống trơn → hai ý chính theo thứ tự: giấy tờ đang có, rồi bao giờ ra sổ", keys(r).join() === "giay_to_hien_co,du_kien_ra_so", JSON.stringify(r));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [f("phap_ly", "chưa có sổ, hợp đồng mua bán, cuối năm nay ra sổ")] });
ok("nói đủ cả hai ý → nhánh chưa sổ không hỏi gì thêm", keys(r).length === 0, JSON.stringify(r));
r = reNhanh({ loai: "chung_cu", deal: "ban", facts: [f("phap_ly", "đang chờ sổ")] });
ok("căn hộ chờ sổ → hỏi giấy tờ, bao giờ ra sổ, đã nhận bàn giao chưa", ["giay_to_hien_co", "du_kien_ra_so", "ban_giao"].every((k) => keys(r).includes(k)), JSON.stringify(r));
r = reNhanh({ loai: "chung_cu", deal: "ban", facts: [f("phap_ly", "sổ hồng riêng")] });
ok("căn hộ sổ hồng riêng → KHÔNG hỏi hoàn công (không phải nhà tự xây)", !keys(r).includes("hoan_cong"), JSON.stringify(r));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [f("phap_ly", "sổ chung với anh trai")] });
ok("'sổ chung với anh trai' → đã biết chung với ai, chỉ hỏi các bên đồng ý bán chưa; không hỏi hoàn công", keys(r).join() === "dong_y_ban", JSON.stringify(r));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [f("phap_ly", "sổ chung")] });
ok("'sổ chung' → hỏi đứng tên chung với ai trước", keys(r)[0] === "dong_so_huu_voi", JSON.stringify(r));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [f("hien_trang", "nhà nát, mua đất tặng nhà")] });
ok("nhà nát → bỏ phòng ngủ, toilet, nội thất", r.bo.has("so_phong_ngu") && r.bo.has("so_wc") && r.bo.has("noi_that"), JSON.stringify([...r.bo]));
r = reNhanh({ loai: "dat", deal: "ban", facts: [f("tho_cu", "100m2 thổ cư")] });
ok("đất thổ cư một phần → hỏi lên thổ cư", keys(r).includes("len_tho_cu"), JSON.stringify(r));
r = reNhanh({ loai: "dat", deal: "ban", facts: [f("tho_cu", "full thổ cư")] });
ok("đất full thổ cư → KHÔNG hỏi lên thổ cư", !keys(r).includes("len_tho_cu"), JSON.stringify(r));
r = reNhanh({ loai: "nha_pho", deal: "cho_thue", facts: [f("phap_ly", "sổ hồng riêng")] });
ok("tin CHO THUÊ sổ riêng → KHÔNG hỏi hoàn công", !keys(r).includes("hoan_cong"), JSON.stringify(r));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [f("phap_ly", "sổ hồng riêng"), f("hoan_cong", "rồi em")] });
ok("đã trả lời câu hoàn công → không thêm lại", !keys(r).includes("hoan_cong"), JSON.stringify(r));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [], legal_status: "so_hong_rieng" });
ok("cột legal_status 'so_hong_rieng' (bóc từ câu rao) cũng tính là sổ riêng", keys(r).includes("hoan_cong"), JSON.stringify(r));

// Chọn câu kế: vừa trả lời pháp lý "sổ hồng riêng" → câu kế là hoàn công, trước phường / ảnh.
const thieu = [{ fact_key: "phuong", priority: 17, nhom: "co_ban" }, { fact_key: "hinh_anh", priority: 19, nhom: "co_ban" }];
const ds = apReNhanh(thieu, { loai: "nha_pho", deal: "ban", facts: [f("phap_ly", "sổ hồng riêng")] }, ["phap_ly"]);
ok("chonCauKe sau 'sổ hồng riêng' → hoan_cong", chonCauKe(["phap_ly"], ds) === "hoan_cong", JSON.stringify(ds));
const ds5 = apReNhanh([{ fact_key: "phuong", priority: 17, nhom: "co_ban" }], { loai: "nha_pho", deal: "ban", facts: [f("phap_ly", "chưa có sổ"), f("giay_to_hien_co", "vi bằng")] }, ["giay_to_hien_co"]);
ok("vừa trả lời một ý của nhánh (giấy tờ) → hỏi tiếp ý còn thiếu của nhánh (bao giờ ra sổ)", chonCauKe(["giay_to_hien_co"], ds5) === "du_kien_ra_so", JSON.stringify(ds5));
const ds2 = apReNhanh([{ fact_key: "hien_trang", priority: 4, nhom: "co_ban" }, { fact_key: "phuong", priority: 17, nhom: "co_ban" }],
  { loai: "nha_cap4", deal: "ban", facts: [f("hien_trang", "đang cho thuê 20 triệu/tháng")] });
const ds3 = apReNhanh([{ fact_key: "ket_cau", priority: 4, nhom: "co_ban" }], { loai: "nha_pho", deal: "ban", facts: [f("phap_ly", "sổ hồng riêng")] }, ["gia"]);
ok("câu nhánh CHỈ hỏi ngay sau câu kích (vừa trả lời giá thì không chen hoàn công)", !ds3.some((x) => x.fact_key === "hoan_cong"), JSON.stringify(ds3));
const ds4 = apReNhanh([{ fact_key: "ket_cau", priority: 4, nhom: "co_ban" }], { loai: "nha_pho", deal: "ban", facts: [f("phap_ly", "sổ hồng riêng")] }, ["phap_ly"]);
ok("vừa trả lời pháp lý → hoàn công đứng ĐẦU, trước cả câu cơ bản còn thiếu", chonCauKe(["phap_ly"], ds4) === "hoan_cong", JSON.stringify(ds4));
ok("apReNhanh bỏ hiện trạng khỏi danh sách khi đang cho thuê", !ds2.some((x) => x.fact_key === "hien_trang"), JSON.stringify(ds2));

ok("nhanhCuaKhoa('du_kien_ra_so') → nhánh 'chưa có sổ' với 2 ý", nhanhCuaKhoa("du_kien_ra_so")?.ten === "chưa có sổ" && nhanhCuaKhoa("du_kien_ra_so")?.cacY.length === 2, JSON.stringify(nhanhCuaKhoa("du_kien_ra_so")));
// Mọi câu nhánh phải có câu mẫu + nhãn (không thì bot đọc tên trường cho khách).
const moiKhoa = [...new Set(RE_NHANH.flatMap((l) => (l.them ?? []).map((t) => t.fact_key)))];
for (const k of moiKhoa) ok(`câu nhánh '${k}' có câu mẫu + nhãn`, (!!CAU_HOI_MAU[k] || !!CAU_HOI_MAU[`${k}@nha_pho`]) && !!FACT_LABELS[k], k);

console.log(hong ? `\nRẼ NHÁNH: ${hong}/${tong} CA HỎNG` : `\nRẼ NHÁNH: ${tong}/${tong} CA ĐẠT`);
process.exit(hong ? 1 : 0);
