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
// Đích (FR-165): listing-public/<LISTING UUID>/<MEDIA UUID>.<đuôi>, kèm MỘT
// dòng `listing_media` cho mỗi file. Đường dẫn neo vào ID BẤT BIẾN của tin chứ
// không vào mã tin: mã đổi được, mà đổi mã theo lối cũ là toàn bộ ảnh rơi khỏi
// tin, âm thầm. Thư mục nguồn vẫn đặt tên theo STT/mã như cũ — script tự tra ra
// UUID, mày không phải đổi thói quen.
//
// Thứ tự ảnh KHÔNG còn theo tên file (xếp tên thì "1, 10, 2"): số trong tên file
// được đọc thành `sort_order`, hết số thì rơi về thứ tự đọc thư mục. Ảnh bìa do
// DB tự chọn (tấm sort_order nhỏ nhất) — không cần đặt tên file cho khéo.
//
// Có `sharp` thì tự nén còn ngang ≤2500px / JPEG q80 (masterDB ~179MB, đẩy
// nguyên bản là trang chi tiết tải nặng và ăn hết dung lượng free tier).
// Không có sharp cũng chạy, chỉ cảnh báo file nặng:  bun add -d sharp
import fs from "node:fs";
import { randomUUID } from "node:crypto";
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
// Số trong tên file → sort_order ("03.jpg" → 3, "anh-2.png" → 2). Không có số
// thì trả null, để thứ tự đọc thư mục quyết định.
const thuTuTuTen = (file) => {
  const m = /(\d+)/.exec(path.parse(file).name);
  return m ? parseInt(m[1], 10) : null;
};
const toCode = (dir) => {
  const s = dir.trim();
  if (/^BDS-Q5-\d{4}$/i.test(s)) return s.toUpperCase();
  const n = /^0*(\d{1,4})$/.exec(s);
  return n ? `BDS-Q5-${n[1].padStart(4, "0")}` : null;
};

// Đối chiếu với DB: mã nào không có tin thật thì bỏ, đừng đẩy rác lên bucket.
let known = null;
if (db) {
  const { data, error } = await db.from("listings").select("id, code");
  if (error) { console.error("Không đọc được bảng listings:", error.message); process.exit(1); }
  // mã → UUID: đường dẫn kho ảnh neo vào UUID, mã chỉ là thứ mày gõ ở tên thư mục.
  known = new Map(data.map((r) => [r.code, r.id]));
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
  const listingId = known ? known.get(code) : null;

  const files = fs.readdirSync(path.join(SRC, dir))
    .filter((f) => OK_EXT.has(path.extname(f).toLowerCase())).sort();
  if (!files.length) continue;

  for (const [idx, f] of files.entries()) {
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
      // Nhắc theo ĐƯỜNG DẪN NGUỒN: tên trên kho là UUID sinh ở dưới, lúc này
      // chưa có, mà người đọc cảnh báo cần biết phải đi nén file nào.
      console.warn(`⚠ ${dir}/${f} nặng ${(buf.length / 1e6).toFixed(1)}MB — nên cài sharp để nén`);
    }
    // Tên file trên kho là UUID của chính dòng media — sinh TRƯỚC khi up để
    // file và dòng DB mang cùng một danh tính, khỏi phải đoán ngược.
    const mediaId = randomUUID();
    const dest = `${listingId}/${mediaId}${outExt}`;
    const sortOrder = thuTuTuTen(f) ?? (idx + 1);
    bytes += buf.length;
    if (DRY) { console.log(`(thử) ${src}  →  ${dest}  sort=${sortOrder}  ${(buf.length / 1024).toFixed(0)}KB`); nUp++; continue; }

    // UP FILE TRƯỚC, GHI DÒNG SAU. Ngược lại thì dòng DB trỏ vào file chưa tồn
    // tại; hỏng giữa chừng là có ảnh vỡ trên web. Theo thứ tự này, hỏng giữa
    // chừng chỉ để lại một file mồ côi — `media_mo_coi_storage` soi ra được, và
    // nó không hiện lên web vì web đọc từ `listing_media`.
    const { error } = await db.storage.from("listing-public")
      .upload(dest, buf, { contentType: mime, upsert: false });
    if (error) { console.error(`✗ ${dest}: ${error.message}`); nSkip++; continue; }

    const { error: mErr } = await db.from("listing_media").insert({
      id: mediaId, listing_id: listingId, bucket: "listing-public",
      storage_path: dest, media_type: "khac", mime_type: mime,
      sort_order: sortOrder,
    });
    if (mErr) {
      // Ghi dòng hỏng → dọn luôn file vừa up, đừng để lại rác mồ côi.
      await db.storage.from("listing-public").remove([dest]);
      console.error(`✗ ${dest} (ghi listing_media): ${mErr.message}`); nSkip++; continue;
    }
    console.log(`✓ ${dest}  sort=${sortOrder}`); nUp++;
  }
}

console.log(
  `\n${DRY ? "THỬ — chưa đẩy gì cả" : "Xong"}: ${nUp} ảnh, ` +
  `${(bytes / 1e6).toFixed(1)}MB${nSkip ? `, ${nSkip} lỗi` : ""}${nBad ? `, ${nBad} thư mục bỏ qua` : ""}.` +
  (sharp ? "" : "\n(không có sharp → đẩy nguyên bản, ảnh nặng thì web tải chậm)") +
  (DRY ? "\nƯng thì bỏ --dry chạy lại." : "\nWeb tự hiện ảnh sau ≤5 phút (ISR revalidate 300s).")
);
