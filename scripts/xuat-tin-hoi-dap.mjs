// xuat-tin-hoi-dap.mjs — mỗi TIN một file JSON đọc bằng mắt: JSON chia nhóm (FR-187)
// + toàn bộ hỏi đáp với chủ nhà + fact + câu hỏi đã mở. Chủ dự án 10/09/2026:
// "backup sản phẩm vào kho local, đưa vài tin mà hỏi đáp sơ sơ vào nữa, json tao
// kiểm tra bằng mắt". Không phải bản sao lưu (sao-luu.mjs mới là); đây là bản đọc.
//
//   node scripts/xuat-tin-hoi-dap.mjs [thư-mục-đích] [--ma BDS-NP-Q5-0010,...]
//
// Mặc định ghi vào ../nhadat-backup/tin-hoi-dap-<ngày-giờ>/ (ngoài repo — chứa
// SĐT/Zalo thật). Cần SUPABASE_SERVICE_ROLE_KEY trong scripts/.env.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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

const args = process.argv.slice(2);
const maChon = (args.find((a) => a.startsWith("--ma"))?.split("=")[1] ?? args[args.indexOf("--ma") + 1] ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const dich = resolve(args.find((a) => !a.startsWith("--") && a !== maChon.join(",")) ??
  join(HERE, "..", "..", "nhadat-backup", `tin-hoi-dap-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`));

async function rest(path) {
  const r = await fetch(`${URL_DB}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status} ${await r.text()}`);
  return r.json();
}

const tin = await rest(`boc_tach_v?select=id,code,seller_id,status,created_at,nhom&order=created_at.desc${maChon.length ? `&code=in.(${maChon.join(",")})` : ""}`);
const ids = tin.map((t) => t.id);
const [facts, hoi, conv, sellers] = await Promise.all([
  rest(`listing_facts?select=listing_id,question,answer,source,created_at&order=created_at&listing_id=in.(${ids.join(",")})`),
  rest(`info_requests?select=listing_id,question,status,answer,source,assignee,created_at,answered_at&order=created_at&listing_id=in.(${ids.join(",")})`),
  rest(`conversations?select=id,seller_id,last_message_at,human_hold,needs_human&seller_id=in.(${[...new Set(tin.map((t) => t.seller_id))].join(",")})`),
  rest(`sellers?select=id,name,zalo_user_id,seller_type,ten_tro_ly&id=in.(${[...new Set(tin.map((t) => t.seller_id))].join(",")})`),
]);
const convIds = conv.map((c) => c.id);
const msgs = convIds.length
  ? await rest(`messages?select=conversation_id,sender,body,created_at,seq&order=seq&conversation_id=in.(${convIds.join(",")})`)
  : [];

mkdirSync(dich, { recursive: true });
const mucLuc = [];
for (const t of tin) {
  const s = sellers.find((x) => x.id === t.seller_id);
  const cs = conv.filter((c) => c.seller_id === t.seller_id).map((c) => c.id);
  const hoiDap = msgs.filter((m) => cs.includes(m.conversation_id)).map((m) => ({
    luc: m.created_at, ai: m.sender === "seller" ? "chủ nhà" : m.sender === "bot" ? "trợ lý" : m.sender, noi: m.body,
  }));
  const goi = {
    _doc: "Một tin rao: `tin.id` là UUID của listings (khoá nối listing_facts.listing_id, info_requests.listing_id, listing_media.listing_id); `tin.ma` là mã tin hiện trên CRM/web. Hỏi đáp là toàn bộ hội thoại với chủ nhà (chung cho mọi tin của người đó).",
    tin: { id: t.id, ma: t.code, trang_thai: t.status, tao_luc: t.created_at },
    nguoi_rao: s ? { id: s.id, ten: s.name, zalo: s.zalo_user_id, vai: s.seller_type, tro_ly: s.ten_tro_ly, nguoi_that_giu: conv.some((c) => c.seller_id === s.id && c.human_hold) } : null,
    boc_tach_nhom: t.nhom,
    fact_theo_thu_tu: facts.filter((f) => f.listing_id === t.id).map((f) => ({ luc: f.created_at, khoa: f.question, tra_loi: f.answer, nguon: f.source })),
    cau_hoi_da_mo: hoi.filter((q) => q.listing_id === t.id).map((q) => ({ luc: q.created_at, khoa: q.question, trang_thai: q.status, nguoi_nhan: q.assignee, tra_loi: q.answer })),
    hoi_dap: hoiDap,
  };
  const ten = `${t.code ?? t.id}.json`;
  writeFileSync(join(dich, ten), JSON.stringify(goi, null, 2));
  mucLuc.push({ file: ten, id: t.id, ma: t.code, trang_thai: t.status, so_fact: goi.fact_theo_thu_tu.length, so_luot_chat: hoiDap.length, diem: t.nhom?.diem?.tong ?? null });
}
writeFileSync(join(dich, "muc-luc.json"), JSON.stringify({
  _doc: "KHÔNG PHẢI BẢN SAO LƯU (sao-luu.mjs mới là). Bản đọc bằng mắt: mỗi tin một file, id = listings.id, ma = mã tin.",
  xuat_luc: new Date().toISOString(), so_tin: mucLuc.length, tin: mucLuc,
}, null, 2));
console.log(`${mucLuc.length} tin → ${dich}`);
for (const m of mucLuc) console.log(`  ${m.ma}  ${m.trang_thai}  ${m.diem ?? "-"} điểm  ${m.so_fact} fact  ${m.so_luot_chat} lượt chat`);
