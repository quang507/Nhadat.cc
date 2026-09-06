#!/usr/bin/env node
// soat-phuc-hoi.tu-kiem.mjs — DIỄN TẬP phục hồi trên Postgres LOCAL, kèm đối
// chứng âm. Không chạm production, không cần khoá nào.
//
//   node scripts/soat-phuc-hoi.tu-kiem.mjs
//
// ═══════════════ VÌ SAO CÓ FILE NÀY ═══════════════
// `soat-phuc-hoi.mjs` là thứ quyết định được phép nói "phục hồi ĐẠT". Một bộ
// soát như thế mà báo xanh trên một bản phục hồi HỎNG thì tệ hơn không có gì:
// nó biến một lần mất dữ liệu thành một lần mất dữ liệu CÓ GIẤY CHỨNG NHẬN.
// Repo này đã dính đúng chuyện đó một lần với TS-SEC (báo 24/24 xanh trong lúc
// proxy chặn sạch). Nên trước khi tin bộ soát, phải bắt nó tự chứng minh: bơm
// từng cách hỏng đã biết vào rồi soi mã thoát.
//
// PHẠM VI — nói trước cho khỏi hiểu nhầm:
// Bài này dùng SCHEMA GIẢ (dựng ngay dưới đây), không phải `schema.sql` thật
// của production. Nó chứng minh BỘ SOÁT hoạt động đúng, KHÔNG chứng minh bản
// sao production phục hồi được. Muốn điều đó thì phải chạy diễn tập thật với
// bản sao thật — quy trình ở `docs/12-dien-tap-phuc-hoi.md`.

import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DB = "dien_tap_phuc_hoi";
const DSN = `postgresql://postgres@localhost:5432/${DB}`;
const REPO = path.resolve(new URL("..", import.meta.url).pathname);

let dat = 0, hong = 0;
const ok = (m) => { dat++; console.log(`\x1b[32m✓\x1b[0m ${m}`); };
const no = (m) => { hong++; console.log(`\x1b[31m✗\x1b[0m ${m}`); };

function sh(cmd) { return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
function psql(sql, db = DB) {
  return execFileSync("psql", [`postgresql://postgres@localhost:5432/${db}`, "-tAc", sql],
    { encoding: "utf8" }).trim();
}
// Chạy một script của repo, TRẢ VỀ mã thoát thay vì ném — cả bài này xoay
// quanh việc mã thoát có đúng không.
function chay(script, args) {
  try {
    const out = execFileSync("node", [path.join(REPO, "scripts", script), ...args],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ma: 0, out };
  } catch (e) {
    return { ma: e.status ?? -1, out: (e.stdout ?? "") + (e.stderr ?? "") };
  }
}

// ── Postgres local có chạy không? ────────────────────────────────────────────
try { psql("select 1", "postgres"); }
catch {
  console.error("Không kết nối được Postgres local (postgresql://postgres@localhost:5432).");
  console.error("Khởi động: pg_ctlcluster 16 main start");
  console.error("\nCHƯA KIỂM ĐƯỢC — không phải ĐẠT.");
  process.exit(2);
}

// ── Schema GIẢ: 31 bảng đúng tên BANG[], hình khoá ngoại đúng như DB thật ────
// Đọc từ `pg_constraint` của DB thật 06/09/2026. Hai chỗ quan trọng được giữ
// nguyên vì chúng là thứ làm phục hồi gãy:
//   · vòng sellers ↔ listings
//   · buyers/sellers/listing_views trỏ sang auth.users (KHÔNG có trong bản sao)
// Đọc BANG[] từ chính `sao-luu.mjs` — cùng cách `soat-phuc-hoi.mjs` đọc, để
// hai bên không bao giờ lệch nhau. Bóc bình luận trước rồi mới nhặt tên trong
// nháy kép: dòng `// (ratings đã bị xoá…)` nằm ngay trong khối.
const BANG = [...readFileSync(path.join(REPO, "scripts", "sao-luu.mjs"), "utf8")
  .match(/const BANG = \[([\s\S]*?)\];/)[1]
  .replace(/\/\/[^\n]*/g, "")
  .matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);

const CHINH = new Set(["listings", "sellers", "buyers", "conversations", "messages",
  "inbound_ledger", "inbound_events", "listing_media", "media", "bot_errors",
  "projects", "listing_views"]);

const DDL = `
create schema if not exists auth;
create table auth.users (id uuid primary key);

create table public.projects (id uuid primary key, name text);
create table public.sellers (
  id uuid primary key, auth_user_id uuid references auth.users(id),
  active_listing_id uuid, phone text unique, name text, seller_type text);
create table public.listings (
  id uuid primary key, code text unique, status text,
  seller_id uuid references public.sellers(id),
  project_id uuid references public.projects(id));
alter table public.sellers add constraint sellers_active_listing_id_fkey
  foreign key (active_listing_id) references public.listings(id) on delete set null;
create table public.buyers (
  id uuid primary key, auth_user_id uuid references auth.users(id),
  zalo_user_id text, name text, phone text);
create table public.conversations (
  id uuid primary key, buyer_id uuid references public.buyers(id), channel text);
create table public.messages (
  id uuid primary key, conversation_id uuid not null references public.conversations(id),
  sender text, body text);
create table public.inbound_ledger (
  zalo_msg_id text primary key, status text, attempts int default 0,
  updated_at timestamptz default now());
create table public.inbound_events (
  event_id text primary key, zalo_user_id text, payload jsonb, delivery_count int default 1);
create table public.listing_media (
  id uuid primary key, listing_id uuid references public.listings(id) on delete cascade,
  storage_path text);
create table public.media (
  id uuid primary key, listing_id uuid references public.listings(id) on delete cascade,
  url text);
create table public.bot_errors (
  id bigserial primary key, at timestamptz default now(), source text,
  status_code int, detail text);
create table public.listing_views (
  id uuid primary key, auth_user_id uuid references auth.users(id),
  listing_id uuid references public.listings(id));
${BANG.filter((b) => !CHINH.has(b)).map((b) => `create table public.${b} (id uuid primary key, ghi_chu text);`).join("\n")}
`;

// ── Bản sao GIẢ, hợp lệ ──────────────────────────────────────────────────────
const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function banSaoTot() {
  const d = {
    projects: [{ id: U(1), name: "Ny'ah" }],
    sellers: [{ id: U(10), auth_user_id: null, active_listing_id: null, phone: "0903111222", name: "Anh N.", seller_type: "ccrb" }],
    listings: [
      { id: U(20), code: "BDS-0001", status: "dang_ban", seller_id: U(10), project_id: U(1) },
      { id: U(21), code: "BDS-0002", status: "dang_ban", seller_id: U(10), project_id: null },
    ],
    buyers: [{ id: U(30), auth_user_id: null, zalo_user_id: "Z1", name: "Chi D.", phone: "0904333444" }],
    conversations: [{ id: U(40), buyer_id: U(30), channel: "zalo_oa" }],
    messages: [
      { id: U(50), conversation_id: U(40), sender: "buyer", body: "can nha quan 5" },
      { id: U(51), conversation_id: U(40), sender: "bot", body: "da em tim giup" },
    ],
    inbound_ledger: [{ zalo_msg_id: "M1", status: "completed", attempts: 1, updated_at: "2026-09-05T00:00:00Z" }],
    inbound_events: [{ event_id: "M1", zalo_user_id: "Z1", payload: { x: 1 }, delivery_count: 1 }],
    listing_media: [{ id: U(60), listing_id: U(20), storage_path: "listing-public/a.jpg" }],
    media: [
      { id: U(70), listing_id: U(20), url: "https://x/1.jpg" },
      { id: U(71), listing_id: U(21), url: "https://x/2.jpg" },
    ],
    bot_errors: [{ id: 1, at: "2026-09-05T00:00:00Z", source: "test", status_code: null, detail: "x" }],
  };
  for (const b of BANG) if (!d[b]) d[b] = [];
  return d;
}

function ghiBanSao(duLieu, { suaManifest } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "bansao-"));
  const manifest = {
    tao_luc: new Date().toISOString(),
    bang: BANG.map((b) => ({ bang: b, so_dong: duLieu[b].length, file: `${b}.json`, trang_thai: "day_du" })),
    khong_sao_luu: {
      "storage.objects": "file ảnh nằm trong bucket, sao lưu riêng",
      "auth.users": "tài khoản đăng nhập do Supabase Auth giữ",
      "vault.secrets": "bí mật, cố ý không kéo ra đĩa",
    },
  };
  if (suaManifest) suaManifest(manifest, duLieu);
  for (const b of BANG) writeFileSync(path.join(dir, `${b}.json`), JSON.stringify(duLieu[b]));
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(path.join(dir, "schema.sql"), DDL);
  return dir;
}

function dungLai() {
  psql(`drop database if exists ${DB} with (force)`, "postgres");
  psql(`create database ${DB}`, "postgres");
}

const rac = [];
// MỌI ca đều BẮT BUỘC có `dauHieu`. Diễn tập 06/09: lượt chạy đầu có hai ca
// `napPhaiHong` báo ĐẠT trong khi thật ra chúng đỏ vì một lỗi cú pháp setval
// hoàn toàn khác — mã thoát 1 giống hệt nhau. Chỉ khớp mã thoát là để lọt đúng
// loại test câm mà cả repo này dựng ra để chống.
function canh(ten, duLieu, tuyChinh, maMong, dauHieu) {
  if (!dauHieu) throw new Error(`ca "${ten}" thiếu dauHieu — mã thoát một mình không chứng minh được gì`);
  dungLai();
  const dir = ghiBanSao(duLieu, tuyChinh ?? {});
  rac.push(dir);
  const nap = chay("phuc-hoi.mjs", [dir, DSN]);
  if (tuyChinh?.sauKhiNap && nap.ma === 0) tuyChinh.sauKhiNap();
  const r = tuyChinh?.napPhaiHong
    ? nap
    : (nap.ma !== 0
        ? { ma: -99, out: `NẠP GÃY (không mong đợi):\n${nap.out}` }
        : chay("soat-phuc-hoi.mjs", [dir, DSN]));
  const maDung = r.ma === maMong;
  const chuDung = r.out.includes(dauHieu);
  if (maDung && chuDung) ok(`${ten}  →  thoát ${r.ma}`);
  else {
    no(`${ten}  →  thoát ${r.ma} (mong ${maMong})${chuDung ? "" : `, thiếu dấu hiệu "${dauHieu}"`}`);
    console.log(r.out.split("\n").slice(-16).map((l) => `      ${l}`).join("\n"));
  }
}

console.log("DIỄN TẬP PHỤC HỒI — Postgres local, schema giả, không chạm production\n");

// ══ 1. ĐỐI CHỨNG DƯƠNG: bản sao lành phải ĐẠT ══
// Không có ca này thì mọi ca "phải hỏng" bên dưới có thể chỉ đang chứng minh
// bộ soát luôn đỏ.
canh("[đc] bản sao lành, phục hồi đầy đủ → ĐẠT", banSaoTot(), null, 0, "PHỤC HỒI ĐẠT");

// ══ 2. Manifest thiếu bảng so với BANG[] ══
// Đây là cách hỏng NGUY NHẤT: bản sao khuyết tự so với manifest khuyết thì mọi
// con số khớp hoàn hảo. Chỉ bắt được nhờ đối chiếu với nguồn NGOÀI bản sao.
canh("manifest thiếu listing_media → HỎNG", banSaoTot(), {
  suaManifest: (m) => { m.bang = m.bang.filter((b) => b.bang !== "listing_media"); },
}, 1, "manifest THIẾU");

// ══ 3. Số dòng lệch: file có 2 dòng, DB chỉ nhận 1 ══
canh("xoá bớt 1 dòng messages sau khi nạp → HỎNG", banSaoTot(), {
  sauKhiNap: () => psql(`delete from public.messages where id='${U(51)}'`),
}, 1, "phục hồi 1 ≠ manifest 2");

// ══ 4. Dòng mồ côi mà catalog vẫn xanh ══
// Mô phỏng đúng lối phục hồi ẩu: tắt ràng buộc, nạp, rồi bật lại NOT VALID.
// pg_constraint sẽ báo hợp lệ trong khi dữ liệu đã thủng.
canh("khoá ngoại bị bỏ lại NOT VALID + có dòng mồ côi → HỎNG", banSaoTot(), {
  sauKhiNap: () => {
    psql(`alter table public.messages drop constraint messages_conversation_id_fkey`);
    psql(`insert into public.messages values ('${U(52)}','${U(99)}','bot','mo coi')`);
    psql(`alter table public.messages add constraint messages_conversation_id_fkey
          foreign key (conversation_id) references public.conversations(id) not valid`);
  },
}, 1, "MỒ CÔI");

// ══ 5. Bản sao tự khai là thiếu ══
canh("manifest khai trang_thai=thieu → TỪ CHỐI NẠP", banSaoTot(), {
  suaManifest: (m) => { m.bang.find((b) => b.bang === "messages").trang_thai = "thieu"; },
  napPhaiHong: true,
}, 1, "không đầy đủ");

// ══ 6. Cột trỏ sang auth.users có dữ liệu, mà auth.users không được sao lưu ══
canh("buyers.auth_user_id non-null (auth.users không có trong bản sao) → HỎNG",
  (() => { const d = banSaoTot(); d.buyers[0].auth_user_id = U(500); return d; })(), {
    napPhaiHong: true, // nạp gãy vì FK sang auth.users rỗng — đó chính là điều cần chứng minh
  }, 1, "buyers_auth_user_id_fkey");

// ══ 7. Sequence không được đẩy ══
canh("sequence bot_errors bị kéo lùi → HỎNG", banSaoTot(), {
  sauKhiNap: () => psql(`select setval('public.bot_errors_id_seq', 1, false)`),
}, 1, "đâm id trùng");

// ══ 8. Kho ảnh rỗng: file còn trong Storage mà không ai biết của tin nào ══
canh("listing_media VÀ media đều rỗng → HỎNG (OPEN-47)",
  (() => { const d = banSaoTot(); d.listing_media = []; d.media = []; return d; })(),
  null, 1, "không ai biết của tin nào");

// ══ 9. inbound_ledger kẹt 'processing' ══
canh("inbound_ledger kẹt processing → HỎNG",
  (() => { const d = banSaoTot(); d.inbound_ledger[0].status = "processing"; return d; })(),
  null, 1, "kẹt 'processing'");

// ══ 10. Manifest không liệt kê thứ cố ý bỏ ══
canh("manifest không nói thứ cố ý bỏ → HỎNG", banSaoTot(), {
  suaManifest: (m) => { delete m.khong_sao_luu; },
}, 1, "KHÔNG liệt kê thứ cố ý bỏ");

for (const d of rac) rmSync(d, { recursive: true, force: true });
try { psql(`drop database if exists ${DB} with (force)`, "postgres"); } catch { /* dọn được thì dọn */ }

console.log(`\n${"═".repeat(64)}`);
console.log(`ĐẠT ${dat} · HỎNG ${hong}`);
if (hong > 0) {
  console.log("\n\x1b[31mBỘ SOÁT PHỤC HỒI KHÔNG ĐÁNG TIN.\x1b[0m Sửa nó trước khi dùng để kết luận bất cứ điều gì.");
  process.exit(1);
}
console.log("\n\x1b[32mTỰ KIỂM ĐẠT\x1b[0m — bộ soát phân biệt được 'phục hồi được' với 'trông như phục hồi được'.");
console.log("Đây KHÔNG phải 'bản sao production đã phục hồi ĐẠT' — bài này dùng schema giả.");
