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
// 2299, không trùng không sót; 23/23 bảng ra file. Phần CHƯA thử là lần bắt
// tay thật với supabase.co (môi trường soạn script không có đường ra Internet
// tới đó). Nên lần chạy đầu trên máy chủ dự án hãy đối chiếu số dòng nó in ra
// với số dòng trong Dashboard, ít nhất cho `listings` và `messages`.

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

// Danh sách bảng public. Thêm bảng mới thì thêm vào đây — script CỐ TÌNH không
// tự dò bảng: tự dò thì thêm bảng mà quên là im lặng bỏ sót, còn liệt kê tay
// thì thiếu là thấy ngay.
//
// 05/09/2026 — "thấy ngay" chỉ đúng nếu có người mở Dashboard ra so, và suốt
// 27/08 → 05/09 không ai so. DB lúc đó có 30 bảng, danh sách này có 22: tám
// bảng CHƯA TỪNG được sao lưu, trong đó `listing_media` là bản đồ ảnh ↔ tin
// (FR-165) — mất nó thì file trong Storage còn nguyên mà không ai biết ảnh của
// tin nào. Nay danh sách vẫn liệt kê tay (đọc là thấy) nhưng `kiemDuBang()`
// bên dưới hỏi DB mỗi lần chạy, thiếu một bảng là DỪNG. Bỏ sót không còn im.
const BANG = [
  // (`ratings` đã bị xoá theo OPEN-23 ngày 27/08/2026.)
  "admins", "app_config", "bot_errors", "bot_health", "bot_prompts",
  "bot_usage", "buyers", "conversations", "ctv_daily_reports", "ctvs",
  "curated_lists", "deals", "inbound_events", "inbound_ledger",
  "info_requests", "interests", "listing_facts", "listing_media",
  "listing_views", "listings", "media", "media_cleanup_queue", "messages",
  "projects", "property_events", "ratings_log", "reminders", "required_facts",
  "sellers", "viewings",
];

const TRANG = 1000; // PostgREST mặc định trần 1000 dòng/lượt

async function keoBang(ten) {
  const rows = [];
  for (let tu = 0; ; tu += TRANG) {
    const den = tu + TRANG - 1;
    const r = await fetch(
      `${URL_DU_AN}/rest/v1/${ten}?select=*`,
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

async function goiRpc(ten) {
  const r = await fetch(`${URL_DU_AN}/rest/v1/rpc/${ten}`, {
    method: "POST",
    headers: {
      apikey: KHOA,
      Authorization: `Bearer ${KHOA}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!r.ok) throw new Error(`rpc/${ten}: HTTP ${r.status} ${await r.text()}`);
  return r.json();
}

// Bảng nào có trong DB mà không có trong BANG → DỪNG. Đây là chỗ biến "quên
// thêm bảng" từ mất dữ liệu im lặng thành một lần chạy hỏng nhìn thấy được.
async function kiemDuBang() {
  const trongDb = await goiRpc("liet_ke_bang");
  const thieu = trongDb.filter((t) => !BANG.includes(t));
  const thua = BANG.filter((t) => !trongDb.includes(t));
  if (thua.length) {
    console.warn(`  ! BANG khai bảng không còn trong DB: ${thua.join(", ")}`);
  }
  if (thieu.length) {
    throw new Error(
      `DB có ${thieu.length} bảng chưa khai trong BANG: ${thieu.join(", ")}\n` +
      "  → thêm vào mảng BANG trong scripts/sao-luu.mjs rồi chạy lại.\n" +
      "  Sao lưu thiếu bảng mà báo thành công là cái bẫy tệ nhất ở đây.",
    );
  }
  console.log(`  Đủ bảng: ${trongDb.length}/${trongDb.length} bảng của DB đã khai.`);
}

// Schema không nằm trong dữ liệu. `sao-luu.mjs` cũ chỉ kéo dòng, nên bản sao là
// một đống JSON không có cái để đổ vào: 44/51 migration đầu (21/08 → 27/08) áp
// thẳng qua MCP mà không lưu file, schema lõi chỉ tồn tại trong project đang
// chạy. `xuat_schema()` (migration 20260905a) sinh DDL dựng lại được.
//
// Ghi HAI nơi: thư mục sao lưu (đi cùng dữ liệu) và `bot/supabase/schema.sql`
// trong repo (để repo một mình cũng dựng lại được). File chỉ có DDL, không có
// dòng dữ liệu nào, nên không mang SĐT thật ra repo public.
async function keoSchema(dich) {
  const ddl = await goiRpc("xuat_schema");
  if (typeof ddl !== "string" || ddl.length < 1000) {
    throw new Error(`xuat_schema trả về bất thường (${typeof ddl}, ${ddl?.length} ký tự)`);
  }
  const trongRepo = join(HERE, "..", "bot", "supabase", "schema.sql");
  await writeFile(join(dich, "schema.sql"), ddl);
  await writeFile(trongRepo, ddl);
  console.log(`  schema.sql          ${String(ddl.length).padStart(6)} ký tự → cả ${trongRepo}`);
}

const dich = process.argv[2]
  ?? join(process.cwd(), "..", "nhadat-backup",
          new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-"));

await mkdir(dich, { recursive: true });
console.log(`Sao lưu → ${dich}\n`);

await kiemDuBang();
await keoSchema(dich);

let tongDong = 0;
const hong = [];
for (const ten of BANG) {
  try {
    const rows = await keoBang(ten);
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
console.log("`bot/supabase/schema.sql` vừa được cập nhật — nhớ commit nếu nó đổi.");
