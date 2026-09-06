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
import { dirname, join, resolve, sep } from "node:path";
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
  "bot_usage", "buyers", "chat_quota", "conversations", "ctv_daily_reports",
  "ctvs", "curated_lists", "deals", "inbound_events", "inbound_ledger",
  "info_requests", "interests", "listing_facts", "listing_media",
  "listing_views", "listings", "media", "media_cleanup_queue", "messages",
  "projects", "property_events", "ratings_log", "reminders", "required_facts",
  "sellers", "viewings",
];

// ─────────────────── CÁI GÌ KHÔNG NẰM TRONG BẢN SAO NÀY ───────────────────
// Liệt kê tường minh, vì "không thấy trong thư mục sao lưu" và "cố ý không sao
// lưu" nhìn giống hệt nhau lúc 3 giờ sáng đang chữa cháy.
//
// · VIEW (17 cái: public_listings, ctv_ranks, bds_hot…) — dẫn xuất, không chứa
//   dữ liệu riêng. Định nghĩa nằm trong `schema.sql`, dựng lại là có.
// · cron.job (12 job) — KHÔNG mất: `xuat_schema()` sinh sẵn câu
//   `cron.schedule(...)` cho từng job vào `schema.sql`. Đã kiểm 05/09/2026:
//   cả 12 lệnh đều gọi hàm bọc (`select public.nudge_tick()`), không lệnh nào
//   nhúng khoá, nên đưa vào repo public là an toàn.
// · storage.buckets — định nghĩa 3 bucket (listing-public, listing-private,
//   listing-photos) + policy của chúng nằm trong `schema.sql`.
// · storage.objects (FILE ẢNH THẬT) — KHÔNG sao lưu ở đây, và đây là lỗ hổng
//   thật chứ không phải quyết định thoải mái. Hôm nay 0 file nên chưa mất gì;
//   khi `up-anh.mjs` đẩy ảnh lên thì `listing_media` (đã có trong BANG) giữ
//   được BẢN ĐỒ ảnh ↔ tin, nhưng BYTE ảnh thì không. Nguồn gốc vẫn còn ở
//   `masterDB/` trên máy chủ dự án — đó là bản sao duy nhất của byte ảnh.
// · auth.users — PostgREST không với tới schema `auth`. Hôm nay 0 dòng nên
//   chưa mất gì, nhưng `sellers.auth_user_id` có khoá ngoại trỏ sang đó: khi
//   đã có người dùng thật, phục hồi `sellers` trước `auth.users` sẽ gãy FK.
//   Muốn đủ thì phải `supabase db dump`, việc đó cần CLI + mật khẩu DB.
// · vault.secrets — CỐ Ý KHÔNG sao lưu. Đổ secret ra file JSON trên đĩa là
//   biến bản sao lưu thành kho khoá. Chép tay lại từ Dashboard khi phục hồi.
//
// Ba dòng cuối là việc còn treo, không phải việc đã xong — xem OPEN-25.
const KHONG_SAO_LUU = {
  view: "dẫn xuất — định nghĩa nằm trong schema.sql",
  "cron.job": "có trong schema.sql (12 job, không job nào nhúng khoá)",
  "storage.buckets": "có trong schema.sql (định nghĩa + policy)",
  "storage.objects": "CHƯA CÓ CÁCH — byte ảnh chỉ còn ở masterDB/ trên máy chủ",
  "auth.users": "CHƯA CÓ CÁCH — PostgREST không với tới schema auth, cần supabase db dump",
  "vault.secrets": "cố ý bỏ — chép tay từ Dashboard, đừng đổ khoá ra đĩa",
};

const TRANG = 1000; // PostgREST mặc định trần 1000 dòng/lượt

// Trả `{ rows, tong }` — `tong` là số dòng DB TỰ BÁO, không phải số mình đếm.
//
// VÌ SAO PHẢI HỎI SỐ: bản trước chỉ kéo tới khi trang cuối ngắn hơn 1000 rồi
// coi là xong. Nghĩa là nó tin tuyệt đối vào chính vòng lặp của mình. Một
// PostgREST trả trang rỗng sớm — vì `db_max_rows` bị đặt, vì proxy cắt, vì
// timeout giữa chừng — sẽ cho ra file JSON NGẮN, và script in "đã sao lưu"
// kèm một con số nhỏ mà không ai biết là nhỏ so với cái gì. Đây đúng kiểu hỏng
// im lặng tệ nhất: bản sao lưu TỒN TẠI, có vẻ ổn, và thiếu dữ liệu.
//
// `Prefer: count=exact` bắt PostgREST trả `Content-Range: 0-999/12345`. Con số
// sau dấu `/` là sự thật phía DB. Lệch là hỏng, và hỏng thì phải kêu.
async function keoBang(ten) {
  const rows = [];
  let tong = null;
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
          // Chỉ hỏi ở trang đầu: `count=exact` bắt DB đếm cả bảng, hỏi lại mỗi
          // trang là bắt nó đếm lại từ đầu mỗi lượt.
          ...(tu === 0 ? { Prefer: "count=exact" } : {}),
        },
      },
    );
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    if (tu === 0) {
      // Dạng "0-999/12345", hoặc "*/0" khi bảng rỗng.
      const m = /\/(\d+)\s*$/.exec(r.headers.get("content-range") ?? "");
      tong = m ? Number(m[1]) : null;
    }
    const phan = await r.json();
    rows.push(...phan);
    if (phan.length < TRANG) break;
  }
  if (tong === null) {
    // Không đọc được Content-Range thì KHÔNG im lặng cho qua — mất luôn cái
    // lưới vừa dựng. Thà dừng còn hơn tin một con số không kiểm được.
    throw new Error("không đọc được Content-Range → không xác minh được số dòng");
  }
  if (rows.length !== tong) {
    throw new Error(`kéo về ${rows.length} dòng nhưng DB báo có ${tong} — bản sao THIẾU`);
  }
  return { rows, tong };
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

const dich = resolve(process.argv[2]
  ?? join(process.cwd(), "..", "nhadat-backup",
          new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")));

// Bản sao chứa SĐT thật của khách và người bán; repo này đang PUBLIC. Mặc định
// đã trỏ ra ngoài repo, nhưng mặc định chỉ bảo vệ người không gõ tham số. Một
// lần `node scripts/sao-luu.mjs ./tmp` rồi `git add -A` là xong đời.
const GOC_REPO = resolve(HERE, "..");
if (dich === GOC_REPO || dich.startsWith(GOC_REPO + sep)) {
  console.error(
    `TỪ CHỐI: thư mục đích nằm TRONG repo (${dich}).\n` +
    "  Bản sao lưu mang SĐT thật, repo này đang public. Chọn đường dẫn ngoài repo,\n" +
    "  ví dụ: node scripts/sao-luu.mjs ../nhadat-backup/thu-cong",
  );
  process.exit(1);
}

await mkdir(dich, { recursive: true });
console.log(`Sao lưu → ${dich}\n`);

// Manifest ghi ra ĐĨA, không chỉ in ra màn hình. Màn hình cuộn mất; thư mục
// sao lưu thì còn đó hàng tháng, và người mở nó ra lúc chữa cháy cần biết
// NGAY bản này đủ hay thiếu. Một thư mục thiếu ba bảng trông y hệt một thư
// mục đủ nếu không có gì nói ra.
const soTay = {
  du_an: URL_DU_AN,
  luc: new Date().toISOString(),
  trang_thai: "dang_chay",
  bang: [],
  hong: [],
  khong_sao_luu: KHONG_SAO_LUU,
};
async function ghiSoTay() {
  await writeFile(join(dich, "manifest.json"), JSON.stringify(soTay, null, 2));
}

// Mọi đường hỏng đều phải để lại manifest rồi mới thoát — kể cả hỏng SỚM
// (thiếu bảng, xuất schema hụt). Không có manifest thì thư mục dở dang lại
// trông như một bản sao lưu bình thường.
async function chet(ma, loi) {
  soTay.trang_thai = "hong";
  soTay.loi = String(loi?.message ?? loi);
  await ghiSoTay().catch(() => {});
  console.error(`\n${soTay.loi}`);
  console.error("Bản sao lưu này KHÔNG đủ — đừng cất nó đi như một bản tốt.");
  process.exit(ma);
}

try {
  await kiemDuBang();
  await keoSchema(dich);
} catch (e) {
  await chet(2, e);
}

let tongDong = 0;
for (const ten of BANG) {
  const file = `${ten}.json`;
  try {
    const { rows, tong } = await keoBang(ten);
    const noiDung = JSON.stringify(rows, null, 1);
    await writeFile(join(dich, file), noiDung);
    tongDong += rows.length;
    soTay.bang.push({ ten, dong: rows.length, db_bao: tong, file, bytes: Buffer.byteLength(noiDung) });
    console.log(`  ${ten.padEnd(22)} ${String(rows.length).padStart(6)} dòng  → ${file}`);
  } catch (e) {
    soTay.hong.push({ ten, loi: e.message });
    console.error(`  ${ten.padEnd(22)} LỖI: ${e.message}`);
  }
}

soTay.so_bang = soTay.bang.length;
soTay.so_dong = tongDong;
soTay.trang_thai = soTay.hong.length ? "thieu" : "day_du";
await ghiSoTay();

console.log(`\n${tongDong} dòng, ${soTay.bang.length}/${BANG.length} bảng → manifest.json`);
if (soTay.hong.length) {
  // Thoát khác 0 để `cron`/Task Scheduler biết là chuyến này KHÔNG thành công.
  // Sao lưu hụt mà báo thành công còn nguy hơn không sao lưu.
  console.error(`Bảng hỏng: ${soTay.hong.map((h) => h.ten).join(", ")} — bản sao lưu này KHÔNG đủ.`);
  process.exit(2);
}
console.log("Xong. Cất thư mục này ra ổ khác / cloud riêng — đừng để một chỗ với DB.");
console.log("`bot/supabase/schema.sql` vừa được cập nhật — nhớ commit nếu nó đổi.");
