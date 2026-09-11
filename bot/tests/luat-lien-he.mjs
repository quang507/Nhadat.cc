#!/usr/bin/env node
// luat-lien-he.mjs — LUẬT CHE LIÊN HỆ, MỘT NGUỒN CHO WEB VÀ BOT (tầng bốn, 11/09).
//
// Hai chỗ dùng (`lib/format.ts sanitizeDescription` và `chat-reply locLienHe`)
// nay cùng gọi `thayLienHe`. Bài này kiểm chính cái hàm đó, trên đúng hai nhãn
// mà hai chỗ dùng — vì lỗi đầu tiên nó bắt được nằm ở TƯƠNG TÁC giữa nhãn và
// luật: nhãn có chữ "Zalo", luật mạng xã hội khớp chữ "Zalo", nên bản cũ hai
// lượt `replace` chèn nhãn vào giữa nhãn ("[liên hệ qua [liên hệ qua Zalo…").
import { thayLienHe, coSdt } from "../supabase/functions/_shared/extraction/luat-lien-he.ts";

const NHAN_WEB = " [liên hệ qua Zalo AI Ơi Nhà Đất] ";
const NHAN_BOT = " [liên hệ qua Zalo] ";
let dat = 0, hong = 0;
const la = (ten, thuc, mong) => {
  if (thuc === mong) { dat++; console.log(`\x1b[32m✓\x1b[0m ${ten}`); }
  else { hong++; console.log(`\x1b[31m✗\x1b[0m ${ten}\n    thật ${JSON.stringify(thuc)}\n    mong ${JSON.stringify(mong)}`); }
};
const gon = (s) => s.replace(/\s+/g, " ").trim();

console.log("LUẬT CHE LIÊN HỆ — web và bot cùng một hàm\n");

for (const [ai, nhan] of [["web", NHAN_WEB], ["bot", NHAN_BOT]]) {
  const n = gon(nhan);
  la(`${ai}: SĐT + zalo trong cùng câu → hai nhãn, KHÔNG lồng nhau (11/09)`,
    gon(thayLienHe("gọi 0903 123 456 hoặc zalo: abc", nhan)), `gọi ${n} hoặc ${n}`);
  la(`${ai}: gọi lần hai trên KẾT QUẢ lần một thì không đổi gì thêm (không lồng khi lọc lại)`,
    gon(thayLienHe(thayLienHe("gọi 0903123456", nhan), nhan)).split(n).length - 1, 1);
}

la("SĐT có chấm: 0903.123.456", gon(thayLienHe("lh 0903.123.456", NHAN_BOT)), `lh ${gon(NHAN_BOT)}`);
la("SĐT đầu +84", gon(thayLienHe("lh +84 903 123 456", NHAN_BOT)), `lh ${gon(NHAN_BOT)}`);
la("facebook kèm tên", gon(thayLienHe("fb: nha.dat.q5", NHAN_BOT)), gon(NHAN_BOT));
la("KHÔNG đụng giá tiền: '5 tỷ 2'", thayLienHe("giá 5 tỷ 2", NHAN_BOT), "giá 5 tỷ 2");
la("KHÔNG đụng diện tích: '4x15, 60m2'", thayLienHe("4x15, 60m2", NHAN_BOT), "4x15, 60m2");
la("KHÔNG đụng số nhà ngắn: 'hẻm 572/12'", thayLienHe("hẻm 572/12", NHAN_BOT), "hẻm 572/12");
la("coSdt gọi hai lần liền trên cùng câu vẫn true (không kẹt lastIndex)",
  [coSdt("0903123456"), coSdt("0903123456")].join(","), "true,true");

console.log(`\n${dat} đạt · ${hong} hỏng`);
if (hong) { console.log("\x1b[31mLUẬT CHE LIÊN HỆ HỎNG\x1b[0m"); process.exitCode = 1; }
else console.log("\x1b[32mLUẬT CHE LIÊN HỆ ĐẠT\x1b[0m");
