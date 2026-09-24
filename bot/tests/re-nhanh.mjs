// re-nhanh.mjs — FR-223: bảng rẽ nhánh câu hỏi theo câu trả lời (extraction/re-nhanh.ts). Chạy: bun bot/tests/re-nhanh.mjs
import { reNhanh, apReNhanh, RE_NHANH } from "../supabase/functions/_shared/extraction/re-nhanh.ts";
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
ok("đang cho thuê chưa nói hạn hợp đồng → hỏi hạn hợp đồng", keys(r).includes("han_hop_dong_thue"), JSON.stringify(r));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [f("kien_thuc", "hợp đồng thuê Sacombank đến năm 2031")] });
ok("đã nói 'đến năm 2031' → KHÔNG hỏi hạn hợp đồng", !keys(r).includes("han_hop_dong_thue"), JSON.stringify(r));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [], rent_income_vnd: 150000000 });
ok("cột thu nhập thuê có số → coi là đang cho thuê", r.bo.has("hien_trang"), JSON.stringify({ ...r, bo: [...r.bo] }));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [f("phap_ly", "chưa có sổ, hợp đồng mua bán")] });
ok("'chưa có sổ, HĐMB' → hỏi giấy tờ + bao giờ ra sổ, không hỏi hoàn công", keys(r).includes("tien_do_so") && !keys(r).includes("hoan_cong"), JSON.stringify(r));
r = reNhanh({ loai: "chung_cu", deal: "ban", facts: [f("phap_ly", "đang chờ sổ")] });
ok("căn hộ chờ sổ → hỏi bàn giao + tiến độ sổ", keys(r).includes("ban_giao") && keys(r).includes("tien_do_so"), JSON.stringify(r));
r = reNhanh({ loai: "chung_cu", deal: "ban", facts: [f("phap_ly", "sổ hồng riêng")] });
ok("căn hộ sổ hồng riêng → KHÔNG hỏi hoàn công (không phải nhà tự xây)", !keys(r).includes("hoan_cong"), JSON.stringify(r));
r = reNhanh({ loai: "nha_pho", deal: "ban", facts: [f("phap_ly", "sổ chung với anh trai")] });
ok("sổ chung → hỏi đồng sở hữu, không hỏi hoàn công", keys(r).includes("dong_so_huu") && !keys(r).includes("hoan_cong"), JSON.stringify(r));
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
const ds2 = apReNhanh([{ fact_key: "hien_trang", priority: 4, nhom: "co_ban" }, { fact_key: "phuong", priority: 17, nhom: "co_ban" }],
  { loai: "nha_cap4", deal: "ban", facts: [f("hien_trang", "đang cho thuê 20 triệu/tháng")] });
const ds3 = apReNhanh([{ fact_key: "ket_cau", priority: 4, nhom: "co_ban" }], { loai: "nha_pho", deal: "ban", facts: [f("phap_ly", "sổ hồng riêng")] }, ["gia"]);
ok("câu nhánh CHỈ hỏi ngay sau câu kích (vừa trả lời giá thì không chen hoàn công)", !ds3.some((x) => x.fact_key === "hoan_cong"), JSON.stringify(ds3));
const ds4 = apReNhanh([{ fact_key: "ket_cau", priority: 4, nhom: "co_ban" }], { loai: "nha_pho", deal: "ban", facts: [f("phap_ly", "sổ hồng riêng")] }, ["phap_ly"]);
ok("vừa trả lời pháp lý → hoàn công đứng ĐẦU, trước cả câu cơ bản còn thiếu", chonCauKe(["phap_ly"], ds4) === "hoan_cong", JSON.stringify(ds4));
ok("apReNhanh bỏ hiện trạng khỏi danh sách khi đang cho thuê", !ds2.some((x) => x.fact_key === "hien_trang"), JSON.stringify(ds2));

// Mọi câu nhánh phải có câu mẫu + nhãn (không thì bot đọc tên trường cho khách).
const moiKhoa = [...new Set(RE_NHANH.flatMap((l) => (l.them ?? []).map((t) => t.fact_key)))];
for (const k of moiKhoa) ok(`câu nhánh '${k}' có câu mẫu + nhãn`, !!CAU_HOI_MAU[k] && !!FACT_LABELS[k], k);

console.log(hong ? `\nRẼ NHÁNH: ${hong}/${tong} CA HỎNG` : `\nRẼ NHÁNH: ${tong}/${tong} CA ĐẠT`);
process.exit(hong ? 1 : 0);
