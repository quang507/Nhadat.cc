#!/usr/bin/env bun
// luat-khong-mau-thuan.mjs — SRS-5.1zzzzj (09/10/2026). Chủ dự án: "luật nhỏ chỗ này chỗ kia thì được, nhưng CẢ BỘ luật không được
// mâu thuẫn nhau". Mỗi trường / mỗi đầu ra có MỘT chủ; luật khác chạm cùng chỗ phải nhường. Bài tĩnh + thuần (không mạng, không DB)
// đỏ khi hai luật kéo một chỗ về hai phía:
//   (1) Câu lệnh giọng dạy model điều lượt soát nhận xét (kiem-khen.ts) sẽ bỏ — ví dụ ĐÚNG có "khách chuộng / dễ bán / bán nhanh…".
//   (2) Ví dụ ĐÚNG trong câu lệnh nói CON SỐ phí — con số phí chỉ do `cauPhi(vaiPhi(…))` nói (prompts.ts).
//   (3) Lưới chặn phí và lưới bỏ nhận xét KHÔNG BAO GIỜ bỏ câu hỏi — câu hỏi là của `damBaoCauHoi` (không lưới nào được tháo nó).
//   (4) Chữ in (gạch dài / gạch chéo): TONE_RULES cấm, đường ra luôn chuẩn — không được gài lại theo `luat_loi_bot` (cấm mà không
//       chặn = hai chủ: prompt nói một đằng, đầu ra đi một nẻo).
//   (5) Cột phường: cửa chuẩn hoá (tenPhuongCot) và chặn lần cuối của DB (chuan_hoa_phuong, 20261009b) cùng một tập tên — chặn DB
//       không bao giờ xoá một giá trị cửa đã nhận (đo ở ghi-phuong-mot-cua.mjs: mọi đầu ra của cửa thuộc bảng wards).
//   (6) Hiển thị địa chỉ: ô nguyên văn (O_NGUYEN_VAN, kiem-bang-chung.ts) là chủ của chữ LƯU; `duongHienThi` là chủ của chữ IN — bản in
//       không bao giờ mang đuôi phường / quận chữ khách (phần đó chỉ từ cột chuẩn).
import { readFileSync } from "node:fs";
import { SELLER_FEWSHOT, BUYER_FEWSHOT, TONE_RULES, cauPhi, phanTramPhi, vaiPhi } from "../supabase/functions/_shared/prompts.ts";
import { boCauNhanXet, chanPhiChuaXacNhan } from "../supabase/functions/_shared/extraction/van-tra-loi.ts";
import { duongHienThi } from "../supabase/functions/_shared/extraction/hien-thi-dia-chi.ts";

let hong = 0;
const ok = (n, dk, ct = "") => { console.log(`${dk ? "✓" : "✗"} ${n}${dk ? "" : `\n    → ${ct}`}`); if (!dk) hong++; };

// (1) + (2): chỉ đọc câu ĐÁP trong phần ví dụ ĐÚNG (sau "→", trước "Ví dụ giọng SAI").
const viDuDung = (s) => s.split(/Ví dụ giọng SAI|Ví dụ SAI/)[0].split("\n").filter((d) => /→/.test(d)).map((d) => d.slice(d.indexOf("→") + 1));
const DOAN_NGUOI_MUA = /khách[^.?!]{0,20}chuộng|dễ bán|bán nhanh|đắt khách|thanh khoản\s+(?:rất\s+)?cao|nhiều người tìm/iu;
const sai1 = viDuDung(SELLER_FEWSHOT).filter((d) => DOAN_NGUOI_MUA.test(d));
ok("(1) ví dụ ĐÚNG của người bán không dạy lời đoán người mua / khả năng bán (kiem-khen bỏ câu đó)", sai1.length === 0, sai1.join(" | "));
const khen = TONE_RULES.match(/Khen là việc với NGƯỜI BÁN[^\n]*/u)?.[0] ?? "";
ok("(1) TONE_RULES: câu mẫu khen KHÔNG phải lời đoán người mua (chỉ lợi ích thật của đặc điểm)",
  !!khen && !/\("[^"]*(?:khách[^"]{0,20}chuộng|dễ bán)[^"]*"\);/u.test(khen.split("không đoán")[0] ?? khen), khen.slice(0, 200));
const sai2 = [...viDuDung(SELLER_FEWSHOT), ...viDuDung(BUYER_FEWSHOT)].filter((d) => /\d\s*%/.test(d) && /phí/iu.test(d));
ok("(2) ví dụ ĐÚNG không nói con số phí (chủ của con số phí là cauPhi(vaiPhi(…)))", sai2.length === 0, sai2.join(" | "));

// (3) không lưới nào tháo câu hỏi.
const loi = ["Dạ phí bên em 1% giá chốt ạ. Phí 1% vậy được không anh? Nhà mình mấy tầng ạ?"];
const ra = chanPhiChuaXacNhan(loi, null, cauPhi("unknown", "ban"));
ok("(3) chanPhiChuaXacNhan: thay câu khẳng định có % bằng câu cauPhi, GIỮ nguyên mọi câu hỏi",
  /mấy tầng ạ\?/.test(ra.join(" ")) && /Phí 1% vậy được không anh\?/.test(ra.join(" ")) && /mức tuỳ chính chủ hay môi giới/.test(ra.join(" ")) && !/1% giá chốt ạ\./.test(ra.join(" ")),
  JSON.stringify(ra));
const nx = boCauNhanXet("Dạ hẻm xe hơi là khách chuộng lắm anh. Nhà mình mấy tầng ạ?", ["hẻm xe hơi là khách chuộng lắm anh"]);
ok("(3) boCauNhanXet bỏ lời đoán người mua, GIỮ câu hỏi", nx === "Nhà mình mấy tầng ạ?" || /^Nhà mình mấy tầng ạ\?$/.test(nx ?? ""), String(nx));
// (2') vai đã xác nhận, số đúng → lưới không đụng; số sai → thay.
ok("(2') vai ccrb đã xác nhận nói 1% → giữ; nói 0,5% → thay bằng câu cauPhi(ccrb)",
  chanPhiChuaXacNhan(["Dạ phí 1% giá chốt ạ."], phanTramPhi(vaiPhi({ seller_type: "ccrb", seller_type_source: "tu_nhan" }), "ban"), "x")[0] === "Dạ phí 1% giá chốt ạ."
    && /1% giá chốt/.test(chanPhiChuaXacNhan(["Dạ phí 0,5% giá chốt ạ."], "1", cauPhi("ccrb", "ban"))[0]));
ok("(2') nhãn ĐOÁN (suy_doan) không được nói số; admin / tu_nhan được",
  vaiPhi({ seller_type: "ccrb" }) === "unknown" && vaiPhi({ seller_type: "nmg", seller_type_source: "suy_doan" }) === "unknown"
    && vaiPhi({ seller_type: "nmg", seller_type_source: "admin" }) === "nmg" && phanTramPhi("ccrb", "cho_thue") === null);

// (4) chữ in luôn chuẩn ở đường ra (không gài theo luat_loi_bot).
const cr = readFileSync(new URL("../supabase/functions/chat-reply/index.ts", import.meta.url), "utf8");
const gai = cr.split("\n").filter((d) => /\b(?:boGachDai|boGachCheo)\b/.test(d) && /\b(?:luatDu|luatDuMua|luatDuR2)\b/.test(d));
ok("(4) boGachDai / boGachCheo không gài theo luat_loi_bot (TONE_RULES cấm hai thứ đó — đường ra phải giữ đúng điều đó)", gai.length === 0, gai.join("\n      "));
ok("(4) TONE_RULES vẫn cấm gạch dài và 'anh/chị' (lưới chỉ giữ điều prompt nói)", /không gạch dài/.test(TONE_RULES) && /không viết "anh\/chị"/.test(TONE_RULES));

// (6) bản in địa chỉ không mang đuôi hành chính chữ khách.
const dc = ["Võ Văn Tần phường 6 quận 3 cũ", "duong pham van chieu p14 go vap", "hxh Nguyễn Trãi p3 q5", "12 Lê Lợi, P.Bến Thành, Q1", "o q10"]
  .map((x) => [x, duongHienThi(x)]).filter(([, y]) => /\b(?:phường|phuong|quận|quan|p\.?\s*\d|q\.?\s*\d|go vap)\b/iu.test(y));
ok("(6) duongHienThi không in lại phường / quận chữ khách (chủ của phần đó là cột chuẩn)", dc.length === 0, JSON.stringify(dc));

console.log(hong ? `\nLUẬT KHÔNG MÂU THUẪN: ${hong} CA HỎNG` : "\nLUẬT KHÔNG MÂU THUẪN: ĐẠT");
process.exit(hong ? 1 : 0);
