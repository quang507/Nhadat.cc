#!/usr/bin/env node
// phuc-hoi.mjs — NẠP một bản sao của `sao-luu.mjs` vào một DB TRỐNG (staging
// hoặc Postgres local). KHÔNG BAO GIỜ chạy vào production.
//
// Dùng `psql` chứ không thêm gói nào: repo này không có client Postgres trong
// dependencies, và thêm một gói chỉ để chạy diễn tập là thêm thứ phải bảo trì.
//
//   node scripts/phuc-hoi.mjs <thư-mục-bản-sao> <chuỗi-kết-nối-đích>
//
// Ví dụ (Postgres local):
//   node scripts/phuc-hoi.mjs ~/nhadat-backup/2026-09-06 \
//        postgresql://postgres@localhost:5432/dien_tap
//
// ═══════════════ BA THỨ HỌC ĐƯỢC TỪ ĐỒ THỊ KHOÁ NGOẠI THẬT ═══════════════
// (đọc từ `pg_constraint` của DB thật ngày 06/09/2026, 35 khoá ngoại)
//
// 1. `sellers` ↔ `listings` LÀ MỘT VÒNG:
//        listings.seller_id        → sellers.id
//        sellers.active_listing_id → listings.id  (ON DELETE SET NULL)
//    Không có thứ tự nạp nào thoả cả hai nếu ràng buộc kiểm ngay từng dòng.
//    Nên script nạp trong MỘT giao dịch với `set constraints all deferred` —
//    ràng buộc chỉ kiểm lúc COMMIT, khi cả hai bảng đã đầy. Muốn thế thì khoá
//    ngoại phải DEFERRABLE; `schema.sql` sinh từ Supabase thì KHÔNG. Vì vậy
//    script tự hạ ràng buộc xuống deferrable trước khi nạp rồi trả lại sau —
//    và `soat-phuc-hoi.mjs` kiểm lại rằng chúng đã được trả lại.
//
// 2. `buyers`, `sellers`, `listing_views` TRỎ SANG `auth.users` — mà
//    `auth.users` KHÔNG nằm trong bản sao (cố ý, ghi trong manifest). Hôm nay
//    vô hại: cả ba cột `auth_user_id` đều NULL và `auth.users` rỗng. Nhưng
//    ngày có người đăng nhập thật thì phục hồi sẽ GÃY ở đúng chỗ này, và gãy
//    lúc đang chữa cháy. `soat-phuc-hoi.mjs` đếm số dòng non-null và kêu.
//
// 3. Nạp JSON KHÔNG đẩy sequence. Bảng nào dùng identity/serial thì sau phục
//    hồi, lượt INSERT kế tiếp đâm vào id đã tồn tại. Script gọi `setval` cho
//    mọi sequence sau khi nạp; bộ soát kiểm lại.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const [thuMuc, dsn] = process.argv.slice(2);
if (!thuMuc || !dsn) {
  console.error("Dùng: node scripts/phuc-hoi.mjs <thư-mục-bản-sao> <chuỗi-kết-nối-đích>");
  process.exit(2);
}

// ── Chặn cứng: không bao giờ nạp vào production ──────────────────────────────
// Nạp đè lên DB thật là mất sạch dữ liệu. Một dòng kiểm ở đây rẻ hơn nhiều lần
// một đêm không ngủ.
if (/supabase\.(co|com)/i.test(dsn) || /\bpooler\./i.test(dsn)) {
  console.error("TỪ CHỐI: chuỗi kết nối trỏ tới Supabase. Diễn tập chỉ chạy trên DB local/staging.");
  process.exit(2);
}

const psql = (sql, { doc = false } = {}) =>
  execFileSync("psql", [dsn, "-v", "ON_ERROR_STOP=1", ...(doc ? ["-tAc", sql] : ["-c", sql])],
    { encoding: "utf8", maxBuffer: 1 << 28 });

const psqlFile = (f) =>
  execFileSync("psql", [dsn, "-v", "ON_ERROR_STOP=1", "-f", f],
    { encoding: "utf8", maxBuffer: 1 << 28 });

const manifestPath = path.join(thuMuc, "manifest.json");
if (!existsSync(manifestPath)) {
  console.error(`Không thấy ${manifestPath} — đây có phải thư mục bản sao không?`);
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

// Bản sao có tự nhận là đủ không? Nạp một bản sao KHUYẾT rồi soát là tự lừa
// mình: mọi số sẽ khớp với chính cái manifest khuyết đó.
const hong = (manifest.bang ?? []).filter((b) => b.trang_thai !== "day_du");
if (hong.length) {
  console.error(`TỪ CHỐI: bản sao tự báo ${hong.length} bảng không đầy đủ:`);
  for (const b of hong) console.error(`   ${b.bang}: ${b.trang_thai}`);
  process.exit(1);
}

const schemaPath = path.join(thuMuc, "schema.sql");
if (!existsSync(schemaPath)) {
  console.error(`Không thấy ${schemaPath}. Bản sao không có ảnh chụp schema thì`);
  console.error("KHÔNG dựng lại được từ số không — đó là cả điểm của việc sao lưu.");
  process.exit(1);
}

console.log(`→ Dựng schema từ ${schemaPath}`);
psqlFile(schemaPath);

// Hạ mọi khoá ngoại xuống DEFERRABLE để nạp được vòng sellers↔listings.
console.log("→ Hạ khoá ngoại xuống deferrable (vòng sellers↔listings)");
psql(`do $$
declare r record;
begin
  for r in select conrelid::regclass as t, conname from pg_constraint
           where contype='f' and connamespace='public'::regnamespace and not condeferrable
  loop
    execute format('alter table %s alter constraint %I deferrable initially immediate', r.t, r.conname);
  end loop;
end $$;`);

const files = readdirSync(thuMuc).filter((f) => f.endsWith(".json") && f !== "manifest.json");
let tongDong = 0;
const sqlParts = ["begin;", "set constraints all deferred;"];

for (const b of manifest.bang) {
  const f = files.find((x) => x === `${b.file}`) ?? `${b.bang}.json`;
  const p = path.join(thuMuc, f);
  if (!existsSync(p)) {
    console.error(`TỪ CHỐI: manifest khai bảng ${b.bang} nhưng không có file ${f}`);
    process.exit(1);
  }
  const rows = JSON.parse(readFileSync(p, "utf8"));
  if (rows.length !== b.so_dong) {
    console.error(`TỪ CHỐI: ${b.bang} — file có ${rows.length} dòng, manifest khai ${b.so_dong}`);
    process.exit(1);
  }
  tongDong += rows.length;
  if (!rows.length) continue;
  // Nạp qua jsonb_populate_recordset: không phải tự sinh câu INSERT, không
  // phải tự thoát chuỗi, và cột thừa/thiếu lộ ra ngay chứ không âm thầm lệch.
  sqlParts.push(
    `insert into public.${b.bang} select * from jsonb_populate_recordset(null::public.${b.bang}, ${quote(JSON.stringify(rows))}::jsonb);`,
  );
}
sqlParts.push("commit;");

function quote(s) { return `'${s.replaceAll("'", "''")}'`; }

console.log(`→ Nạp ${manifest.bang.length} bảng, ${tongDong} dòng (một giao dịch, ràng buộc hoãn tới COMMIT)`);
const tmp = path.join(process.env.TMPDIR ?? "/tmp", `nap-${Date.now()}.sql`);
execFileSync("bash", ["-c", `cat > ${JSON.stringify(tmp)}`], { input: sqlParts.join("\n") });
psqlFile(tmp);

// Sequence: nạp JSON không đẩy con đếm. Không gọi setval thì lượt INSERT đầu
// tiên sau phục hồi đâm vào id đã có — hỏng sau khi mọi người đã tưởng xong.
console.log("→ Đẩy sequence theo max(id) đã nạp");
// Tham số thứ ba của setval đi qua %L chứ KHÔNG phải %s: format với %s trên
// một boolean sinh ra chữ t trần, và Postgres đọc t là TÊN CỘT —
// "column t does not exist". Diễn tập 06/09 bắt đúng lỗi này ở lượt chạy đầu.
psql(`do $$
declare r record; v_max bigint;
begin
  for r in
    select s.relname as seq, t.relname as tbl, a.attname as col
    from pg_class s
    join pg_depend d on d.objid = s.oid and d.classid = 'pg_class'::regclass
    join pg_class t on t.oid = d.refobjid
    join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
    join pg_namespace n on n.oid = t.relnamespace
    where s.relkind = 'S' and n.nspname = 'public'
  loop
    execute format('select coalesce(max(%I),0) from public.%I', r.col, r.tbl) into v_max;
    execute format('select setval(%L, greatest(%s,1), %L)', 'public.'||r.seq, v_max, v_max > 0);
  end loop;
end $$;`);

console.log(`\nNẠP XONG: ${manifest.bang.length} bảng · ${tongDong} dòng.`);
console.log("CHƯA phải 'phục hồi ĐẠT'. Chạy tiếp:");
console.log(`   node scripts/soat-phuc-hoi.mjs ${thuMuc} ${dsn}`);
