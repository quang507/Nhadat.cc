#!/usr/bin/env node
// Đẩy ảnh thật từ máy local lên bucket `listing-photos` của Supabase (FR-148).
//
// CHẠY TRÊN MÁY MÀY, không deploy. Ảnh gốc (masterDB/) nằm ngoài git — script
// này chỉ đọc, không bao giờ copy nội dung ảnh vào repo.
//
//   cd <repo>
//   set SUPABASE_SERVICE_ROLE_KEY=<service_role key>     (Windows cmd)
//   export SUPABASE_SERVICE_ROLE_KEY=<service_role key>  (macOS/Linux)
//   node scripts/up-anh.mjs "D:\masterDB\photos" --dry     ← xem trước, KHÔNG đẩy
//   node scripts/up-anh.mjs "D:\masterDB\photos"           ← đẩy thật
//
// Cấu trúc thư mục nguồn: mỗi TIN một thư mục con, tên là STT trong masterDB
// (1, 2, 007…) hoặc thẳng mã tin (BDS-Q5-0007). Script tự quy đổi STT → mã:
// `listings.legacy_sst` = STT, `code` = 'BDS-Q5-' + STT đệm 4 số.
//
// Đích: listing-photos/<MÃ TIN>/<tên file>. View `listing_photos_v` cắt đoạn
// trước dấu '/' làm mã tin, nên PHẢI có đúng một cấp thư mục — để ảnh ở gốc
// bucket là web không thấy.
//
// Có `sharp` thì tự nén còn ngang ≤2500px / JPEG q80 (masterDB ~179MB, đẩy
// nguyên bản là trang chi tiết tải nặng và ăn hết dung lượng free tier).
// Không có sharp cũng chạy, chỉ cảnh báo file nặng:  bun add -d sharp
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SRC = process.argv[2];
const DRY = process.argv.includes("--dry");
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://tbcdpupiarkuxtntmosl.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SRC) {
  console.error("Thiếu thư mục nguồn.\n  node scripts/up-anh.mjs <thư-mục-ảnh> [--dry]");
  process.exit(1);
}
if (!KEY && !DRY) {
  console.error("Thiếu SUPABASE_SERVICE_ROLE_KEY trong env (Dashboard → Settings → API).");
  process.exit(1);
}

let sharp = null;
try { sharp = (await import("sharp")).default; } catch { /* không có thì thôi */ }

const db = KEY ? createClient(URL, KEY) : null;
const OK_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// Tên thư mục → mã tin. Nhận cả 'BDS-Q5-0007', '7', '007'.
const dest0 = (code, file, ext) => `${code}/${path.parse(file).name.toLowerCase()}${ext}`;
const toCode = (dir) => {
  const s = dir.trim();
  if (/^BDS-Q5-\d{4}$/i.test(s)) return s.toUpperCase();
  const n = /^0*(\d{1,4})$/.exec(s);
  return n ? `BDS-Q5-${n[1].padStart(4, "0")}` : null;
};

// Đối chiếu với DB: mã nào không có tin thật thì bỏ, đừng đẩy rác lên bucket.
let known = null;
if (db) {
  const { data, error } = await db.from("listings").select("code");
  if (error) { console.error("Không đọc được bảng listings:", error.message); process.exit(1); }
  known = new Set(data.map((r) => r.code));
}

const dirs = fs.readdirSync(SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => d.name).sort();
if (!dirs.length) {
  console.error(`Không thấy thư mục con nào trong ${SRC}. Mỗi tin phải một thư mục.`);
  process.exit(1);
}

let nUp = 0, nSkip = 0, nBad = 0, bytes = 0;
for (const dir of dirs) {
  const code = toCode(dir);
  if (!code) { console.warn(`⚠ bỏ qua "${dir}" — không đọc ra mã tin`); nBad++; continue; }
  if (known && !known.has(code)) { console.warn(`⚠ bỏ qua "${dir}" → ${code} — không có tin này trong DB`); nBad++; continue; }

  const files = fs.readdirSync(path.join(SRC, dir))
    .filter((f) => OK_EXT.has(path.extname(f).toLowerCase())).sort();
  if (!files.length) continue;

  for (const f of files) {
    const src = path.join(SRC, dir, f);
    const ext = path.extname(f).toLowerCase();
    let buf = fs.readFileSync(src);
    // Có sharp thì mọi thứ ra JPEG. Không có sharp thì GIỮ NGUYÊN đuôi + kiểu
    // gốc — đổi tên .png thành .jpg mà nội dung vẫn là PNG là trình duyệt cãi.
    let outExt = ext === ".jpeg" ? ".jpg" : ext;
    let mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[ext];
    if (sharp) {
      buf = await sharp(buf).rotate()
        .resize({ width: 2500, withoutEnlargement: true })
        .jpeg({ quality: 80 }).toBuffer();
      outExt = ".jpg"; mime = "image/jpeg";
    } else if (buf.length > 600_000) {
      console.warn(`⚠ ${dest0(code, f, outExt)} nặng ${(buf.length / 1e6).toFixed(1)}MB — nên cài sharp để nén`);
    }
    const dest = dest0(code, f, outExt);
    bytes += buf.length;
    if (DRY) { console.log(`(thử) ${src}  →  ${dest}  ${(buf.length / 1024).toFixed(0)}KB`); nUp++; continue; }
    const { error } = await db.storage.from("listing-photos")
      .upload(dest, buf, { contentType: mime, upsert: true });
    if (error) { console.error(`✗ ${dest}: ${error.message}`); nSkip++; }
    else { console.log(`✓ ${dest}`); nUp++; }
  }
}

console.log(
  `\n${DRY ? "THỬ — chưa đẩy gì cả" : "Xong"}: ${nUp} ảnh, ` +
  `${(bytes / 1e6).toFixed(1)}MB${nSkip ? `, ${nSkip} lỗi` : ""}${nBad ? `, ${nBad} thư mục bỏ qua` : ""}.` +
  (sharp ? "" : "\n(không có sharp → đẩy nguyên bản, ảnh nặng thì web tải chậm)") +
  (DRY ? "\nƯng thì bỏ --dry chạy lại." : "\nWeb tự hiện ảnh sau ≤5 phút (ISR revalidate 300s).")
);
