#!/usr/bin/env node
// soat-migration.mjs — so migration ĐÃ ÁP trên DB với FILE trong repo.
//
// ====================== VÌ SAO PHẢI CÓ CÁI NÀY ======================
// CLAUDE.md §6 nói "Migration là nguồn sự thật của schema". Soát 05/09/2026
// cho thấy câu đó không đúng: DB đã áp 103 migration, repo có 59 file. 44
// migration đầu (21/08 → 27/08) áp thẳng qua MCP mà không ai lưu file lại —
// toàn bộ schema lõi (bảng, RLS, projects, conversations, reminders, CTV,
// drip) chỉ tồn tại trong project đang chạy.
//
// Không ai phát hiện suốt hai tuần vì KHÔNG CÓ GÌ ĐỐI CHIẾU HAI BÊN. Một câu
// khẳng định trong tài liệu không tự kiểm được chính nó. Đây là cái kiểm.
//
// ============================== CÁCH DÙNG ==============================
//     node scripts/soat-migration.mjs
// Cần SUPABASE_SERVICE_ROLE_KEY (đọc từ scripts/.env như sao-luu.mjs) vì bảng
// supabase_migrations nằm ngoài schema public, PostgREST không phơi ra —
// phải qua RPC `liet_ke_migration()` (migration 20260905c), chỉ service_role.
//
// Thoát 0 = khớp. Thoát 1 = có trôi. Chạy nó ở cổng 3 (trước deploy) và sau
// mỗi lần áp migration bằng MCP.

import { readdir, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const ENV_FILE = join(HERE, ".env");
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const val = m[2].trim().replace(/^(['"])(.*)\1$/, "$2").replace(/^<(.*)>$/, "$1");
    if (val && !(m[1] in process.env)) process.env[m[1]] = val;
  }
}

const URL_DU_AN = process.env.SUPABASE_URL ?? "https://tbcdpupiarkuxtntmosl.supabase.co";
const KHOA = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KHOA) {
  console.error("Thiếu SUPABASE_SERVICE_ROLE_KEY (xem hướng dẫn trong sao-luu.mjs).");
  process.exit(1);
}

const THU_MUC = join(HERE, "..", "bot", "supabase", "migrations");

const r = await fetch(`${URL_DU_AN}/rest/v1/rpc/liet_ke_migration`, {
  method: "POST",
  headers: { apikey: KHOA, Authorization: `Bearer ${KHOA}`, "Content-Type": "application/json" },
  body: "{}",
});
if (!r.ok) {
  console.error(`rpc/liet_ke_migration: HTTP ${r.status} ${await r.text()}`);
  process.exit(1);
}
const daAp = await r.json();

const file = (await readdir(THU_MUC)).filter((f) => f.endsWith(".sql"));
const tenFile = file.map((f) => f.replace(/\.sql$/, ""));

// Khớp lỏng: `name` trên DB đôi khi bị cắt tiền tố ngày (MCP tự đặt tên). Coi
// là khớp nếu tên file CHỨA tên migration hoặc ngược lại — thà bỏ sót một cảnh
// báo còn hơn kêu oan hàng chục dòng rồi không ai đọc nữa.
const khop = (name) =>
  tenFile.some((f) => f === name || f.endsWith(name) || f.includes(name.replace(/^\d+_/, "")));

const thieuFile = daAp.filter((m) => !khop(m.name));
const chuaAp = tenFile.filter(
  (f) => !daAp.some((m) => f === m.name || f.endsWith(m.name) || f.includes(m.name.replace(/^\d+_/, ""))),
);

let loi = 0;
console.log(`DB đã áp ${daAp.length} migration · repo có ${file.length} file\n`);

if (thieuFile.length) {
  loi = 1;
  console.log(`✗ ${thieuFile.length} migration ĐÃ ÁP nhưng KHÔNG có file trong repo:`);
  for (const m of thieuFile) console.log(`    ${m.version}  ${m.name}`);
  console.log("  → Không dựng lại được từ repo. Lưới an toàn là bot/supabase/schema.sql");
  console.log("    (sinh bởi `node scripts/sao-luu.mjs`). Migration MỚI vẫn phải có file.\n");
} else {
  console.log("✓ Mọi migration đã áp đều có file trong repo\n");
}

if (chuaAp.length) {
  loi = 1;
  console.log(`✗ ${chuaAp.length} file trong repo CHƯA thấy áp trên DB:`);
  for (const f of chuaAp) console.log(`    ${f}`);
  console.log("  → Áp bằng `apply_migration` với đúng nội dung file, đừng sửa tay ở dashboard.\n");
} else {
  console.log("✓ Mọi file trong repo đều đã áp trên DB\n");
}

// Ảnh chụp schema phải mới hơn migration mới nhất, không thì nó tả một DB đã cũ.
const SCHEMA = join(HERE, "..", "bot", "supabase", "schema.sql");
if (!existsSync(SCHEMA)) {
  loi = 1;
  console.log("✗ Chưa có bot/supabase/schema.sql — repo một mình KHÔNG dựng lại được DB.");
  console.log("  → chạy `node scripts/sao-luu.mjs` rồi commit file đó.\n");
} else {
  const tSchema = (await stat(SCHEMA)).mtimeMs;
  const moiNhat = Math.max(
    ...(await Promise.all(file.map(async (f) => (await stat(join(THU_MUC, f))).mtimeMs))),
  );
  if (tSchema < moiNhat) {
    loi = 1;
    console.log("✗ bot/supabase/schema.sql cũ hơn migration mới nhất — ảnh chụp đã lỗi thời.");
    console.log("  → chạy lại `node scripts/sao-luu.mjs` rồi commit.\n");
  } else {
    console.log("✓ Ảnh chụp schema mới hơn migration mới nhất\n");
  }
}

process.exit(loi);
