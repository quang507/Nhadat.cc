#!/usr/bin/env bun
// chat.mjs — CHAT THỬ VỚI BOT NGAY TRONG TERMINAL (FR-246 e, 29/09/2026).
//
// Chủ dự án: "tạo ra một môi trường test chạy terminal để tao pull về máy xong chạy trên máy tính".
// Gõ một câu như khách Zalo, bot trả lời ngay dưới. Hai chế độ:
//
//   bun run chat                 # MÁY: chat-reply THẬT + DB GIẢ trong bộ nhớ (../e2e/mock-supabase.mjs).
//                                #   Có ANTHROPIC_API_KEY (env hoặc scripts/.env) → model thật; không có → model giả
//                                #   im lặng (chỉ thấy phần luật). Không đụng production. Kho có sẵn 5 căn mẫu Quận 5.
//   bun run chat -- --that       # PRODUCTION: bắn vào chat-reply đang chạy bằng ID THỬ (qua `la_id_thu`), đọc/ghi DB
//                                #   thật. Cần SUPABASE_SERVICE_ROLE_KEY trong scripts/.env. Dọn người thử khi thoát.
//   bun run chat -- --that --id thu-chat-01   # tự chọn ID (phải là ID thử: thu- b15- hoi- z- e2e- b- lx- do-)
//   bun run chat -- --that --giu              # thoát KHÔNG dọn (để mở /admin xem lại)
//   bun run chat < cau.txt       # mỗi dòng một tin nhắn, chạy tuần tự (dán kịch bản dài)
//   bun run chat -- --log        # chế độ MÁY: in cả log nội bộ của chat-reply (_ms, lỗi model…)
//   bun run chat -- --web        # chế độ MÁY nhưng chat trên TRANG WEB (http://localhost:3000, đổi bằng --port).
//                                #   Mỗi trình duyệt một cuộc chat riêng (nhiều người thử cùng lúc), không đăng nhập. Muốn mở từ máy khác: `ngrok http 3000`
//                                #   hoặc workflow `chat-web.yml` (chạy trên GitHub + đường hầm Cloudflare, không cần pull).
//
// Lệnh trong lúc chat:  /tin  xem tin + hồ sơ người đang chat   /moi  làm lại từ đầu (người mới)
//                       /giup  in lại hướng dẫn                   /thoat  thoát (Ctrl+C cũng được)
//
// Khác chế độ MÁY và PRODUCTION: DB giả không có trigger / constraint / RLS / vector, không tính diện tích từ
// ngang × dài như trigger SQL, và tìm theo nghĩa (FR-216) tắt. Thấy lỗi ở chế độ máy mà nghi do mock thì bắn lại
// bằng `--that` trước khi báo lỗi. Khoá không bao giờ được in ra; tên thật / SĐT thật đừng gõ vào (repo PUBLIC,
// log hội thoại thử vẫn nằm trong DB tới khi dọn).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOC = join(HERE, "..", "..", "..");
const args = process.argv.slice(2);
const co = (k) => args.includes(k);
const giaTri = (k) => { const i = args.findIndex((a) => a === k || a.startsWith(k + "=")); if (i < 0) return null; return args[i].includes("=") ? args[i].split("=")[1] : (args[i + 1] ?? null); };
const THAT = co("--that");
const LOG = co("--log"); // in cả log nội bộ của chat-reply (chế độ MÁY)
const GIU = co("--giu");
const WEB = co("--web"); // 07/10/2026: chat trên trang web thay cho terminal (chế độ MÁY)
const TTY = process.stdin.isTTY;

const XANH = (s) => `\x1b[32m${s}\x1b[0m`, VANG = (s) => `\x1b[33m${s}\x1b[0m`, XAM = (s) => `\x1b[90m${s}\x1b[0m`, DO = (s) => `\x1b[31m${s}\x1b[0m`;

// ── Khoá: env trước, rồi scripts/.env (như sinh-schema.mjs). KHÔNG in ra. ──
function docEnvScripts() {
  const p = join(GOC, "scripts", ".env");
  if (!existsSync(p)) return {};
  return Object.fromEntries(readFileSync(p, "utf8").split(/\r?\n/).filter((l) => l && !l.trimStart().startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
}
const envF = docEnvScripts();
const layEnv = (k) => (process.env[k] ?? envF[k] ?? "").trim() || null;

const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
const ngauNhien = () => Math.random().toString(36).slice(2, 6);

// ─────────────────────────────────────────────────────────────────────────────
// Hai "máy chủ" cùng một giao diện: gui(uid, text) → replies[], tin(uid) → in tình trạng, xoa(uid).
// ─────────────────────────────────────────────────────────────────────────────
async function mayChuThat() {
  const URL_DB = layEnv("SUPABASE_URL") ?? "https://tbcdpupiarkuxtntmosl.supabase.co";
  const KHOA = layEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!KHOA) {
    console.error(DO("Thiếu SUPABASE_SERVICE_ROLE_KEY. Chép scripts/.env.example thành scripts/.env rồi dán khoá vào (hoặc chạy không có --that để chat trên máy)."));
    process.exit(2);
  }
  const H = { apikey: KHOA, Authorization: `Bearer ${KHOA}`, "Content-Type": "application/json" };
  async function rest(path, opt = {}) {
    const r = await fetch(`${URL_DB}/rest/v1/${path}`, { headers: H, ...opt });
    if (!r.ok) throw new Error(`${path.split("?")[0]}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }
  const rpc = (ten, body = {}) => rest(`rpc/${ten}`, { method: "POST", body: JSON.stringify(body) });
  // Bí mật cổng đọc từ Vault bằng service_role (như kich-ban-hanh-vi.mjs), KHÔNG ghi vào file nào.
  const GATE = await rpc("get_secret", { secret_name: "BRIDGE_SECRET" });
  let dem = 0, mocLoi = new Date().toISOString();
  return {
    ten: `PRODUCTION (${URL_DB.replace(/^https:\/\//, "").split(".")[0]})`,
    async kiemId(uid) { return (await rpc("la_id_thu", { p: uid })) === true; },
    async gui(uid, text) {
      for (let lan = 0; lan < 8; lan++) {
        const r = await fetch(`${URL_DB}/functions/v1/chat-reply`, {
          method: "POST",
          headers: { Authorization: `Bearer ${KHOA}`, "x-bridge-secret": GATE, "Content-Type": "application/json" },
          body: JSON.stringify({ external_user_id: uid, text, msg_id: `chat-${uid}-${Date.now()}-${++dem}`, channel: "zalo_personal_test" }),
        });
        let j;
        try { j = await r.json(); } catch { j = { error: `HTTP ${r.status}` }; }
        if (j.in_flight || j.deduped) { await nghi(2500); continue; }
        if (!r.ok) throw new Error(`chat-reply HTTP ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
        // Sổ lỗi chat-reply từ lượt trước (lượt model hỏng vẫn trả 200 và trả lời bằng luật). Sổ chung cả hệ thống:
        // dòng in ra có thể của khách khác nhắn cùng lúc — log_loi đã che SĐT, chỉ in nguồn + 200 ký tự.
        try {
          const loi = await rest(`bot_errors?select=at,source,detail&source=like.chat-reply*&at=gt.${encodeURIComponent(mocLoi)}&order=at.asc&limit=20`);
          for (const x of loi) console.log(DO(`  sổ lỗi · ${x.source}: ${String(x.detail ?? "").slice(0, 200)}`));
          if (loi.length) mocLoi = loi[loi.length - 1].at;
        } catch { /* đọc sổ lỗi hỏng không được làm hỏng lượt chat */ }
        return j.replies ?? (j.reply ? [j.reply] : []);
      }
      throw new Error("chat-reply kẹt in_flight sau 8 lượt");
    },
    async tin(uid) {
      const s = await rest(`sellers?select=id,seller_type,xung_ho,active_listing_id&zalo_user_id=eq.${encodeURIComponent(uid)}`);
      const b = await rest(`buyers?select=id,preferences&zalo_user_id=eq.${encodeURIComponent(uid)}`);
      const ls = s.length ? await rest(`listings?select=*&seller_id=eq.${s[0].id}&order=created_at.asc`) : [];
      const facts = ls.length ? await rest(`listing_facts?select=listing_id,question,answer&listing_id=in.(${ls.map((l) => l.id).join(",")})`) : [];
      const treo = ls.length ? await rest(`info_requests?select=listing_id,question&status=eq.pending&listing_id=in.(${ls.map((l) => l.id).join(",")})`) : [];
      return { nguoiBan: s[0] ?? null, nguoiMua: b[0] ?? null, tin: ls, facts, treo };
    },
    async xoa(uid) { return rpc("reset_nguoi_test", { p_zalo: uid }).catch((e) => ({ ok: false, loi: String(e).slice(0, 160) })); },
  };
}

// Kho mẫu cho chế độ MÁY: 5 căn Quận 5 dựng tay (không phải dữ liệu khách thật), đủ để thử nhánh MUA có ra căn.
const KHO_MAU = [
  { code: "BDS-NP-Q5-9001", street: "Trần Hưng Đạo", ward: "Phường 1", price_raw: "5,2 tỷ", price_vnd: 5.2e9, area_m2: 48, frontage_m: 4, length_m: 12, floors: 3, floors_text: "trệt + 2 lầu", bedrooms: 3, access_type: "hem_xe_hoi", alley_width_m: 5, description: "Nhà hẻm 5m xe hơi vào tới cửa, gần chợ, sổ hồng riêng." },
  { code: "BDS-NP-Q5-9002", street: "Nguyễn Trãi", ward: "Phường 2", price_raw: "6 tỷ 3", price_vnd: 6.3e9, area_m2: 55, frontage_m: 4, length_m: 13.8, floors: 4, floors_text: "trệt + 3 lầu", bedrooms: 4, access_type: "hem_xe_hoi", alley_width_m: 4, description: "Nhà 4 tầng hẻm 4m, gần trường học." },
  { code: "BDS-NP-Q5-9003", street: "An Dương Vương", ward: "Phường 8", price_raw: "7 tỷ", price_vnd: 7e9, area_m2: 70, frontage_m: 5, length_m: 14, floors: 2, floors_text: "trệt + 1 lầu", bedrooms: 2, access_type: "mat_tien", description: "Mặt tiền đường lớn, tiện kinh doanh." },
  { code: "BDS-NP-Q5-9004", street: "Hùng Vương", ward: "Phường 4", price_raw: "4 tỷ 5", price_vnd: 4.5e9, area_m2: 36, frontage_m: 3.5, length_m: 10.3, floors: 3, floors_text: "trệt + 2 lầu", bedrooms: 2, access_type: "hem_xe_may", alley_width_m: 2.5, description: "Nhà hẻm xe máy, yên tĩnh, dọn vào ở ngay." },
  { code: "BDS-NP-Q5-9005", street: "Châu Văn Liêm", ward: "Phường 10", price_raw: "8 tỷ 8", price_vnd: 8.8e9, area_m2: 80, frontage_m: 4.5, length_m: 17.8, floors: 5, floors_text: "trệt + 4 lầu", bedrooms: 5, access_type: "hem_xe_hoi", alley_width_m: 6, description: "Nhà 5 tầng hẻm 6m, có thang máy." },
];

async function mayChuMay() {
  const API_KEY = layEnv("ANTHROPIC_API_KEY");
  const MODEL = layEnv("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6"; // như _shared/claude.ts
  // Cài SDK lần đầu (bun tìm node_modules từ vị trí file bundle, tức thư mục này).
  if (!existsSync(join(HERE, "node_modules", "@anthropic-ai", "sdk"))) {
    console.log(XAM("Cài gói lần đầu (bun install)…"));
    const r = Bun.spawnSync([process.execPath, "install"], { cwd: HERE, stdout: "inherit", stderr: "inherit" });
    if (r.exitCode !== 0) { console.error(DO("bun install lỗi")); process.exit(1); }
  }
  // Đóng gói chat-reply như e2e/chay.sh — mã bot THẬT trong repo, chỉ thay DB và (nếu không có khoá) model.
  const SRC = join(GOC, "bot", "supabase", "functions", "chat-reply", "index.ts");
  const BUNDLE = join(HERE, "chat-reply.chat.bundle.mjs");
  {
    const r = Bun.spawnSync([process.execPath, "build", SRC, "--target=node", "--external", "npm:*", "--outfile", BUNDLE]);
    if (r.exitCode !== 0) { console.error(new TextDecoder().decode(r.stderr)); process.exit(1); }
    const s = readFileSync(BUNDLE, "utf8")
      .replaceAll('"npm:@supabase/supabase-js@2"', '"../e2e/mock-supabase.mjs"')
      .replaceAll('"npm:@anthropic-ai/sdk/helpers/zod"', '"@anthropic-ai/sdk/helpers/zod"')
      .replaceAll('"npm:@anthropic-ai/sdk"', API_KEY ? '"@anthropic-ai/sdk"' : '"../e2e/mock-anthropic.mjs"')
      .replaceAll('"npm:zod@4"', '"zod"');
    writeFileSync(BUNDLE, s);
  }
  const { FakeDB, napPhuongThat, napPhuongCuThat, createClient } = await import("../e2e/mock-supabase.mjs");
  const PHUONG_CU = await napPhuongCuThat();
  const fetchThat = globalThis.fetch;
  // Chỉ cho model đi ra ngoài; Nominatim / ảnh Zalo / mọi URL khác trả 404 (chat-reply coi là đường đi bình thường).
  globalThis.fetch = async (url, opt) => (/api\.anthropic\.com/.test(String(url)) ? fetchThat(url, opt) : new Response("", { status: 404 }));
  const moi = () => {
    globalThis.__db = new FakeDB(); globalThis.__calls = []; globalThis.__rpc = {}; globalThis.__treTruyVan = null;
    const d = globalThis.__db;
    // 30/09/2026: bảng `wards` thật (168 phường) — như DB production, để chốt phường chạy đúng khi chat thử.
    d.t.wards = napPhuongThat().map((w) => ({ ...w }));
    d.t.phuong_cu = PHUONG_CU.map((c) => ({ ...c }));
    const chu = d.insert("sellers", { zalo_user_id: "may-kho-chu", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    for (const l of KHO_MAU) {
      d.insert("listings", { ...l, seller_id: chu.id, deal: "ban", status: "dang_ban", property_type: "nha_pho", district: "Quận 5", location_raw: l.street, legal_status: "so_hong_rieng" });
    }
  };
  moi();
  // Công tắc như production (boc_tach_ai 'chinh' từ 21/09). `test_reset_hello`: gõ "hello" là làm lại người đó.
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi", luat_loi_bot: "gon" };
  globalThis.__mauCau = { ban: "", mua: "" };
  const ENV = { SUPABASE_URL: "http://may", SUPABASE_SERVICE_ROLE_KEY: "svc", BRIDGE_SECRET: "s3cret", ANTHROPIC_API_KEY: API_KEY ?? "test-key", ANTHROPIC_MODEL: MODEL };
  globalThis.Deno = { serve: (h) => { globalThis.__handler = h; }, env: { get: (k) => ENV[k] } };
  await import(BUNDLE);
  const H = globalThis.__handler;
  let n = 0, daInLoi = 0;
  return {
    ten: `MÁY (DB giả · ${API_KEY ? `model thật ${MODEL}` : "model GIẢ — không có ANTHROPIC_API_KEY, chỉ thấy phần luật"})`,
    async kiemId() { return true; },
    async gui(uid, text) {
      const b = { msg_id: `c${++n}`, channel: "zalo_personal_test", external_user_id: uid, text };
      const tho = JSON.stringify(b);
      const hdrs = { "content-length": String(Buffer.byteLength(tho)), "x-bridge-secret": "s3cret" };
      // chat-reply in log vận hành (_ms, lỗi JSON của model giả…) ra console — tắt trong lúc gọi cho màn hình gọn.
      const [l, w, e] = [console.log, console.warn, console.error];
      if (!LOG) console.log = console.warn = console.error = () => {};
      let res, j;
      try {
        res = await H({ method: "POST", headers: { get: (k) => hdrs[k.toLowerCase()] ?? null }, text: async () => tho, json: async () => b });
        j = await res.json();
      } finally { [console.log, console.warn, console.error] = [l, w, e]; }
      if (res.status !== 200) throw new Error(`chat-reply HTTP ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
      // Lượt model hỏng thì bot vẫn trả lời bằng luật — không in sổ lỗi ra là người chạy tưởng model đang chạy.
      const loi = globalThis.__db.t.bot_errors ?? [];
      for (const x of loi.slice(daInLoi)) console.log(DO(`  sổ lỗi · ${x.source}: ${String(x.detail ?? "").slice(0, 200)}`));
      daInLoi = loi.length;
      return j.replies ?? (j.reply ? [j.reply] : []);
    },
    async tin(uid) {
      const t = globalThis.__db.t;
      const s = (t.sellers ?? []).find((x) => x.zalo_user_id === uid) ?? null;
      const b = (t.buyers ?? []).find((x) => x.zalo_user_id === uid) ?? null;
      const ls = s ? (t.listings ?? []).filter((l) => l.seller_id === s.id) : [];
      const ids = new Set(ls.map((l) => l.id));
      return {
        nguoiBan: s, nguoiMua: b, tin: ls,
        facts: (t.listing_facts ?? []).filter((f) => ids.has(f.listing_id)),
        treo: (t.info_requests ?? []).filter((q) => ids.has(q.listing_id) && q.status === "pending"),
      };
    },
    async xoa() { moi(); daInLoi = 0; return { ok: true }; },
    // Trang web nhiều người: chỉ xoá dữ liệu của MỘT người (như reset_nguoi_test thật), kho mẫu và người khác giữ nguyên.
    async xoaMot(uid) { return (await createClient().rpc("reset_nguoi_test", { p_zalo: uid })).data; },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
const COT_TIN = ["code", "status", "deal", "property_type", "district", "ward", "street", "location_raw", "price_raw", "price_vnd", "area_m2", "frontage_m", "length_m", "floors", "floors_text", "bedrooms", "access_type", "alley_width_m", "legal_status", "direction", "diem_tin"];
function inTinhTrang(k) {
  if (!k.nguoiBan && !k.nguoiMua) { console.log(XAM("  (chưa có hồ sơ nào cho người này)")); return; }
  if (k.nguoiMua) console.log(`  ${VANG("Hồ sơ mua:")} ${JSON.stringify(k.nguoiMua.preferences ?? {})}`);
  if (k.nguoiBan) console.log(`  ${VANG("Người bán:")} ${k.nguoiBan.seller_type ?? "?"}${k.nguoiBan.xung_ho ? ` · xưng "${k.nguoiBan.xung_ho}"` : ""}`);
  for (const l of k.tin) {
    const dong = COT_TIN.filter((c) => l[c] !== null && l[c] !== undefined && l[c] !== "").map((c) => `${c}=${typeof l[c] === "object" ? JSON.stringify(l[c]) : l[c]}`);
    console.log(`  ${VANG(`Tin ${l.code ?? l.id}${k.nguoiBan?.active_listing_id === l.id ? " (đang nói)" : ""}:`)} ${dong.join(" · ")}`);
    const fs = k.facts.filter((f) => f.listing_id === l.id);
    if (fs.length) console.log(`    facts: ${fs.map((f) => `${f.question}=${String(f.answer).slice(0, 40)}`).join(" · ")}`);
    const tq = k.treo.filter((q) => q.listing_id === l.id);
    if (tq.length) console.log(`    đang hỏi: ${tq.map((q) => q.question).join(", ")}`);
  }
}

const HUONG_DAN = `Gõ như khách nhắn Zalo rồi Enter. Lệnh: ${VANG("/tin")} xem tin + hồ sơ · ${VANG("/moi")} làm lại người mới · ${VANG("/giup")} · ${VANG("/thoat")}`;

const may = THAT ? await mayChuThat() : await mayChuMay();
let uid = giaTri("--id") ?? (THAT ? `thu-chat-${ngauNhien()}` : "may-khach");
if (!/^[a-z0-9-]{3,40}$/.test(uid) || !(await may.kiemId(uid))) {
  console.error(DO(`"${uid}" không phải ID thử (la_id_thu) — không chat bằng ID có thể là khách thật.`));
  process.exit(2);
}
if (THAT) {
  const r = await may.xoa(uid);
  if (r?.ok === false) console.log(VANG(`  (dọn trước: ${r.ly_do ?? r.loi ?? "không dọn được"})`));
}
console.log(`${XANH("Chat thử bot")} — ${may.ten} · ID ${uid}`);
console.log(XAM(HUONG_DAN));

if (WEB) {
  if (THAT) { console.error(DO("--web chỉ chạy chế độ MÁY (DB giả), không bắn production.")); process.exit(2); }
  // 07/10/2026 (chủ dự án: "vài người test 1 lúc dc ko"): mỗi trình duyệt tự sinh một mã khách `web-xxxxxxxx` (lưu ở máy
  // người thử) và gửi kèm mỗi lượt — mỗi mã là một người riêng trong DB giả, chung kho 5 căn mẫu. Lượt của mọi người vẫn
  // xử lý TUẦN TỰ (chat-reply dùng biến toàn cục + DB giả trong bộ nhớ, hai lượt chen nhau là rối): đông người thì chờ vài
  // giây. Trần lượt chung cho cả lần chạy để link lỡ lộ ra cũng không đốt quá nhiều credit model.
  const TRAN = Number(giaTri("--tran") ?? 300) || 300;
  let soLuot = 0, hang = Promise.resolve();
  const lichSuCua = new Map();
  const lichSu = (id) => { if (!lichSuCua.has(id)) lichSuCua.set(id, []); return lichSuCua.get(id); };
  const maKhach = (req) => { const m = String(req.headers.get("x-khach") ?? ""); return /^web-[a-z0-9]{6,16}$/.test(m) ? m : null; };
  const tuanTu = (fn) => { const p = hang.then(fn, fn); hang = p.catch(() => {}); return p; };
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { "content-type": "application/json; charset=utf-8" } });
  const port = Number(giaTri("--port") ?? process.env.PORT ?? 3000) || 3000;
  Bun.serve({
    port,
    async fetch(req) {
      const u = new URL(req.url);
      if (req.method === "GET" && u.pathname === "/") return new Response(TRANG_WEB_HTML().replace("__TEN__", may.ten), { headers: { "content-type": "text/html; charset=utf-8" } });
      if (u.pathname === "/") return new Response("không có", { status: 404 });
      const id = maKhach(req);
      if (!id) return json({ loi: "thiếu mã khách" }, 400);
      if (req.method === "GET" && u.pathname === "/lich-su") return json({ lichSu: lichSu(id), conLai: TRAN - soLuot, nguoi: lichSuCua.size });
      if (req.method === "GET" && u.pathname === "/tin") return json(await may.tin(id));
      if (req.method === "POST" && u.pathname === "/moi") return tuanTu(async () => { await may.xoaMot(id); lichSu(id).length = 0; return json({ ok: true }); });
      if (req.method === "POST" && u.pathname === "/gui") {
        const b = await req.json().catch(() => ({}));
        const text = String(b?.text ?? "").trim().slice(0, 2000);
        if (!text) return json({ loi: "trống" }, 400);
        if (soLuot >= TRAN) return json({ loi: `hết ${TRAN} lượt của lần chạy này — chạy lại lệnh để chat tiếp` }, 429);
        return tuanTu(async () => {
          soLuot++;
          const ls = lichSu(id);
          ls.push({ ai: "khach", text });
          const t0 = Date.now();
          try {
            const replies = (await may.gui(id, text)).map(String);
            for (const r of replies) ls.push({ ai: "bot", text: r });
            return json({ replies, ms: Date.now() - t0, conLai: TRAN - soLuot });
          } catch (e) {
            const loi = String(e?.message ?? e).slice(0, 300);
            ls.push({ ai: "loi", text: loi });
            return json({ loi }, 500);
          }
        });
      }
      return new Response("không có", { status: 404 });
    },
  });
  console.log(`${XANH("Trang chat:")} http://localhost:${port}  ${XAM(`(Ctrl+C để tắt · trần ${TRAN} lượt)`)}`);
} else {
let dangDon = false;
async function thoat(ma = 0) {
  if (dangDon) return;
  dangDon = true;
  if (THAT && !GIU) {
    const r = await may.xoa(uid);
    console.log(XAM(`\nĐã dọn người thử ${uid}: ${JSON.stringify(r)}`));
  } else if (THAT) {
    console.log(XAM(`\nGiữ nguyên dữ liệu ${uid} (--giu). Dọn sau: bun run chat -- --that --id ${uid}, rồi /thoat.`));
  }
  process.exit(ma);
}
process.on("SIGINT", () => { thoat(0); });

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: TTY });
const nhac = () => { if (TTY) { rl.setPrompt(XANH("Bạn › ")); rl.prompt(); } };
nhac();
for await (const dongVao of rl) {
  const text = dongVao.trim();
  if (!text) { nhac(); continue; }
  if (!TTY) console.log(`${XANH("Bạn › ")}${text}`);
  try {
    if (text === "/thoat" || text === "/q") break;
    if (text === "/giup") console.log(XAM(HUONG_DAN));
    else if (text === "/tin") inTinhTrang(await may.tin(uid));
    else if (text === "/moi") {
      await may.xoa(uid);
      if (THAT && !giaTri("--id")) uid = `thu-chat-${ngauNhien()}`;
      console.log(XAM(`  Làm lại từ đầu · ID ${uid}`));
    } else {
      const t0 = Date.now();
      const replies = await may.gui(uid, text);
      if (!replies.length) console.log(XAM("  (bot không trả lời lượt này)"));
      for (const r of replies) console.log(`${VANG("Bot  › ")}${String(r).replace(/\n/g, "\n       ")}`);
      console.log(XAM(`  ${((Date.now() - t0) / 1000).toFixed(1)}s`));
    }
  } catch (e) {
    console.log(DO(`  Lỗi: ${String(e?.message ?? e).slice(0, 300)}`));
  }
  nhac();
}
await thoat(0);
}

// Trang chat một khung, dáng Zalo. Không thư viện ngoài, không lưu gì phía trình duyệt; lịch sử giữ ở máy chạy lệnh.
function TRANG_WEB_HTML() {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chat thử bot</title><style>
:root{--nen:#e9ebef;--ban:#fff;--khach:#dbeafe;--chu:#0f172a;--mo:#64748b;--vien:#d0d5dd;--chinh:#0068ff}
@media (prefers-color-scheme:dark){:root{--nen:#0f141a;--ban:#1c232c;--khach:#163a6b;--chu:#e6e9ee;--mo:#94a3b8;--vien:#2c3540;--chinh:#4d9bff}}
*{box-sizing:border-box}body{margin:0;background:var(--nen);color:var(--chu);font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;height:100dvh;display:flex;flex-direction:column}
header{background:var(--ban);border-bottom:1px solid var(--vien);padding:10px 16px;display:flex;gap:10px;align-items:center}
header b{flex:1}header small{color:var(--mo);display:block;font-weight:400}
button{font:inherit;border:1px solid var(--vien);background:var(--ban);color:var(--chu);border-radius:8px;padding:6px 10px;cursor:pointer}
#khung{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:6px}
.b{max-width:min(78%,640px);padding:9px 12px;border-radius:10px;white-space:pre-wrap;word-wrap:break-word;box-shadow:0 1px 1px rgba(0,0,0,.06)}
.bot{background:var(--ban);align-self:flex-start}.khach{background:var(--khach);align-self:flex-end}
.loi{background:#fee2e2;color:#991b1b;align-self:center;font-size:13px}.mo{color:var(--mo);font-size:12px;align-self:center}
form{display:flex;gap:8px;padding:10px 16px;background:var(--ban);border-top:1px solid var(--vien)}
textarea{flex:1;resize:none;font:inherit;padding:9px 12px;border-radius:10px;border:1px solid var(--vien);background:var(--nen);color:var(--chu);max-height:140px}
form button{background:var(--chinh);color:#fff;border:0;padding:0 18px}
pre{white-space:pre-wrap;font-size:12px;background:var(--ban);border:1px solid var(--vien);border-radius:10px;padding:10px;margin:0;align-self:stretch}
</style></head><body>
<header><b>Chat thử bot<small>__TEN__</small></b><button id="xemTin" type="button">Xem tin</button><button id="lamLai" type="button">Làm lại</button></header>
<div id="khung"></div>
<form id="f"><textarea id="o" rows="1" placeholder="Nhắn như khách Zalo… (Enter để gửi, Shift+Enter xuống dòng)"></textarea><button>Gửi</button></form>
<script>
let MA='';try{MA=localStorage.getItem('ma-khach')||'';}catch(e){}
if(!/^web-[a-z0-9]{6,16}$/.test(MA)){MA='web-'+Math.random().toString(36).slice(2,10).padEnd(8,'0');try{localStorage.setItem('ma-khach',MA);}catch(e){}}
const H={'x-khach':MA};
const khung=document.getElementById('khung'),o=document.getElementById('o');
const them=(ai,text)=>{const d=document.createElement(ai==='tin'?'pre':'div');d.className=ai==='tin'?'':'b '+ai;if(ai==='mo')d.className='mo';d.textContent=text;khung.appendChild(d);khung.scrollTop=khung.scrollHeight;return d;};
fetch('lich-su',{headers:H}).then(r=>r.json()).then(j=>{for(const m of j.lichSu)them(m.ai,m.text);them('mo','Bạn là khách '+MA+' · còn '+j.conLai+' lượt chung');}).catch(()=>{});
let dang=false;
async function gui(){const text=o.value.trim();if(!text||dang)return;dang=true;o.value='';them('khach',text);const cho=them('mo','bot đang gõ…');
 try{const r=await fetch('gui',{method:'POST',headers:{...H,'content-type':'application/json'},body:JSON.stringify({text})});const j=await r.json();cho.remove();
  if(j.loi)them('loi',j.loi);else{if(!j.replies.length)them('mo','(bot không trả lời lượt này)');for(const x of j.replies)them('bot',x);them('mo',(j.ms/1000).toFixed(1)+'s');}}
 catch(e){cho.remove();them('loi','Mất kết nối: '+e);}dang=false;o.focus();}
document.getElementById('f').onsubmit=e=>{e.preventDefault();gui();};
o.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();gui();}};
document.getElementById('lamLai').onclick=async()=>{if(!confirm('Xoá cuộc chat, làm lại như khách mới?'))return;await fetch('moi',{method:'POST',headers:H});khung.innerHTML='';them('mo','Đã làm lại từ đầu');};
document.getElementById('xemTin').onclick=async()=>{const j=await fetch('tin',{headers:H}).then(r=>r.json());
 const dong=[];if(j.nguoiMua)dong.push('Hồ sơ mua: '+JSON.stringify(j.nguoiMua.preferences||{}));if(j.nguoiBan)dong.push('Người bán: '+(j.nguoiBan.seller_type||'?'));
 for(const l of j.tin){const c=Object.entries(l).filter(([k,v])=>v!==null&&v!==''&&typeof v!=='object'&&!/(_id|^id|_at)$/.test(k)).map(([k,v])=>k+'='+v);dong.push('Tin: '+c.join(' · '));
  const fs=j.facts.filter(f=>f.listing_id===l.id);if(fs.length)dong.push('  facts: '+fs.map(f=>f.question+'='+String(f.answer).slice(0,40)).join(' · '));
  const tq=j.treo.filter(q=>q.listing_id===l.id);if(tq.length)dong.push('  đang hỏi: '+tq.map(q=>q.question).join(', '));}
 them('tin',dong.length?dong.join('\\n'):'(chưa có hồ sơ nào)');};
o.focus();
</script></body></html>`;
}
