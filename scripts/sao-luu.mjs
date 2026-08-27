#!/usr/bin/env node
// sao-luu.mjs — kéo toàn bộ dữ liệu Supabase về máy, mỗi bảng một file JSON.
//
// ====================== VÌ SAO PHẢI CÓ CÁI NÀY ======================
// Supabase bậc Free KHÔNG có backup tự động. Không phải "backup ít ngày" —
// là KHÔNG CÓ. Trích nguyên văn docs Supabase (Database Backups):
//
//   "We automatically back up all Pro, Team, and Enterprise Plan projects
//    on a daily basis."
//   "Database backups are not available for download for Free Plan projects."
//   "We recommend that free tier plan projects regularly export their data
//    using the Supabase CLI `db dump` command."
//
// Nghĩa là hôm nay, một câu `delete` nhỡ tay hay một lần `drop table` là 173
// tin + toàn bộ lịch sử hội thoại + hồ sơ nhu cầu khách bay sạch, không có nút
// hoàn tác nào hết. Script này là cái nút đó, chạy bằng tay.
//
// ============================== CÁCH DÙNG ==============================
//   Đặt khoá MỘT LẦN vào scripts/.env (file này tự đọc, đã gitignore):
//       SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
//   rồi:
//       node scripts/sao-luu.mjs                # ghi ra ../nhadat-backup/<ngày>/
//       node scripts/sao-luu.mjs /duong/dan/khac
//   PHẢI có chữ `node` ở đầu. Gõ mỗi `sao-luu.mjs` thì Windows mở Notepad.
//
// KHÓA service_role BỎ QUA MỌI RLS. Đừng dán nó vào file trong repo, đừng
// commit, đừng gõ nó vào chat. Chỉ để trong biến môi trường của máy chủ dự án.
//
// Thư mục đích nằm NGOÀI repo theo mặc định — bản sao lưu chứa SĐT thật của
// khách và người bán, repo này thì đang PUBLIC.
//
// ĐÃ THỬ TỚI ĐÂU (27/08/2026): phần phân trang có chạy thật, trên một server
// giả lập PostgREST — bảng 2300 dòng kéo về đủ 2300, dòng đầu 0, dòng cuối
// 2299, không trùng không sót. Phần CHƯA thử là lần bắt tay thật với
// supabase.co (môi trường soạn script không có đường ra Internet tới đó). Nên
// lần chạy đầu trên máy chủ dự án hãy đối chiếu số dòng nó in ra với số dòng
// trong Dashboard, ít nhất cho `listings` và `messages`.
//
// SỬA 27/08 (chiều): bản trước phân trang bằng header Range mà KHÔNG có
// `order=`. Server giả lập trả dòng theo đúng thứ tự chèn nên bài thử trên qua
// hết — còn Postgres thật thì không hứa hẹn gì về thứ tự khi thiếu ORDER BY.
// Bảng nào trên 1000 dòng đều có thể mất/lặp dòng ở biên trang, mà script vẫn
// in ra "đủ bảng" và một con số tổng trông hợp lý. Xem chú thích ở keoBang().

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Nạp scripts/.env — cùng lý do với bridge: `set SUPABASE_SERVICE_ROLE_KEY=...`
// trong cmd chỉ sống đúng cửa sổ đó, đóng cửa sổ là mất. Bắt nhớ gõ lại mỗi lần
// thì sớm muộn cũng quên, mà quên ở đây nghĩa là KHÔNG CÓ bản sao lưu nào.
// Đọc theo thư mục của chính file này, không theo thư mục đang đứng.
const HERE = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const ENV_FILE = join(HERE, ".env");
if (existsSync(ENV_FILE)) {
  const tuFile = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    const val = m[2].trim().replace(/^(['"])(.*)\1$/, "$2").replace(/^<(.*)>$/, "$1");
    if (val) tuFile[m[1]] = val;           // dòng sau đè dòng trước, rỗng thì bỏ
  }
  for (const [k, v] of Object.entries(tuFile)) {
    if (!(k in process.env)) process.env[k] = v;
  }
}

const URL_DU_AN = process.env.SUPABASE_URL
  ?? "https://tbcdpupiarkuxtntmosl.supabase.co";
const KHOA = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!KHOA) {
  console.error(
    "Thiếu SUPABASE_SERVICE_ROLE_KEY.\n" +
    "  1. Dashboard → Project Settings → API keys → service_role → copy.\n" +
    `  2. Tạo file ${ENV_FILE} với đúng một dòng (dán TRẦN, không ngoặc nhọn):\n` +
    "       SUPABASE_SERVICE_ROLE_KEY=eyJhbG...\n" +
    "  3. Chạy lại `node sao-luu.mjs`. (.env đã nằm trong .gitignore.)\n" +
    "  Lưu ý: phải gõ `node sao-luu.mjs`, gõ mỗi `sao-luu.mjs` thì Windows mở\n" +
    "  Notepad chứ không chạy.",
  );
  process.exit(1);
}

// Danh sách bảng public tính tới 27/08/2026. Thêm bảng mới thì thêm vào đây —
// script CỐ TÌNH không tự dò bảng: tự dò thì thêm bảng mà quên là im lặng bỏ
// sót, còn liệt kê tay thì thiếu là thấy ngay khi so với Dashboard.
//
// Cột thứ hai là KHOÁ SẮP XẾP, và nó bắt buộc phải có — xem chú thích ở
// keoBang(). Lấy đúng khoá chính của bảng để thứ tự là toàn phần (không hai
// dòng nào bằng nhau), nên phân trang không bao giờ nhập nhằng.
// (`ratings` đã bị xoá theo OPEN-23 ngày 27/08/2026.)
const BANG = [
  ["admins",            "email"],
  ["bot_errors",        "id"],
  ["bot_health",        "who"],
  ["bot_prompts",       "key"],
  ["bot_tokens",        "name"],          // FR-158 — xem chú thích dưới
  ["bot_usage",         "day"],
  ["buyers",            "id"],
  ["conversations",     "id"],
  ["ctv_daily_reports", "id"],
  ["ctvs",              "id"],
  ["deals",             "id"],
  ["info_requests",     "id"],
  ["interests",         "buyer_id,listing_id"],
  ["listing_facts",     "id"],
  ["listing_views",     "auth_user_id,listing_id"],
  ["listings",          "id"],
  ["media",             "id"],
  ["messages",          "id"],
  ["projects",          "id"],
  ["reminders",         "id"],
  ["required_facts",    "fact_key,property_type"],
  ["sellers",           "id"],
  ["viewings",          "id"],
];
// CỐ Ý KHÔNG sao lưu `rate_counters` (FR-162): bộ đếm dùng một lần rồi bỏ, tự
// dọn sau 3 ngày. Khôi phục nó chỉ tổ dựng lại mấy con số vô nghĩa.
//
// `bot_tokens` thì NGƯỢC LẠI — bảng quan trọng nhất trong danh sách này sau
// `listings`/`messages`. Zalo XOAY refresh_token mỗi lần đổi, nên dòng trong
// đó là chìa khoá DUY NHẤT còn dùng được để bot gửi tin. Mất là phải vào Zalo
// Developers cấp tay lại từ đầu. (Cũng vì vậy mà bản sao lưu này càng phải cất
// ngoài repo và ngoài máy chạy DB.)

const TRANG = 1000; // PostgREST mặc định trần 1000 dòng/lượt

async function keoBang(ten, khoaSapXep) {
  const rows = [];
  for (let tu = 0; ; tu += TRANG) {
    const den = tu + TRANG - 1;
    // `order=` KHÔNG PHẢI trang trí — không có nó thì phân trang này SAI.
    //
    // Postgres không hứa hẹn gì về thứ tự dòng của một SELECT không ORDER BY.
    // Giữa hai lượt fetch, planner có thể đổi cách quét, autovacuum có thể dời
    // dòng, và một INSERT xen vào (bot vẫn đang chạy trong lúc sao lưu) là đủ
    // để cả tập dịch chuyển. Range 0-999 rồi 1000-1999 khi đó cắt trên hai thứ
    // tự khác nhau: vài dòng bị lấy hai lần, vài dòng không bao giờ được lấy.
    //
    // Đây là kiểu hỏng tệ nhất mà một script sao lưu có thể mắc — nó vẫn in ra
    // "23/23 bảng" và một con số tổng trông rất hợp lý; chỉ tới ngày phải khôi
    // phục thật mới biết vài trăm tin nhắn không có ở đó. Với bảng dưới 1000
    // dòng thì không bao giờ lộ, vì chỉ có đúng một lượt fetch.
    //
    // Sắp theo KHOÁ CHÍNH (thứ tự toàn phần) chứ không theo created_at: hai
    // dòng cùng created_at thì thứ tự giữa chúng lại không xác định, và lỗ
    // hổng quay về nguyên vẹn ngay tại biên trang.
    const order = khoaSapXep.split(",").map((c) => `${c.trim()}.asc`).join(",");
    const r = await fetch(
      `${URL_DU_AN}/rest/v1/${ten}?select=*&order=${encodeURIComponent(order)}`,
      {
        headers: {
          apikey: KHOA,
          Authorization: `Bearer ${KHOA}`,
          Range: `${tu}-${den}`,
          "Range-Unit": "items",
        },
      },
    );
    if (!r.ok) throw new Error(`${ten}: HTTP ${r.status} ${await r.text()}`);
    const phan = await r.json();
    rows.push(...phan);
    if (phan.length < TRANG) break;
  }
  return rows;
}

const dich = process.argv[2]
  ?? join(process.cwd(), "..", "nhadat-backup",
          new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-"));

await mkdir(dich, { recursive: true });
console.log(`Sao lưu → ${dich}\n`);

let tongDong = 0;
const hong = [];
for (const [ten, khoaSapXep] of BANG) {
  try {
    const rows = await keoBang(ten, khoaSapXep);
    await writeFile(join(dich, `${ten}.json`), JSON.stringify(rows, null, 1));
    tongDong += rows.length;
    console.log(`  ${ten.padEnd(20)} ${String(rows.length).padStart(6)} dòng`);
  } catch (e) {
    hong.push(ten);
    console.error(`  ${ten.padEnd(20)} LỖI: ${e.message}`);
  }
}

console.log(`\n${tongDong} dòng, ${BANG.length - hong.length}/${BANG.length} bảng.`);
if (hong.length) {
  // Thoát khác 0 để `cron`/Task Scheduler biết là chuyến này KHÔNG thành công.
  // Sao lưu hụt mà báo thành công còn nguy hơn không sao lưu.
  console.error(`Bảng hỏng: ${hong.join(", ")} — bản sao lưu này KHÔNG đủ.`);
  process.exit(2);
}
console.log("Xong. Cất thư mục này ra ổ khác / cloud riêng — đừng để một chỗ với DB.");
