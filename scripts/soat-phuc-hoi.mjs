#!/usr/bin/env node
// soat-phuc-hoi.mjs — SOÁT một DB vừa được phục hồi. Đây là thứ quyết định
// được phép nói "phục hồi ĐẠT" hay không.
//
//   node scripts/soat-phuc-hoi.mjs <thư-mục-bản-sao> <chuỗi-kết-nối-đích>
//
// Mã thoát:  0 = ĐẠT · 1 = HỎNG · 2 = chưa soát được (thiếu đầu vào)
// Thoát 2 KHÔNG phải "đạt" — cùng luật với `test:sec`.
//
// ═══════════════════════════ LUẬT CỦA BÀI NÀY ═══════════════════════════
// Bài soát phục hồi rất dễ trở thành bài kiểm câm, vì nó tự so bản phục hồi
// với chính cái manifest của bản sao đó. Nếu bản sao thiếu ba bảng, manifest
// cũng thiếu ba bảng, và mọi con số sẽ khớp hoàn hảo. Nên:
//
//   · Nhóm A đối chiếu manifest với `BANG[]` trong `sao-luu.mjs` — NGUỒN NGOÀI
//     bản sao. Không có bước này thì A tự chứng minh chính nó.
//   · Nhóm C không tin `pg_constraint` nói "hợp lệ"; nó ĐẾM dòng mồ côi bằng
//     LEFT JOIN thật. Phục hồi mà tắt ràng buộc rồi bật lại `NOT VALID` thì
//     catalog vẫn xanh trong khi dữ liệu đã thủng.
//   · Nhóm F đếm ảnh ở CẢ `listing_media` LẪN `media`. Soát 06/09: DB thật có
//     `listing_media` = 0 dòng còn `media` = 1005 dòng — chỉ nhìn bảng được
//     nêu tên trong yêu cầu là bỏ sót toàn bộ kho ảnh.
//
// Mọi khẳng định "phải bằng 0" đều có ĐỐI CHỨNG DƯƠNG ở nhóm B: bảng phải có
// dòng thật. Không thì "0 mồ côi" chỉ đang chứng minh "DB rỗng".

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const [thuMuc, dsn] = process.argv.slice(2);
if (!thuMuc || !dsn) {
  console.error("Dùng: node scripts/soat-phuc-hoi.mjs <thư-mục-bản-sao> <chuỗi-kết-nối-đích>");
  process.exit(2);
}

const CRITICAL = ["inbound_ledger", "inbound_events", "listing_media",
                  "messages", "conversations", "buyers", "listings"];

let dat = 0, hong = 0;
const ok = (m) => { dat++; console.log(`  \x1b[32m✓\x1b[0m ${m}`); };
const no = (m) => { hong++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };
const nhom = (t) => console.log(`\n── ${t} ──`);

function q(sql) {
  try {
    return execFileSync("psql", [dsn, "-tAF", "-v", "ON_ERROR_STOP=1", "-c", sql],
      { encoding: "utf8", maxBuffer: 1 << 28 })
      .trim().split("\n").filter(Boolean).map((l) => l.split(""));
  } catch (e) {
    console.error(`\nKhông chạy được truy vấn trên DB đích: ${e.message.split("\n")[0]}`);
    process.exit(2);
  }
}
const q1 = (sql) => (q(sql)[0] ?? [""])[0];
// psql in boolean TRẦN là "t"/"f", nhưng `<bool>::text` ra "true"/"false".
// Bản đầu so với "t" ở chỗ đọc `convalidated::text` nên báo MỌI khoá ngoại là
// NOT VALID trên một DB hoàn toàn lành — diễn tập 06/09 bắt được. Nhận cả hai.
const dung = (v) => v === "t" || v === "true";

// ═══ A. Bản sao có ĐỦ không — đối chiếu với nguồn NGOÀI bản sao ═══
nhom("A. Bản sao (manifest ↔ BANG[] trong sao-luu.mjs)");
const mPath = path.join(thuMuc, "manifest.json");
if (!existsSync(mPath)) { console.error(`Không thấy ${mPath}`); process.exit(2); }
const manifest = JSON.parse(readFileSync(mPath, "utf8"));
const trongManifest = new Set(manifest.bang.map((b) => b.bang));

const src = readFileSync(new URL("./sao-luu.mjs", import.meta.url), "utf8");
const khoi = src.match(/const BANG = \[([\s\S]*?)\];/);
if (!khoi) { console.error("Không đọc được BANG[] từ sao-luu.mjs"); process.exit(2); }
const BANG = [...khoi[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);

const thieu = BANG.filter((b) => !trongManifest.has(b));
thieu.length ? no(`manifest THIẾU ${thieu.length} bảng so với BANG[]: ${thieu.join(", ")}`)
             : ok(`manifest có đủ ${BANG.length} bảng của BANG[]`);

const xau = manifest.bang.filter((b) => b.trang_thai !== "day_du");
xau.length ? no(`${xau.length} bảng trạng thái khác day_du: ${xau.map((b) => `${b.bang}=${b.trang_thai}`).join(", ")}`)
           : ok("mọi bảng trong manifest ở trạng thái day_du");

const boQua = manifest.khong_sao_luu ?? manifest.KHONG_SAO_LUU;
boQua && Object.keys(boQua).length
  ? ok(`manifest nói rõ ${Object.keys(boQua).length} thứ CỐ Ý không sao lưu (${Object.keys(boQua).join(", ")})`)
  : no("manifest KHÔNG liệt kê thứ cố ý bỏ — 'không thấy' và 'cố ý bỏ' nhìn giống hệt nhau lúc chữa cháy");

// ═══ B. Số dòng + đối chứng dương ═══
nhom("B. Số dòng phục hồi ↔ manifest");
let tongDong = 0, lech = 0;
for (const b of manifest.bang) {
  const co = q1(`select to_regclass('public.${b.bang}') is not null`);
  if (!dung(co)) { no(`${b.bang}: KHÔNG TỒN TẠI trong DB đích`); continue; }
  const n = Number(q1(`select count(*) from public.${b.bang}`));
  tongDong += n;
  if (n !== b.so_dong) { no(`${b.bang}: phục hồi ${n} ≠ manifest ${b.so_dong}`); lech++; }
}
lech === 0 && ok(`${manifest.bang.length} bảng khớp số dòng, tổng ${tongDong} dòng`);
// ĐỐI CHỨNG DƯƠNG: không có dòng nào thì mọi phép "0 mồ côi" bên dưới vô nghĩa.
tongDong > 0 ? ok(`[đc] DB đích có dữ liệu thật (${tongDong} dòng) — các phép "= 0" bên dưới mới có nghĩa`)
             : no("[đc] DB đích RỖNG — mọi kiểm tra toàn vẹn bên dưới chỉ đang đo sự trống rỗng");

// ═══ C. Khoá ngoại — đếm mồ côi THẬT, không tin catalog ═══
nhom("C. Toàn vẹn khoá ngoại (đếm dòng mồ côi, không tin pg_constraint)");
const fks = q(`select conrelid::regclass::text, confrelid::regclass::text,
      (select attname from pg_attribute where attrelid=conrelid and attnum=conkey[1]),
      (select attname from pg_attribute where attrelid=confrelid and attnum=confkey[1]),
      convalidated::text, array_length(conkey,1)::text
   from pg_constraint where contype='f' and connamespace='public'::regnamespace`);
let moCoi = 0, chuaXacThuc = 0;
for (const [con, cha, cot, cotCha, hopLe, nCot] of fks) {
  if (!dung(hopLe)) { chuaXacThuc++; no(`${con}.${cot} → ${cha}: ràng buộc NOT VALID (catalog xanh nhưng chưa ai kiểm dữ liệu)`); }
  if (nCot !== "1") continue; // khoá nhiều cột: bỏ qua, repo này chưa có cái nào
  if (!cha.startsWith("auth.")) {
    const n = Number(q1(`select count(*) from public.${con.replace(/^public\./, "")} c
      left join ${cha} p on p.${cotCha} = c.${cot}
      where c.${cot} is not null and p.${cotCha} is null`));
    if (n > 0) { moCoi++; no(`${con}.${cot} → ${cha}: ${n} dòng MỒ CÔI`); }
  }
}
moCoi === 0 && ok(`${fks.length} khoá ngoại: 0 dòng mồ côi`);
chuaXacThuc === 0 && ok("mọi khoá ngoại đều VALIDATED (không cái nào bị bỏ lại NOT VALID sau khi nạp)");

// ═══ D. Bảng tham chiếu auth.users — thứ KHÔNG có trong bản sao ═══
nhom("D. Cột trỏ sang auth.users (auth.users CỐ Ý không sao lưu)");
for (const [bang, cot] of [["buyers", "auth_user_id"], ["sellers", "auth_user_id"], ["listing_views", "auth_user_id"]]) {
  if (!dung(q1(`select to_regclass('public.${bang}') is not null`))) { no(`${bang}: bảng không tồn tại trong DB đích`); continue; }
  // Kiểm CỘT tồn tại chứ không chỉ bảng: thiếu cột thì câu dưới ném lỗi và cả
  // bộ soát thoát 2 ("chưa soát được") — biến một phát hiện thành một sự im
  // lặng. Thiếu cột là một PHÁT HIỆN, phải nói ra chứ không được nuốt.
  const coCot = q1(`select count(*) from information_schema.columns
     where table_schema='public' and table_name='${bang}' and column_name='${cot}'`);
  if (coCot === "0") { no(`${bang}.${cot}: CỘT KHÔNG TỒN TẠI sau phục hồi — schema đích lệch với schema nguồn`); continue; }
  const n = Number(q1(`select count(*) from public.${bang} where ${cot} is not null`));
  n === 0
    ? ok(`${bang}.${cot}: 0 dòng non-null — phục hồi không phụ thuộc auth.users`)
    : no(`${bang}.${cot}: ${n} dòng trỏ sang auth.users mà bản sao KHÔNG có. Phục hồi sẽ gãy ở đây, hoặc mất liên kết tài khoản. Phải sao lưu auth.users, hoặc chấp nhận và ghi vào manifest.`);
}

// ═══ E. Trạng thái bot — sổ idempotency phải dùng được ngay sau phục hồi ═══
nhom("E. Trạng thái bot (inbound_ledger · inbound_events · chat_quota)");
const HOP_LE = ["received", "processing", "completed", "failed", "dead"];
const la = q(`select distinct status from public.inbound_ledger where status is not null`).map((r) => r[0]);
const laLa = la.filter((s) => !HOP_LE.includes(s));
laLa.length ? no(`inbound_ledger có trạng thái lạ: ${laLa.join(", ")}`)
            : ok(`inbound_ledger: ${la.length} trạng thái, đều hợp lệ (${la.join(", ") || "bảng rỗng"})`);

const ketProc = Number(q1(`select count(*) from public.inbound_ledger where status='processing'`));
ketProc === 0
  ? ok("inbound_ledger: 0 dòng kẹt 'processing' — bot chạy lại là nhận việc ngay")
  : no(`inbound_ledger: ${ketProc} dòng kẹt 'processing'. Sau phục hồi chúng chỉ được giành lại sau 150 s stale-window; nếu updated_at cũng phục hồi cũ thì chúng tự thoát, nhưng phải biết là có.`);

const kPk = Number(q1(`select count(*) from public.inbound_ledger where zalo_msg_id is null`));
kPk === 0 ? ok("inbound_ledger: mọi dòng có zalo_msg_id (khoá chính idempotency)")
          : no(`inbound_ledger: ${kPk} dòng thiếu zalo_msg_id`);

const trung = Number(q1(`select count(*) from (select event_id from public.inbound_events group by 1 having count(*)>1) t`));
trung === 0 ? ok("inbound_events: event_id không trùng")
            : no(`inbound_events: ${trung} event_id bị trùng — sổ sự kiện mất tính idempotent`);

// ═══ F. Ảnh ↔ tin — kiểm CẢ HAI bảng ═══
nhom("F. Siêu dữ liệu tin & ảnh (listing_media VÀ media)");
for (const bang of ["listing_media", "media"]) {
  if (!dung(q1(`select to_regclass('public.${bang}') is not null`))) { no(`${bang}: không tồn tại`); continue; }
  const n = Number(q1(`select count(*) from public.${bang}`));
  const mc = Number(q1(`select count(*) from public.${bang} m left join public.listings l on l.id=m.listing_id where m.listing_id is not null and l.id is null`));
  const cotDuongDan = q1(`select attname from pg_attribute where attrelid='public.${bang}'::regclass and attname in ('storage_path','url','path') limit 1`);
  const rong = cotDuongDan
    ? Number(q1(`select count(*) from public.${bang} where coalesce(${cotDuongDan},'')=''`)) : -1;
  if (mc > 0) no(`${bang}: ${mc}/${n} dòng trỏ tới listing không tồn tại`);
  else if (n === 0) console.log(`  \x1b[33m•\x1b[0m ${bang}: 0 dòng — không kết luận được gì (xem ghi chú dưới)`);
  else ok(`${bang}: ${n} dòng, 0 mồ côi`);
  if (rong > 0) no(`${bang}.${cotDuongDan}: ${rong} dòng rỗng — file có trong Storage mà không ai biết của tin nào`);
  else if (rong === 0 && n > 0) ok(`${bang}.${cotDuongDan}: không dòng nào rỗng`);
}
const tinCoAnh = Number(q1(`select count(distinct listing_id) from (
  select listing_id from public.listing_media union all select listing_id from public.media) t
  where listing_id is not null`));
const tongTin = Number(q1(`select count(*) from public.listings`));
tinCoAnh > 0 ? ok(`[đc] ${tinCoAnh}/${tongTin} tin có ít nhất một ảnh — bản đồ ảnh↔tin sống sót qua phục hồi`)
             : no(`[đc] 0/${tongTin} tin có ảnh. File trong Storage còn nguyên mà không ai biết của tin nào (OPEN-47).`);

// ═══ G. Hội thoại — chuỗi buyers → conversations → messages ═══
nhom("G. Chuỗi hội thoại (buyers → conversations → messages)");
const mMoCoi = Number(q1(`select count(*) from public.messages m left join public.conversations c on c.id=m.conversation_id where c.id is null`));
mMoCoi === 0 ? ok("messages: mọi dòng thuộc về một conversation có thật") : no(`messages: ${mMoCoi} dòng mồ côi`);
const cMoCoi = Number(q1(`select count(*) from public.conversations c left join public.buyers b on b.id=c.buyer_id where c.buyer_id is not null and b.id is null`));
cMoCoi === 0 ? ok("conversations: mọi buyer_id trỏ tới buyer có thật") : no(`conversations: ${cMoCoi} dòng mồ côi`);
const hthoaiRong = Number(q1(`select count(*) from public.conversations c where not exists (select 1 from public.messages m where m.conversation_id=c.id)`));
console.log(`  \x1b[33m•\x1b[0m conversations không có tin nhắn nào: ${hthoaiRong} (không phải lỗi — hội thoại vừa mở thì rỗng)`);

// ═══ H. Sequence — nạp JSON không đẩy con đếm ═══
nhom("H. Sequence sau phục hồi (INSERT kế tiếp có đâm vào id cũ không)");
const seqXau = q(`select s.relname, t.relname, a.attname,
     (select last_value from pg_sequences where schemaname='public' and sequencename=s.relname)
   from pg_class s
   join pg_depend d on d.objid=s.oid and d.classid='pg_class'::regclass
   join pg_class t on t.oid=d.refobjid
   join pg_attribute a on a.attrelid=t.oid and a.attnum=d.refobjsubid
   join pg_namespace n on n.oid=t.relnamespace
   where s.relkind='S' and n.nspname='public'`);
let seqHong = 0;
for (const [seq, tbl, col, last] of seqXau) {
  const mx = Number(q1(`select coalesce(max(${col}),0) from public.${tbl}`));
  if (mx > Number(last ?? 0)) { seqHong++; no(`sequence ${seq}: last_value=${last} < max(${tbl}.${col})=${mx} → INSERT kế tiếp sẽ đâm id trùng`); }
}
seqXau.length === 0 ? console.log("  \x1b[33m•\x1b[0m không có sequence nào trong public (khoá đều là uuid) — không có gì để lệch")
  : seqHong === 0 && ok(`${seqXau.length} sequence đều đã được đẩy qua max(id)`);

// ═══ Kết ═══
console.log(`\n${"═".repeat(64)}`);
console.log(`ĐẠT ${dat} · HỎNG ${hong}`);
if (hong > 0) {
  console.log("\n\x1b[31mPHỤC HỒI CHƯA ĐẠT.\x1b[0m Không được ghi 'restore VERIFIED' ở bất kỳ đâu.");
  process.exit(1);
}
console.log("\n\x1b[32mPHỤC HỒI ĐẠT\x1b[0m — bản sao này dựng lại được và dữ liệu còn toàn vẹn.");
console.log("Phạm vi: chỉ những gì nằm TRONG bản sao. Storage (file ảnh), auth.users,");
console.log("vault.secrets, cron.job, edge function KHÔNG nằm trong đây — xem manifest.");
