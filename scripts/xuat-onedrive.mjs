// xuat-onedrive.mjs — thư mục GỌN cho sếp xem trên OneDrive (chủ dự án 10/09/2026:
// "sếp tao thích xem json gọn gọn ở one drive, bỏ mấy cái thừa, chỉ để json dự án,
// json listing + thư mục ảnh gắn với nó").
//
// Cấu trúc dựng ra:
//
//   nhadat-backup/
//     DOC-TRUOC.md          · có gì ở đâu, đọc 30 giây
//     du-an.json            · toàn bộ dự án (tên, CĐT, địa chỉ, giá, diện tích, pháp lý, tiện ích)
//     nguoi-ban.json        · người rao và số tin của họ
//     tin/<MÃ TIN>/
//       tin.json            · một tin: thông số + JSON chia nhóm (FR-187) + điểm
//       hoi-dap.json        · nguyên đoạn chat với chủ nhà của tin đó
//       anh/                · ảnh của chính tin đó, tải từ kho về
//     sao-luu-day-du/       · bản sao 32 bảng (lưới an toàn OPEN-25) — KHÔNG xoá
//     kich-ban-chat/        · bản ghi các lượt chạy thử .md
//
// Đây KHÔNG phải bản sao lưu: nó bỏ khoá ngoại, bỏ bảng nội bộ, gộp cho dễ đọc.
// Bản sao lưu thật vẫn là `scripts/sao-luu.mjs` → `sao-luu-day-du/`.
//
//   node scripts/xuat-onedrive.mjs
//
// Cần SUPABASE_SERVICE_ROLE_KEY trong scripts/.env.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
if (!KEY) { console.error("Thiếu SUPABASE_SERVICE_ROLE_KEY trong scripts/.env"); process.exit(1); }

const GOC = join(HERE, "..", "..", "nhadat-backup");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

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

// ── Dự án ───────────────────────────────────────────────────────────────────
const duAn = await restHet("projects?select=id,name,slug,developer,province,district,ward,location_raw,legal_status,price_min,handover,status_text,amenities,description,specs,source,source_url&order=province,district,name");
mkdirSync(GOC, { recursive: true });
writeFileSync(join(GOC, "du-an.json"), JSON.stringify({
  _doc: "Kho dự án của Aioinhadat. `id` là khoá nối sang tin rao (listings.project_id). Mô tả do mình viết từ dữ kiện, `nguon_url` là nơi đối chiếu.",
  so_du_an: duAn.length,
  xuat_luc: new Date().toISOString(),
  du_an: duAn.map((p) => ({
    id: p.id, ma: p.slug, ten: p.name, chu_dau_tu: p.developer,
    tinh: p.province, quan: p.district, phuong: p.ward, dia_chi: p.location_raw,
    gia_tu_vnd: p.price_min, gia_m2: p.specs?.gia_dong ?? null,
    dien_tich: p.specs?.tong_dien_tich ?? null,
    dien_tich_san_pham: p.specs?.dien_tich_tu_m2
      ? `${p.specs.dien_tich_tu_m2}-${p.specs.dien_tich_den_m2} m2` : null,
    phap_ly: p.legal_status, ban_giao: p.handover, trang_thai: p.status_text,
    tien_ich: p.amenities ?? [], mo_ta: p.description,
    nguon: p.source, nguon_url: p.source_url,
  })),
}, null, 1));
console.log(`du-an.json: ${duAn.length} dự án`);

// ── Tin rao + hỏi đáp + ảnh ─────────────────────────────────────────────────
const tin = await restHet("boc_tach_v?select=id,code,seller_id,status,created_at,nhom&order=created_at.desc");
const ids = tin.map((t) => t.id);
const inList = (xs) => xs.length ? `(${xs.join(",")})` : "(00000000-0000-0000-0000-000000000000)";
const [facts, hoi, media, sellers] = await Promise.all([
  ids.length ? restHet(`listing_facts?select=listing_id,question,answer,source,created_at&order=created_at&listing_id=in.${inList(ids)}`) : [],
  ids.length ? restHet(`info_requests?select=listing_id,question,status,answer,assignee,created_at,answered_at&order=created_at&listing_id=in.${inList(ids)}`) : [],
  ids.length ? restHet(`listing_media?select=listing_id,bucket,storage_path,media_type,sort_order&order=sort_order&listing_id=in.${inList(ids)}`) : [],
  restHet("sellers?select=id,name,zalo_user_id,seller_type,ten_tro_ly,created_at"),
]);
const sellerIds = [...new Set(tin.map((t) => t.seller_id))];
const conv = sellerIds.length ? await restHet(`conversations?select=id,seller_id,human_hold,needs_human,last_message_at&seller_id=in.${inList(sellerIds)}`) : [];
const convIds = conv.map((c) => c.id);
const msgs = convIds.length ? await restHet(`messages?select=conversation_id,sender,body,created_at,seq&order=seq&conversation_id=in.${inList(convIds)}`) : [];

const thuMucTin = join(GOC, "tin");
mkdirSync(thuMucTin, { recursive: true });
const mucLuc = [];
for (const t of tin) {
  const ten = t.code ?? t.id;
  const thu = join(thuMucTin, ten);
  mkdirSync(thu, { recursive: true });
  const s = sellers.find((x) => x.id === t.seller_id);
  const cs = conv.filter((c) => c.seller_id === t.seller_id).map((c) => c.id);
  const anhTin = media.filter((m) => m.listing_id === t.id);

  writeFileSync(join(thu, "tin.json"), JSON.stringify({
    _doc: "Một tin rao. `id` là UUID trong bảng listings; `nhom` là JSON bóc tách chia nhóm (FR-187) — chỉ có trường nào thật sự biết.",
    id: t.id, ma: ten, trang_thai: t.status, tao_luc: t.created_at,
    nguoi_rao: s ? { ten: s.name, zalo: s.zalo_user_id, vai: s.seller_type, tro_ly: s.ten_tro_ly } : null,
    nhom: t.nhom,
    fact: facts.filter((f) => f.listing_id === t.id).map((f) => ({ khoa: f.question, tra_loi: f.answer, nguon: f.source, luc: f.created_at })),
    cau_hoi_da_mo: hoi.filter((q) => q.listing_id === t.id).map((q) => ({ khoa: q.question, trang_thai: q.status, tra_loi: q.answer, luc: q.created_at })),
    so_anh: anhTin.length,
  }, null, 1));

  const hoiDap = msgs.filter((m) => cs.includes(m.conversation_id))
    .map((m) => ({ luc: m.created_at, ai: m.sender === "seller" ? "chủ nhà" : m.sender === "bot" ? "trợ lý" : m.sender, noi: m.body }));
  writeFileSync(join(thu, "hoi-dap.json"), JSON.stringify({
    _doc: "Nguyên đoạn chat với chủ nhà của tin này (một người rao nhiều căn thì đoạn chat dùng chung).",
    ma_tin: ten, so_luot: hoiDap.length, hoi_dap: hoiDap,
  }, null, 1));

  if (anhTin.length) {
    const thuAnh = join(thu, "anh");
    mkdirSync(thuAnh, { recursive: true });
    for (const [i, m] of anhTin.entries()) {
      const r = await fetch(`${URL_DB}/storage/v1/object/${m.bucket}/${m.storage_path}`, { headers: H });
      if (!r.ok) { console.error(`  ! ảnh ${ten} #${i}: HTTP ${r.status}`); continue; }
      const duoi = m.storage_path.split(".").pop()?.slice(0, 4) ?? "jpg";
      writeFileSync(join(thuAnh, `${String(i + 1).padStart(2, "0")}-${m.media_type ?? "anh"}.${duoi}`), Buffer.from(await r.arrayBuffer()));
    }
  }
  mucLuc.push({ ma: ten, trang_thai: t.status, diem: t.nhom?.diem?.tong ?? null, so_anh: anhTin.length, so_luot_chat: hoiDap.length });
}
console.log(`tin/: ${tin.length} tin`);

writeFileSync(join(GOC, "nguoi-ban.json"), JSON.stringify({
  _doc: "Người rao đang có trong hệ thống. Số điện thoại và Zalo ID là dữ liệu thật — đừng chia sẻ ra ngoài công ty.",
  so_nguoi: sellers.length,
  nguoi_ban: sellers.map((s) => ({
    ten: s.name, zalo: s.zalo_user_id, vai: s.seller_type, tro_ly: s.ten_tro_ly,
    so_tin: tin.filter((t) => t.seller_id === s.id).length, tao_luc: s.created_at,
  })),
}, null, 1));

writeFileSync(join(GOC, "DOC-TRUOC.md"), [
  "# Kho dữ liệu Aioinhadat — đọc 30 giây",
  "",
  `Xuất lúc ${new Date().toLocaleString("vi-VN")}.`,
  "",
  "| Thư mục / file | Là gì |",
  "|---|---|",
  "| `du-an.json` | " + duAn.length + " dự án TP.HCM · Bình Dương · Long An: chủ đầu tư, địa chỉ, giá, diện tích, pháp lý, tiện ích |",
  "| `tin/<MÃ TIN>/tin.json` | Một tin rao: thông số + JSON chia nhóm + điểm đầy đủ |",
  "| `tin/<MÃ TIN>/hoi-dap.json` | Nguyên đoạn chat với chủ nhà của tin đó |",
  "| `tin/<MÃ TIN>/anh/` | Ảnh của chính tin đó |",
  "| `nguoi-ban.json` | Người rao và số tin của họ |",
  "| `sao-luu-day-du/` | Bản sao 32 bảng — lưới an toàn, đừng xoá |",
  "| `kich-ban-chat/` | Bản ghi các lượt chạy thử với bot |",
  "",
  `Hiện có **${tin.length} tin rao** và **${duAn.length} dự án**.`,
  tin.length === 0 ? "\n> Rổ tin đang trống vì vừa dọn sạch dữ liệu kiểm thử. Tin thật của khách sẽ tự vào đây.\n" : "",
  "",
  "## Mục lục tin",
  "",
  tin.length ? "| Mã tin | Trạng thái | Điểm | Ảnh | Lượt chat |\n|---|---|---|---|---|" : "_(chưa có tin nào)_",
  ...mucLuc.map((m) => `| ${m.ma} | ${m.trang_thai} | ${m.diem ?? "-"} | ${m.so_anh} | ${m.so_luot_chat} |`),
  "",
  "Đây **không phải bản sao lưu** — nó bỏ khoá ngoại và bảng nội bộ cho dễ đọc.",
  "Bản sao lưu thật nằm ở `sao-luu-day-du/`, sinh bằng `scripts/sao-luu.mjs`.",
].join("\n"));

console.log(`Xong → ${GOC}`);
