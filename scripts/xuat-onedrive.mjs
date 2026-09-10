// xuat-onedrive.mjs — KHO DỮ LIỆU trên OneDrive, chia theo VIỆC.
//
// Chủ dự án 10/09/2026: "cho 10 phút 1 lần đi, ko cần chia 2 tầng đâu, chia cho
// các mục rổ hàng, người bán, người mua, dự án đi".
//
//   nhadat-backup/
//     DOC-TRUOC.md            · có gì ở đâu, đọc 30 giây, kèm giờ cập nhật
//     ro-hang/                · ro-hang.json (mục lục) + <MÃ TIN>/{tin.json,hoi-dap.json,anh/}
//     nguoi-ban/              · nguoi-ban.json + hoi-thoai/<người>.json
//     nguoi-mua/              · nguoi-mua.json + hoi-thoai/<người>.json
//     du-an/                  · du-an.json + theo-tinh/<tỉnh>.json
//     he-thong/               · bản sao 33 bảng (moi-nhat/ + theo-ngay/<ngày>/)
//     kich-ban-chat/          · bản ghi các lượt chạy thử với bot
//
// BA LUẬT KHI CHẠY MỖI 10 PHÚT — không có chúng thì nhịp này thành gánh nặng:
//
//  1. CHỈ GHI KHI NỘI DUNG ĐỔI. OneDrive đồng bộ theo file thay đổi; ghi đè
//     nguyên 8 MB mỗi 10 phút là 1,1 GB đẩy lên mỗi ngày cho dữ liệu gần như
//     đứng yên. `ghiNeuKhac()` so nội dung trước khi ghi, không đổi thì thôi.
//  2. ẢNH ĐÃ TẢI THÌ KHÔNG TẢI LẠI. Ảnh không đổi nội dung theo đường dẫn kho.
//  3. KHÔNG XOÁ THEO KHO. Tin bị xoá dưới DB thì thư mục cũ ở đây được ĐỔI TÊN
//     thành `_da-xoa/<MÃ>` chứ không biến mất — kho đồng bộ 10 phút một lần mà
//     xoá thẳng thì một lượt `delete` nhỡ tay dưới DB sẽ được nhân bản lên
//     OneDrive trong vòng mười phút, và bản sao thành bản sao của tai nạn.
//
// SĐT: `nguoi-ban.json` CÓ số điện thoại người bán (quyết định chủ dự án
// 07/09/2026, thư mục này hạn chế quyền). `nguoi-mua.json` KHÔNG bao giờ có —
// NFR-07: người mua không phải để lại số, và web/CRM cũng không đọc cột đó.
//
//   node scripts/xuat-onedrive.mjs           # chỉ phần người đọc
//   node scripts/xuat-onedrive.mjs --day-du  # kèm bản sao 33 bảng vào he-thong/
//
// Cần SUPABASE_SERVICE_ROLE_KEY trong scripts/.env.
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(HERE, ".env"), "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
const URL_DB = env.SUPABASE_URL ?? "https://tbcdpupiarkuxtntmosl.supabase.co";
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error("Thiếu SUPABASE_SERVICE_ROLE_KEY trong scripts/.env"); process.exit(1); }

const GOC = join(HERE, "..", "..", "nhadat-backup");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const DAY_DU = process.argv.includes("--day-du");

let daGhi = 0, giuNguyen = 0, anhMoi = 0;

/** Ghi file CHỈ KHI nội dung khác bản đang nằm trên đĩa (luật 1). */
function ghiNeuKhac(duong, noiDung) {
  try {
    if (existsSync(duong) && readFileSync(duong, "utf8") === noiDung) { giuNguyen++; return false; }
  } catch { /* đọc hụt thì cứ ghi đè */ }
  mkdirSync(dirname(duong), { recursive: true });
  writeFileSync(duong, noiDung);
  daGhi++;
  return true;
}
const jsonGon = (o) => JSON.stringify(o, null, 1);

async function rest(path) {
  const r = await fetch(`${URL_DB}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
/** Kéo hết bảng theo trang 1000 dòng — `projects` đã hơn ngàn dòng. */
async function restHet(path) {
  const ra = [];
  for (let tu = 0; ; tu += 1000) {
    const r = await fetch(`${URL_DB}/rest/v1/${path}`, { headers: { ...H, Range: `${tu}-${tu + 999}` } });
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    const phan = await r.json();
    ra.push(...phan);
    if (phan.length < 1000) return ra;
  }
}
void rest;

const gonTen = (s) => String(s ?? "").replace(/[\\/:*?"<>|]/g, "-").trim() || "khong-ten";
const nguoiNoi = (s) => s === "seller" ? "chủ nhà" : s === "buyer" ? "khách" : s === "bot" ? "trợ lý" : s;

mkdirSync(GOC, { recursive: true });
const LUC = new Date();

// ══ 1. DỰ ÁN ════════════════════════════════════════════════════════════════
const duAn = await restHet("projects?select=id,name,slug,developer,province,district,ward,location_raw,legal_status,price_min,handover,status_text,amenities,description,specs,source,source_url&order=province,district,name");
const goiDuAn = (p) => ({
  id: p.id, ma: p.slug, ten: p.name, chu_dau_tu: p.developer,
  tinh: p.province, quan: p.district, phuong: p.ward, dia_chi: p.location_raw,
  gia_tu_vnd: p.price_min, gia_m2: p.specs?.gia_dong ?? null,
  dien_tich: p.specs?.tong_dien_tich ?? null,
  dien_tich_san_pham: p.specs?.dien_tich_tu_m2
    ? `${p.specs.dien_tich_tu_m2}-${p.specs.dien_tich_den_m2} m2` : null,
  loai_can: p.specs?.loai_can ?? null, ket_noi: p.specs?.ket_noi ?? null,
  quy_mo: p.specs?.quy_mo ?? null,
  phap_ly: p.legal_status, ban_giao: p.handover, trang_thai: p.status_text,
  tien_ich: p.amenities ?? [], mo_ta: p.description,
  nguon: p.source, nguon_url: p.source_url,
});
ghiNeuKhac(join(GOC, "du-an", "du-an.json"), jsonGon({
  _doc: "Kho dự án của Aioinhadat. `id` nối sang tin rao (listings.project_id). Mô tả do mình viết từ dữ kiện, `nguon_url` là nơi đối chiếu.",
  so_du_an: duAn.length, du_an: duAn.map(goiDuAn),
}));
const theoTinh = new Map();
for (const p of duAn) {
  const t = gonTen(p.province ?? "khong-ro");
  if (!theoTinh.has(t)) theoTinh.set(t, []);
  theoTinh.get(t).push(p);
}
for (const [tinh, ds] of theoTinh) {
  ghiNeuKhac(join(GOC, "du-an", "theo-tinh", `${tinh}.json`), jsonGon({
    tinh, so_du_an: ds.length, du_an: ds.map(goiDuAn),
  }));
}
console.log(`du-an/: ${duAn.length} dự án · ${theoTinh.size} tỉnh`);

// ══ 2. RỔ HÀNG ══════════════════════════════════════════════════════════════
const tin = await restHet("boc_tach_v?select=id,code,seller_id,status,created_at,nhom&order=created_at.desc");
const ids = tin.map((t) => t.id);
const inList = (xs) => xs.length ? `(${xs.join(",")})` : "(00000000-0000-0000-0000-000000000000)";
const [facts, hoi, media, sellers, buyers] = await Promise.all([
  ids.length ? restHet(`listing_facts?select=listing_id,question,answer,source,created_at&order=created_at&listing_id=in.${inList(ids)}`) : [],
  ids.length ? restHet(`info_requests?select=listing_id,question,status,answer,assignee,created_at,answered_at&order=created_at&listing_id=in.${inList(ids)}`) : [],
  ids.length ? restHet(`listing_media?select=listing_id,bucket,storage_path,media_type,sort_order&order=sort_order&listing_id=in.${inList(ids)}`) : [],
  restHet("sellers?select=id,name,phone,zalo_user_id,seller_type,ten_tro_ly,created_at"),
  // NFR-07: KHÔNG chọn `buyers.phone`. Người mua không phải để lại số — cam kết
  // đó phải đúng ở cả kho trên OneDrive, không chỉ ở trang web.
  restHet("buyers?select=id,name,zalo_user_id,preferences,notes,last_contact_at,created_at"),
]);
const conv = await restHet("conversations?select=id,buyer_id,seller_id,channel,last_message_at,needs_human,human_hold");
const convIds = conv.map((c) => c.id);
const msgs = convIds.length ? await restHet(`messages?select=conversation_id,sender,body,created_at,seq&order=seq&conversation_id=in.${inList(convIds)}`) : [];
const loiChat = (cs) => msgs.filter((m) => cs.includes(m.conversation_id))
  .map((m) => ({ luc: m.created_at, ai: nguoiNoi(m.sender), noi: m.body }));

const thuRoHang = join(GOC, "ro-hang");
mkdirSync(thuRoHang, { recursive: true });
const mucLuc = [];
for (const t of tin) {
  const ten = gonTen(t.code ?? t.id);
  const thu = join(thuRoHang, ten);
  const s = sellers.find((x) => x.id === t.seller_id);
  const cs = conv.filter((c) => c.seller_id === t.seller_id).map((c) => c.id);
  const anhTin = media.filter((m) => m.listing_id === t.id);

  ghiNeuKhac(join(thu, "tin.json"), jsonGon({
    _doc: "Một tin rao. `id` là UUID trong bảng listings; `nhom` là JSON chia nhóm (FR-187) — chỉ có trường nào thật sự biết.",
    id: t.id, ma: ten, trang_thai: t.status, tao_luc: t.created_at,
    nguoi_rao: s ? { ten: s.name, sdt: s.phone, zalo: s.zalo_user_id, vai: s.seller_type, tro_ly: s.ten_tro_ly } : null,
    nhom: t.nhom,
    fact: facts.filter((f) => f.listing_id === t.id).map((f) => ({ khoa: f.question, tra_loi: f.answer, nguon: f.source, luc: f.created_at })),
    cau_hoi_da_mo: hoi.filter((q) => q.listing_id === t.id).map((q) => ({ khoa: q.question, trang_thai: q.status, tra_loi: q.answer, luc: q.created_at })),
    so_anh: anhTin.length,
  }));

  const hoiDap = loiChat(cs);
  ghiNeuKhac(join(thu, "hoi-dap.json"), jsonGon({
    _doc: "Nguyên đoạn chat với chủ nhà của tin này (một người rao nhiều căn thì đoạn chat dùng chung).",
    ma_tin: ten, so_luot: hoiDap.length, hoi_dap: hoiDap,
  }));

  for (const [i, m] of anhTin.entries()) {
    const duoi = m.storage_path.split(".").pop()?.slice(0, 4) ?? "jpg";
    const dich = join(thu, "anh", `${String(i + 1).padStart(2, "0")}-${m.media_type ?? "anh"}.${duoi}`);
    if (existsSync(dich)) continue;                    // luật 2: đã tải thì thôi
    const r = await fetch(`${URL_DB}/storage/v1/object/${m.bucket}/${m.storage_path}`, { headers: H });
    if (!r.ok) { console.error(`  ! ảnh ${ten} #${i}: HTTP ${r.status}`); continue; }
    mkdirSync(join(thu, "anh"), { recursive: true });
    writeFileSync(dich, Buffer.from(await r.arrayBuffer()));
    anhMoi++;
  }
  mucLuc.push({ ma: ten, trang_thai: t.status, diem: t.nhom?.diem?.tong ?? null, so_anh: anhTin.length, so_luot_chat: hoiDap.length });
}
ghiNeuKhac(join(thuRoHang, "ro-hang.json"), jsonGon({
  _doc: "Mục lục rổ hàng. Chi tiết từng tin nằm ở thư mục cùng tên mã tin.",
  so_tin: tin.length, tin: mucLuc,
}));

// Luật 3: tin không còn dưới DB thì CHUYỂN sang `_da-xoa/`, không xoá thẳng.
const conSong = new Set(tin.map((t) => gonTen(t.code ?? t.id)));
for (const d of readdirSync(thuRoHang, { withFileTypes: true })) {
  if (!d.isDirectory() || d.name.startsWith("_") || conSong.has(d.name)) continue;
  const kho = join(thuRoHang, "_da-xoa", d.name);
  rmSync(kho, { recursive: true, force: true });
  mkdirSync(join(thuRoHang, "_da-xoa"), { recursive: true });
  renameSync(join(thuRoHang, d.name), kho);
  console.log(`  tin ${d.name} không còn dưới DB → ro-hang/_da-xoa/`);
}
console.log(`ro-hang/: ${tin.length} tin · ${anhMoi} ảnh mới`);

// ══ 3. NGƯỜI BÁN ════════════════════════════════════════════════════════════
ghiNeuKhac(join(GOC, "nguoi-ban", "nguoi-ban.json"), jsonGon({
  _doc: "Người rao đang có trong hệ thống. SĐT và Zalo ID là dữ liệu THẬT — đừng chia sẻ ra ngoài công ty.",
  so_nguoi: sellers.length,
  nguoi_ban: sellers.map((s) => ({
    ten: s.name, sdt: s.phone, zalo: s.zalo_user_id, vai: s.seller_type, tro_ly: s.ten_tro_ly,
    so_tin: tin.filter((t) => t.seller_id === s.id).length,
    ma_tin: tin.filter((t) => t.seller_id === s.id).map((t) => t.code ?? t.id),
    tao_luc: s.created_at,
  })),
}));
for (const s of sellers) {
  const cs = conv.filter((c) => c.seller_id === s.id).map((c) => c.id);
  const chat = loiChat(cs);
  if (!chat.length) continue;
  ghiNeuKhac(join(GOC, "nguoi-ban", "hoi-thoai", `${gonTen(s.name ?? s.zalo_user_id ?? s.id)}.json`),
    jsonGon({ nguoi: s.name, zalo: s.zalo_user_id, so_luot: chat.length, hoi_thoai: chat }));
}
console.log(`nguoi-ban/: ${sellers.length} người`);

// ══ 4. NGƯỜI MUA ════════════════════════════════════════════════════════════
const interests = await restHet("interests?select=buyer_id,listing_id,created_at");
ghiNeuKhac(join(GOC, "nguoi-mua", "nguoi-mua.json"), jsonGon({
  _doc: "Khách mua/thuê. KHÔNG có số điện thoại — NFR-07: người mua không phải để lại số, hệ thống cũng không đọc cột đó.",
  so_nguoi: buyers.length,
  nguoi_mua: buyers.map((b) => ({
    ten: b.name, zalo: b.zalo_user_id, nhu_cau: b.preferences ?? null, ghi_chu: b.notes,
    bds_quan_tam: interests.filter((i) => i.buyer_id === b.id)
      .map((i) => tin.find((t) => t.id === i.listing_id)?.code ?? i.listing_id),
    lien_lac_cuoi: b.last_contact_at, tao_luc: b.created_at,
  })),
}));
for (const b of buyers) {
  const cs = conv.filter((c) => c.buyer_id === b.id).map((c) => c.id);
  const chat = loiChat(cs);
  if (!chat.length) continue;
  ghiNeuKhac(join(GOC, "nguoi-mua", "hoi-thoai", `${gonTen(b.name ?? b.zalo_user_id ?? b.id)}.json`),
    jsonGon({ nguoi: b.name, zalo: b.zalo_user_id, so_luot: chat.length, hoi_thoai: chat }));
}
console.log(`nguoi-mua/: ${buyers.length} người`);

// ══ 5. HỆ THỐNG — bản sao 33 bảng ═══════════════════════════════════════════
// Chạy hẳn `sao-luu.mjs` (nó có bộ đếm dòng, manifest, kiểm đủ bảng) chứ không
// tự kéo lại — hai đường kéo dữ liệu là hai chỗ phải sửa khi thêm bảng.
if (DAY_DU) {
  const moiNhat = join(GOC, "he-thong", "moi-nhat");
  const r = spawnSync(process.execPath, [join(HERE, "sao-luu.mjs"), moiNhat], { encoding: "utf8" });
  const dong = (r.stdout ?? "").split("\n").filter((l) => /dòng, \d+\/\d+ bảng/.test(l));
  if (r.status === 0) {
    console.log(`he-thong/moi-nhat: ${dong[0]?.trim() ?? "xong"}`);
    // MỘT ảnh chụp mỗi ngày, giữ 7 ngày. Vì sao vẫn cần ảnh chụp khi đã có bản
    // mới nhất: kho này đồng bộ 10 phút một lần, nên một lượt xoá nhỡ tay dưới
    // DB sẽ được chép sang `moi-nhat` trong vòng mười phút. Ảnh chụp hôm trước
    // là thứ duy nhất còn giữ dữ liệu trước tai nạn.
    const ngay = new Date().toISOString().slice(0, 10);
    const kho = join(GOC, "he-thong", "theo-ngay");
    mkdirSync(kho, { recursive: true });
    if (!existsSync(join(kho, ngay))) {
      const r2 = spawnSync(process.execPath, [join(HERE, "sao-luu.mjs"), join(kho, ngay)], { encoding: "utf8" });
      if (r2.status === 0) console.log(`he-thong/theo-ngay/${ngay}: ảnh chụp hôm nay`);
    }
    const cu = readdirSync(kho).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort().reverse().slice(7);
    for (const x of cu) rmSync(join(kho, x), { recursive: true, force: true });
    if (cu.length) console.log(`he-thong/theo-ngay: dọn ${cu.length} ảnh chụp quá 7 ngày`);
  } else {
    console.error(`he-thong: SAO LƯU HỎNG (thoát ${r.status}) — giữ nguyên bản cũ.\n${(r.stdout ?? "").slice(-400)}`);
  }
}

// ══ 6. DOC-TRUOC ════════════════════════════════════════════════════════════
ghiNeuKhac(join(GOC, "DOC-TRUOC.md"), [
  "# Kho dữ liệu Aioinhadat — đọc 30 giây",
  "",
  "| Thư mục | Là gì |",
  "|---|---|",
  "| `ro-hang/` | Mục lục `ro-hang.json` + mỗi tin một thư mục: `tin.json` (thông số, JSON chia nhóm, điểm), `hoi-dap.json` (nguyên đoạn chat), `anh/` |",
  "| `nguoi-ban/` | `nguoi-ban.json` (người rao, SĐT, số tin) + `hoi-thoai/<người>.json` |",
  "| `nguoi-mua/` | `nguoi-mua.json` (nhu cầu, BĐS quan tâm — **không có SĐT**, NFR-07) + `hoi-thoai/<người>.json` |",
  "| `du-an/` | `du-an.json` toàn bộ kho dự án + `theo-tinh/<tỉnh>.json` cho dễ mở |",
  "| `he-thong/` | Bản sao 33 bảng: `moi-nhat/` + `theo-ngay/<ngày>/` (giữ 7 ngày). Lưới an toàn — đừng xoá |",
  "| `kich-ban-chat/` | Bản ghi các lượt chạy thử với bot |",
  "",
  `Hiện có **${tin.length} tin rao**, **${sellers.length} người bán**, **${buyers.length} người mua**, **${duAn.length} dự án**.`,
  "",
  "Kho tự cập nhật **10 phút một lần** (Task Scheduler gọi `003-Content/nhadat-dong-bo.cmd`,",
  "log ở `nhadat-dong-bo.log`). Chỉ file nào ĐỔI mới được ghi lại, nên OneDrive không",
  "phải đẩy lại cả kho mỗi lượt.",
  "",
  "Tin bị xoá dưới hệ thống KHÔNG biến mất khỏi đây: nó chuyển sang `ro-hang/_da-xoa/`.",
  "",
  tin.length === 0 ? "> Rổ tin đang trống — dữ liệu kiểm thử vừa được dọn. Tin thật của khách sẽ tự vào đây.\n" : "",
  "## Mục lục tin",
  "",
  tin.length ? "| Mã tin | Trạng thái | Điểm | Ảnh | Lượt chat |\n|---|---|---|---|---|" : "_(chưa có tin nào)_",
  ...mucLuc.map((m) => `| ${m.ma} | ${m.trang_thai} | ${m.diem ?? "-"} | ${m.so_anh} | ${m.so_luot_chat} |`),
  "",
  "Bốn thư mục đầu là **bản đọc**: bỏ khoá ngoại và bảng nội bộ cho dễ xem.",
  "Bản phục hồi được là `he-thong/`, sinh bằng `scripts/sao-luu.mjs`.",
].join("\n"));

console.log(`\nXong lúc ${LUC.toLocaleTimeString("vi-VN")} → ${GOC}`);
console.log(`  ${daGhi} file ghi mới/đổi · ${giuNguyen} file giữ nguyên (không đụng OneDrive)`);
