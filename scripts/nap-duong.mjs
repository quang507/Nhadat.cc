// nap-duong.mjs — nạp TỪ ĐIỂN TÊN ĐƯỜNG `duong` (FR-212, migration 20260921b) từ OpenStreetMap.
//
// Chủ dự án 21/09/2026: "giờ khách viết tên đường ko dấu hoặc sai 1 vài kí tự nhận ra
// dc ko" → "ok làm bảng duong đi, hẻm bỏ".
//
// LẤY GÌ: `way["highway"]["name"]` trên Overpass API, theo từng PHƯỜNG/XÃ MỚI trong bảng
// `wards` (đa giác `admin_level=6`, tên khớp `wards.ten_day_du`) → mỗi tên đường có phường
// mới + quận cũ + tỉnh cũ. Tây Ninh mới (gồm Long An) và Đồng Nai mới tra theo đa giác
// tỉnh (`admin_level=4`), chưa gán phường (`phuong = ''`).
//
// LỌC (cùng luật với lượt nạp đầu bằng SQL trong DB, 21/09/2026):
//   · bỏ tiền tố "Đường "/"Phố " khi sau nó là tên riêng viết hoa; giữ "Đường tỉnh 824";
//   · BỎ hẻm/ngõ/kiệt/nhánh/lối/cầu (hẻm bỏ — tên đường mẹ đã có); BỎ đường số ("Số 7",
//     "N1", "D2"); bỏ tên < 3 hay > 60 ký tự.
//
//   node scripts/nap-duong.mjs                 # cả ba tỉnh
//   node scripts/nap-duong.mjs --tinh "TP.HCM" # một tỉnh
//   node scripts/nap-duong.mjs --phuong "Phường Phú Định"   # một phường (thử / vá)
//   node scripts/nap-duong.mjs --dry           # xem trước, không ghi DB
//
// Cần SUPABASE_SERVICE_ROLE_KEY trong scripts/.env (bảng chỉ service_role đọc/ghi). Đi
// chậm có chủ đích: 1 truy vấn / 2 giây, lỗi 429/504 thì chờ rồi thử lại tối đa 4 lần —
// Overpass công cộng từ chối khi bị đấm dồn (lượt 21/09: bắn 168 phường một lúc, 101 hỏng).
// Chạy lại được: upsert theo khoá (ten, tinh, phuong).
// Cuối cùng ĐỐI CHIẾU số phường có dòng ↔ số phường đã tra rồi mới báo xong (NFR-18: một
// lượt PUT trả 200 không có nghĩa là dữ liệu nằm trong bảng).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(HERE, ".env"), "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
const URL_DB = env.SUPABASE_URL ?? "https://tbcdpupiarkuxtntmosl.supabase.co";
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error("Thiếu SUPABASE_SERVICE_ROLE_KEY trong scripts/.env"); process.exit(2); }
const OVERPASS = env.OVERPASS_URL ?? "https://overpass.kumi.systems/api/interpreter";
const UA = "nhadat.cc nap-duong (lien he: explore@nhadat.company)";
const NGAY = new Date().toISOString().slice(0, 10);

const args = process.argv.slice(2);
const co = (t) => args.includes(t);
const lay = (t) => { const i = args.indexOf(t); return i >= 0 ? args[i + 1] : null; };
const DRY = co("--dry");
const CHI_TINH = lay("--tinh");
const CHI_PHUONG = lay("--phuong");
// Hộp bao TP.HCM mới (gồm Bình Dương + Bà Rịa – Vũng Tàu) — chặn phường trùng tên ở tỉnh khác.
const BBOX_HCM = "10.30,106.30,11.50,107.70";
const TINH_LON = [["Tây Ninh", "Tỉnh Tây Ninh"], ["Đồng Nai", "Thành phố Đồng Nai"]];

const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

/** Một tên đường OSM → tên trong từ điển, hoặc null nếu bỏ (hẻm, đường số, rác). */
export function chuanTen(tho) {
  let t = String(tho ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  // "Đường Lý Thường Kiệt" → "Lý Thường Kiệt", "Đường 3 Tháng 2" → "3 Tháng 2"; giữ "Đường tỉnh 824"
  // (chữ thường sau tiền tố là loại đường, không phải tên). Cùng luật với SQL nạp lần đầu.
  t = t.replace(/^(?:Đường|Phố)\s+(?=[A-ZÀ-Ỹ0-9])/u, "");
  if (/^(?:Hẻm|Hem|Ngõ|Ngách|Kiệt|Nhánh|Lối|Cầu)(?![\p{L}])/iu.test(t)) return null;
  if (/(?:^|\s)Hẻm(?![\p{L}])/iu.test(t)) return null;
  if (/^(?:Đường\s+)?(?:số|so)?\s*\d+[A-Za-z]?$/iu.test(t)) return null;          // "Số 7", "Đường 10"
  if (/^(?:Đường\s+)?[A-Z]{1,2}\d+[A-Z]?$/u.test(t)) return null;                  // "N1", "D2", "TL10"
  if (!/[\p{L}]{2}/u.test(t)) return null;
  if (t.length < 3 || t.length > 60) return null;
  return t;
}

async function overpass(query, lan = 0) {
  const url = `${OVERPASS}?data=${encodeURIComponent(query)}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (r.status === 429 || r.status === 504 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
    if (!r.ok) { console.error(`  ! Overpass ${r.status}`); return null; }
    return await r.text();
  } catch (e) {
    if (lan >= 4) { console.error(`  ! ${e.message} — bỏ qua lượt này`); return null; }
    await nghi(15000 * (lan + 1));
    return overpass(query, lan + 1);
  }
}

async function rest(path, init = {}) {
  const r = await fetch(`${URL_DB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : await r.json();
}

async function ghi(rows) {
  if (!rows.length) return 0;
  if (DRY) return rows.length;
  for (let i = 0; i < rows.length; i += 500) {
    await rest("duong?on_conflict=ten,tinh,phuong", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
  }
  return rows.length;
}

/**
 * Đọc CSV Overpass "name\ttype" → { ten[], soArea } — soArea = số TÊN đa giác khác nhau (dòng type=area).
 * OSM hay có hai đối tượng area cùng tên cho một phường (relation + way biên) → vẫn là một phường;
 * hai TÊN khác nhau mới là trùng tên thật (lượt 21/09: 6 phường "trùng" hoá ra cùng tên).
 */
function docCsv(csv) {
  const ten = new Set(); const area = new Set();
  for (const dong of String(csv ?? "").split("\n")) {
    const [name, type] = dong.split("\t");
    if (type === "area") { area.add(name); continue; }
    const t = chuanTen(name); if (t) ten.add(t);
  }
  return { ten: [...ten], soArea: area.size };
}

const wards = await rest("wards?select=ten_day_du,quan_cu,tinh_cu&order=ten_day_du");
let daTra = 0, coDong = 0, tongDong = 0;

// 1) TP.HCM mới — từng phường/xã trong `wards`.
if (!CHI_TINH || CHI_TINH === "TP.HCM") {
  for (const w of wards) {
    if (CHI_PHUONG && w.ten_day_du !== CHI_PHUONG) continue;
    const q = `[out:csv(name,::type;false)][timeout:180];area["admin_level"="6"]["name"="${w.ten_day_du}"]->.a;way(area.a)(${BBOX_HCM})["highway"]["name"];out tags;.a out;`;
    const csv = await overpass(q); daTra++;
    if (csv == null) { console.log(`  ✗ ${w.ten_day_du}: không có trả lời`); await nghi(2000); continue; }
    const { ten, soArea } = docCsv(csv);
    if (soArea !== 1) { console.log(`  ✗ ${w.ten_day_du}: ${soArea} đa giác cùng tên trong hộp bao — bỏ, cần soi tay`); await nghi(2000); continue; }
    const n = await ghi(ten.map((t) => ({ ten: t, tinh: "TP.HCM", tinh_cu: w.tinh_cu, phuong: w.ten_day_du, quan_cu: w.quan_cu, nguon: `OSM Overpass ${NGAY} (way highway+name trong area phường)` })));
    if (n) coDong++; tongDong += n;
    console.log(`  ${w.ten_day_du} (${w.quan_cu}): ${n} tên đường`);
    await nghi(2000);
  }
}
// 2) Tây Ninh mới, Đồng Nai mới — theo đa giác tỉnh, chưa gán phường.
for (const [tinh, tenOsm] of TINH_LON) {
  if (CHI_PHUONG || (CHI_TINH && CHI_TINH !== tinh)) continue;
  const q = `[out:csv(name,::type;false)][timeout:900];area["admin_level"="4"]["name"="${tenOsm}"]->.a;way(area.a)["highway"]["name"];out tags;.a out;`;
  const csv = await overpass(q); daTra++;
  if (csv == null) { console.log(`  ✗ ${tenOsm}: không có trả lời`); continue; }
  const { ten } = docCsv(csv);
  const n = await ghi(ten.map((t) => ({ ten: t, tinh, tinh_cu: null, phuong: "", quan_cu: null, nguon: `OSM Overpass ${NGAY} (way highway+name trong area tỉnh)` })));
  if (n) coDong++; tongDong += n;
  console.log(`  ${tenOsm}: ${n} tên đường`);
}

// 3) Đối chiếu: đếm trong DB theo tỉnh và số phường có dòng.
if (!DRY) {
  const dem = await rest("duong?select=tinh,phuong", { headers: { Prefer: "count=exact" } });
  const theoTinh = {}; const phuongCo = new Set();
  for (const d of dem) { theoTinh[d.tinh] = (theoTinh[d.tinh] ?? 0) + 1; if (d.phuong) phuongCo.add(d.phuong); }
  console.log(`\nĐã tra ${daTra} đa giác, ${coDong} có dữ liệu, ghi/cập nhật ${tongDong} dòng.`);
  console.log(`Trong DB: ${JSON.stringify(theoTinh)}; ${phuongCo.size}/${wards.length} phường của wards có ít nhất một tên đường.`);
  if (phuongCo.size < wards.length) console.log("→ CHƯA XONG: còn phường không có dòng nào — chạy lại với --phuong \"<tên>\" hoặc soi tay.");
} else {
  console.log(`\n[dry] đã tra ${daTra} đa giác, sẽ ghi ${tongDong} dòng.`);
}
