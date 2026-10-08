#!/usr/bin/env node
// dung-lai-db.mjs — DỰNG LẠI DB từ số không trên một project Supabase RỖNG (08/10/2026).
//
// Vì sao có: project production cũ bị xoá nhầm 08/10/2026 (gói Free, không sao lưu). Quy trình tay ở
// bot/README.md §Dựng lại từ số không chưa từng diễn tập; script này làm đúng các bước đó qua Management API
// (`SUPABASE_ACCESS_TOKEN`, chạy trong apply-migration.yml), từng bước một, in SỐ ĐẾM chứ không in dữ liệu
// (log Actions công khai).
//
//   TOKEN=… PROJECT_REF=… node scripts/dung-lai-db.mjs <bước>
//   kiem      chỉ đọc: phiên bản Postgres, event trigger, số bảng public — xem token có vào được project không
//   cau-truc  gỡ event trigger "tự bật RLS" của dashboard (nó bật RLS cả bảng production cố ý để tắt), rồi:
//             20260929b (schema luu_tru) → schema.sql → 20261008a → ba file schema `so`
//   du-lieu   dữ liệu tham chiếu KHÔNG nằm trong schema.sql: chạy lại theo thứ tự file mọi câu insert/update/delete
//             trên wards, phuong_cu, quan_cu, required_facts, app_config trong migrations/ (chỉ các câu đó — câu tạo
//             hàm trong migration cũ là bản cũ, chạy lại là đè bản mới của schema.sql). Mã project cũ trong câu được
//             thay bằng mã mới. Sau cùng đặt các khoá app_config phụ thuộc project + công tắc production.
//   xac-minh  đếm dòng các bảng tham chiếu, in required_facts (khoá công khai, đã có trong mock e2e) để đối chiếu
//
// Câu lỗi KHÔNG dừng cả bước: in mã lỗi + 120 chữ đầu của câu, chạy tiếp, cuối bước chạy lại lượt hai các câu lỗi
// (view chồng view phải tạo sau view nó dựa vào). Còn lỗi sau lượt hai thì thoát 1.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIG = join(GOC, "bot", "supabase", "migrations");
const TOKEN = (process.env.TOKEN ?? process.env.SUPABASE_ACCESS_TOKEN ?? "").trim();
const REF = (process.env.PROJECT_REF ?? "").trim();
const REF_CU = "tbcdpupiarkuxtntmosl";
const PUBLISHABLE = (process.env.PUBLISHABLE_KEY ?? "").trim();
const buoc = process.argv[2];
if (!TOKEN || !/^[a-z]{20}$/.test(REF)) { console.error("Thiếu TOKEN hoặc PROJECT_REF"); process.exit(2); }
if (REF === REF_CU) { console.error("PROJECT_REF vẫn là mã project cũ"); process.exit(2); }

async function sql(query, readOnly = false) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(readOnly ? { query, read_only: true } : { query }),
  });
  const t = await r.text();
  if (!r.ok) { const e = new Error(`HTTP ${r.status} ${t.slice(0, 300)}`); e.status = r.status; throw e; }
  try { return JSON.parse(t); } catch { return t; }
}

// Tách SQL thành từng câu: tôn trọng '…' (kể cả E'…\''), "…", $tag$…$tag$, -- và /* */.
export function tachCau(s) {
  const out = [];
  let i = 0, dau = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i], c2 = s.slice(i, i + 2);
    if (c2 === "--") { const j = s.indexOf("\n", i); i = j < 0 ? n : j + 1; continue; }
    if (c2 === "/*") { const j = s.indexOf("*/", i + 2); i = j < 0 ? n : j + 2; continue; }
    if (c === "'") {
      const e = i > 0 && /[eE]/.test(s[i - 1]) && !/[a-zA-Z0-9_]/.test(s[i - 2] ?? "");
      i++;
      while (i < n) {
        if (e && s[i] === "\\") { i += 2; continue; }
        if (s[i] === "'") { if (s[i + 1] === "'") { i += 2; continue; } i++; break; }
        i++;
      }
      continue;
    }
    if (c === '"') { const j = s.indexOf('"', i + 1); i = j < 0 ? n : j + 1; continue; }
    if (c === "$") {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(s.slice(i, i + 64));
      if (m && !/[A-Za-z0-9_]/.test(s[i - 1] ?? "")) {
        const j = s.indexOf(m[0], i + m[0].length);
        i = j < 0 ? n : j + m[0].length;
        continue;
      }
    }
    if (c === ";") { const cau = s.slice(dau, i).trim(); if (cau) out.push(cau); dau = i + 1; }
    i++;
  }
  const cuoi = s.slice(dau).trim();
  if (cuoi && !/^(--[^\n]*\n?\s*)*$/.test(cuoi)) out.push(cuoi);
  return out;
}

const boChuThich = (c) => c.replace(/^(\s*--[^\n]*\n)+/, "").trim();
const dau120 = (c) => boChuThich(c).replace(/\s+/g, " ").slice(0, 120);

// Gửi một dãy câu: gom thành khối ≤ 120 KB cho nhanh; khối lỗi thì chạy lẻ từng câu để biết câu nào.
async function chay(ten, caus) {
  console.log(`\n▶ ${ten}: ${caus.length} câu`);
  const loi = [];
  let khoi = [], co = 0;
  const xa = async () => {
    if (!khoi.length) return;
    const ds = khoi; khoi = []; co = 0;
    try { await sql(ds.join(";\n") + ";"); }
    catch {
      for (const c of ds) { try { await sql(c + ";"); } catch (e) { loi.push({ c, e: String(e.message) }); } }
    }
  };
  for (const c of caus) {
    if (co + c.length > 120_000) await xa();
    khoi.push(c); co += c.length;
  }
  await xa();
  if (loi.length) {
    console.log(`  ${loi.length} câu lỗi lượt một — chạy lại lượt hai`);
    const con = [];
    for (const x of loi) { try { await sql(x.c + ";"); } catch (e) { con.push({ c: x.c, e: String(e.message) }); } }
    for (const x of con) console.log(`  ✗ ${dau120(x.c)}\n    ${x.e.replace(/\s+/g, " ").slice(0, 240)}`);
    console.log(`  ${caus.length - con.length}/${caus.length} câu xong`);
    return con.length;
  }
  console.log(`  ${caus.length}/${caus.length} câu xong`);
  return 0;
}

// Khoá publishable CŨ còn ghi cứng trong vài hàm (schema.sql) và migration — thay bằng khoá mới (khoá công khai).
const PUB_CU = "sb_publishable_zmJBmEgFPn3bBKx_1ve6Pg_dXdo4haX";
const docFile = (p) => {
  const s = readFileSync(p, "utf8").replaceAll(REF_CU, REF);
  return /^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(PUBLISHABLE) ? s.replaceAll(PUB_CU, PUBLISHABLE) : s;
};
const fileMig = (tien) => { const f = readdirSync(MIG).find((x) => x.startsWith(tien)); if (!f) throw new Error(`không thấy migration ${tien}`); return join(MIG, f); };

if (buoc === "kiem") {
  console.log(await sql("select version() as v", true));
  console.log("event trigger:", JSON.stringify(await sql(
    "select e.evtname, e.evtevent, p.proname, n.nspname from pg_event_trigger e join pg_proc p on p.oid = e.evtfoid join pg_namespace n on n.oid = p.pronamespace order by 1", true)));
  console.log("bảng public:", JSON.stringify(await sql("select count(*)::int as n from pg_tables where schemaname = 'public'", true)));
  console.log("extension có sẵn:", JSON.stringify(await sql(
    "select name, installed_version from pg_available_extensions where name in ('pg_cron','pg_net','vector','http','fuzzystrmatch','supabase_vault','pgcrypto','uuid-ossp','pg_stat_statements') order by 1", true)));
} else if (buoc === "cau-truc") {
  // Event trigger dashboard tạo khi tick "Enable automatic RLS": chỉ gỡ cái có hàm mang chữ rls, in tên trước.
  const et = await sql("select e.evtname, p.proname from pg_event_trigger e join pg_proc p on p.oid = e.evtfoid where p.proname ilike '%rls%' or e.evtname ilike '%rls%'");
  for (const r of et) { console.log(`gỡ event trigger ${r.evtname} (hàm ${r.proname})`); await sql(`drop event trigger if exists "${r.evtname}"`); }
  let hong = 0;
  hong += await chay("20260929b (schema luu_tru)", tachCau(docFile(fileMig("20260929b"))));
  hong += await chay("schema.sql", tachCau(docFile(join(GOC, "bot", "supabase", "schema.sql"))));
  hong += await chay("20261008a", tachCau(docFile(fileMig("20261008a"))));
  for (const t of ["20260907c", "20260907f", "20260907g"]) hong += await chay(`${t} (schema so)`, tachCau(docFile(fileMig(t))));
  console.log(`\nbảng public: ${JSON.stringify(await sql("select count(*)::int as n from pg_tables where schemaname = 'public'", true))}`);
  process.exit(hong ? 1 : 0);
} else if (buoc === "du-lieu") {
  const BANG = "(?:public\\.)?(wards|phuong_cu|quan_cu|required_facts|app_config)\\b";
  const laDuLieu = new RegExp(`^(insert\\s+into\\s+${BANG}|update\\s+${BANG}|delete\\s+from\\s+${BANG})`, "i");
  const files = readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort();
  const caus = [];
  for (const f of files) for (const c of tachCau(docFile(join(MIG, f)))) { const b = boChuThich(c); if (laDuLieu.test(b)) caus.push(b); }
  // Câu dữ liệu cũ có thể nhắc cột / giá trị không còn — lỗi thì in ra, đọc, không dừng.
  let hong = await chay("dữ liệu tham chiếu từ migrations", caus);
  const base = `https://${REF}.supabase.co`;
  const dat = [
    ["functions_base_url", `${base}/functions/v1`],
    ["storage_public_base_url", `${base}/storage/v1/object/public`],
    // Công tắc production lúc bị xoá (CLAUDE.md §6, bản tóm tắt phiên 08/10/2026).
    ["boc_tach_ai", "ai"], ["luat_loi_bot", "gon"], ["bao_lai_da_luu", "admin"],
  ];
  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(PUBLISHABLE)) dat.push(["publishable_key", PUBLISHABLE]);
  else console.log("  (không có PUBLISHABLE_KEY — app_config.publishable_key chưa đặt)");
  const q = (v) => `'${String(v).replaceAll("'", "''")}'`;
  hong += await chay("app_config theo project mới", dat.map(([k, v]) =>
    `insert into public.app_config (key, value) values (${q(k)}, ${q(v)}) on conflict (key) do update set value = excluded.value`));
  process.exit(hong ? 1 : 0);
} else if (buoc === "xac-minh") {
  for (const t of ["wards", "phuong_cu", "quan_cu", "required_facts", "app_config", "duong", "bot_prompts"]) {
    const r = await sql(`select count(*)::int as n from public.${t}`, true).catch((e) => [{ n: `lỗi ${e.message.slice(0, 80)}` }]);
    console.log(`${t}: ${r[0]?.n}`);
  }
  console.log("required_facts:", JSON.stringify(await sql(
    "select property_type::text as l, fact_key as k, priority as p, nhom as g, deal::text as d from public.required_facts order by 1, 3, 2", true)));
  console.log("app_config khoá:", JSON.stringify((await sql("select key from public.app_config order by 1", true)).map((r) => r.key)));
  console.log("cron:", JSON.stringify(await sql("select jobname, schedule from cron.job order by 1", true).catch((e) => e.message.slice(0, 120))));
  console.log("bucket:", JSON.stringify(await sql("select id, public from storage.buckets order by 1", true)));
} else {
  console.error("Bước: kiem | cau-truc | du-lieu | xac-minh");
  process.exit(2);
}
