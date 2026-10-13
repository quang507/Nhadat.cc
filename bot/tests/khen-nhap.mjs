// SRS-5.1zzzzzl: kiểm tất định câu khen dưới bản nháp (`khenHopLe`, _shared/extraction/khen-hop-le.ts). AI viết câu khen; code chỉ nhận câu mà
// mọi cụm dựa vào nằm nguyên văn trong bản tin và không có con số ngoài bản tin. Lượt soát nhận xét (kiem-khen.ts) chạy sau ở chat-reply.
import { khenHopLe } from "../supabase/functions/_shared/extraction/khen-hop-le.ts";

const BAN_TIN = `📋 Em sẽ rao như vầy nhé anh:
Chỉ 7,6 tỷ ô tô tận cửa tại Bình Hưng Hòa, Bình Tân
📍 Hương Lộ 3, Phường Bình Hưng Hòa, Quận Bình Tân
💰 7,6 tỷ
📐 Diện tích: 60m² · dài 10m
🏫 Tiện ích: mặt tiền 6m · gần trường mầm non · chợ · Bách Hóa Xanh · công viên`;

let dat = 0, hong = 0;
const la = (ten, ok, ct = "") => { if (ok) { dat++; console.log(`\x1b[32m✓\x1b[0m ${ten}`); } else { hong++; console.log(`\x1b[31m✗\x1b[0m ${ten}${ct ? `\n    ${ct}` : ""}`); } };

const tot = "Căn mình ô tô tận cửa, mặt tiền 6m lại gần trường mầm non, chợ, anh giới thiệu chi tiết quá ạ.";
la("KHEN-K1 (ca gốc) câu nhắc lại đúng chữ bản tin, cụm dựa vào có thật → nhận", khenHopLe(tot, ["ô tô tận cửa", "mặt tiền 6m", "gần trường mầm non"], BAN_TIN) === tot);
la("KHEN-K2 cụm dựa vào KHÔNG có trong bản tin ('hẻm sâu') → bỏ cả câu", khenHopLe("Căn mình hẻm sâu yên tĩnh, anh giới thiệu kỹ quá ạ.", ["hẻm sâu"], BAN_TIN) === null);
la("KHEN-K3 con số ngoài bản tin ('8m') → bỏ", khenHopLe("Căn mình mặt tiền 8m, ô tô tận cửa, anh giới thiệu rõ quá ạ.", ["ô tô tận cửa"], BAN_TIN) === null);
la("KHEN-K4 câu hỏi → bỏ", khenHopLe("Căn mình ô tô tận cửa, anh có muốn thêm ảnh không ạ?", ["ô tô tận cửa"], BAN_TIN) === null);
la("KHEN-K5 không khai cụm dựa vào → bỏ", khenHopLe(tot, [], BAN_TIN) === null);
la("KHEN-K6 model trả null → không có câu khen", khenHopLe(null, ["ô tô tận cửa"], BAN_TIN) === null);
la("KHEN-K7 (cách nói khác) 'gần chợ, công viên' + số có trong tin '60m²' → nhận", !!khenHopLe("Nhà 60m² gần chợ, công viên, anh kể rõ ràng quá ạ.", ["chợ", "công viên"], BAN_TIN));

console.log(`\n${dat} đạt · ${hong} hỏng`);
if (hong) process.exitCode = 1;
