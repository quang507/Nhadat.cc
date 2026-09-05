#!/usr/bin/env node
// zalo-webhook — CỬA VÀO TỪ INTERNET. Bộ kiểm chữ ký + phát lại (SEC-01, FR-166).
//
// ═══════════════ VÌ SAO CÓ FILE NÀY ═══════════════
// `zalo-webhook` chạy `verify_jwt=false` (Zalo không ký được JWT của Supabase),
// nên chữ ký `X-ZEvent-Signature` là hàng rào DUY NHẤT giữa Internet và bộ não.
// Vậy mà tới 05/09/2026 nó là edge function đối mặt Internet DUY NHẤT không có
// lấy một ca kiểm tự động nào: bản fail-open sống từ ngày viết tới 05/09 mà
// không có gì kêu, và bản vá fail-closed cũng không có gì chứng minh là đúng.
//
// Bộ này chạy HANDLER THẬT (bundle từ chính index.ts), không chép lại regex hay
// công thức như mấy file bot/tests/*.mjs đời đầu — chép là mở đường cho "test
// xanh, hàm thật đã đổi".
//
// SECRET DÙNG Ở ĐÂY LÀ SECRET BỊA, sống trong tiến trình test:
//   ZALO_APP_ID = "app-gia-123", ZALO_APP_SECRET = "bi-mat-gia-de-kiem"
// Chúng đi qua `globalThis.__vault` (Vault giả trong mock-supabase). Bộ kiểm
// KHÔNG đọc env thật, KHÔNG gọi Vault thật, KHÔNG cần secret production —
// đó chính là yêu cầu "local/test phải có cách test riêng".
//
//     node bot/tests/e2e/webhook.mjs   (chạy sau khi chay.sh dựng bundle)

import { FakeDB } from "./mock-supabase.mjs";

// ── Vault giả ────────────────────────────────────────────────────────────────
const APP_ID = "app-gia-123";
const APP_SECRET = "bi-mat-gia-de-kiem";
const VAULT_DAY = (n) =>
  n === "ZALO_APP_ID" ? { data: APP_ID, error: null }
  : n === "ZALO_APP_SECRET" ? { data: APP_SECRET, error: null }
  : { data: null, error: null };
const VAULT_RONG = () => ({ data: null, error: null });
// Cảnh CÓ THẬT ở production 05/09/2026 02:11:59: `get_secret` trả lỗi
// "JWT issued at future" (lệch đồng hồ giữa container edge và DB). Đọc hụt ≠
// chưa đặt, và code phải chặn ở cả hai — nhưng bằng hai mã lỗi khác nhau, vì
// người trực cần biết nên đi đặt secret hay đi xem đồng hồ.
const VAULT_HUT = () => ({ data: null, error: { message: "JWT issued at future" } });

// ── Môi trường Deno giả ──────────────────────────────────────────────────────
// ENV đọc SỐNG (`get: (k) => ENV[k]`) nên ca kiểm bật/tắt cờ giữa chừng được.
const ENV = {
  SUPABASE_URL: "http://x",
  SUPABASE_SERVICE_ROLE_KEY: "svc",
  ANTHROPIC_API_KEY: "test-key",
};
globalThis.Deno = { serve: (h) => { globalThis.__handler = h; }, env: { get: (k) => ENV[k] } };

// `EdgeRuntime.waitUntil` là chỗ việc thật chạy sau khi đã ack 200. Giữ lại
// promise để ca kiểm await được — không thì mọi khẳng định về "đã gửi bong
// bóng" đều đo lúc việc chưa chạy xong, và test xanh vì đo hụt.
let nen = [];
globalThis.EdgeRuntime = { waitUntil: (p) => { nen.push(p); } };
const xongViecNen = async () => { const d = nen; nen = []; await Promise.allSettled(d); };

// ── fetch giả: chặn hai đích ngoài (chat-reply và OA API) ────────────────────
let naoTraVe = { replies: ["Dạ em ghi nhận rồi ạ."] };
let daGuiOA = [];
globalThis.fetch = async (url, opt = {}) => {
  const u = String(url);
  if (u.includes("/functions/v1/chat-reply")) {
    return { status: 200, json: async () => naoTraVe };
  }
  if (u.includes("openapi.zalo.me")) {
    daGuiOA.push(JSON.parse(opt.body ?? "{}"));
    return { status: 200, json: async () => ({ error: 0 }) };
  }
  throw new Error(`fetch ngoài dự kiến: ${u}`);
};

await import("./zalo-webhook.bundle.mjs");
const H = globalThis.__handler;

// ── tiện ích ─────────────────────────────────────────────────────────────────
const hex = async (s) => {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
};
// Công thức chép TỪ index.ts, CỐ Ý không "sửa cho đẹp": `appId + raw + ts +
// secret`, tiền tố `mac=`. Không xác minh lại được với tài liệu Zalo trong môi
// trường này (developers.zalo.me bị proxy chặn 05/09/2026), nên bộ kiểm này
// khẳng định "code khớp chính nó", KHÔNG khẳng định "code khớp Zalo". Ai mở
// được tài liệu thì đối chiếu đúng dòng dưới đây rồi ghi lại kết quả vào đây.
const kyThat = async (raw, ts) => `mac=${await hex(`${APP_ID}${raw}${ts}${APP_SECRET}`)}`;

async function goi(raw, hdrs = {}) {
  const h = {};
  for (const [k, v] of Object.entries(hdrs)) if (v !== undefined) h[k.toLowerCase()] = v;
  const res = await H({
    method: "POST",
    headers: { get: (k) => h[k.toLowerCase()] ?? null },
    text: async () => raw,
    json: async () => JSON.parse(raw),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const suKien = (msgId, text = "chào em", ts = Date.now()) => JSON.stringify({
  event_name: "user_send_text",
  timestamp: String(ts),
  sender: { id: "zalo-user-1" },
  message: { msg_id: msgId, text },
});

const R = [];
const check = (n, ok, d = "") => R.push([n, !!ok, d]);
const db = () => globalThis.__db;
function moi() {
  globalThis.__db = new FakeDB();
  globalThis.__calls = []; globalThis.__rpc = {};
  daGuiOA = []; nen = [];
  naoTraVe = { replies: ["Dạ em ghi nhận rồi ạ."] };
  delete ENV.ALLOW_UNVERIFIED_WEBHOOK;
}
const soLoi = (chua) => db().t.bot_errors.filter((e) => String(e.source).includes(chua));

// ═════════════════════ (1) CHỮ KÝ ĐÚNG ═════════════════════
{
  moi(); globalThis.__vault = VAULT_DAY;
  const ts = Date.now(); const raw = suKien("m-ok", "chào em", ts);
  const r = await goi(raw, { "X-ZEvent-Signature": await kyThat(raw, String(ts)) });
  await xongViecNen();
  check("CK-1 chữ ký ĐÚNG → 200 ok", r.status === 200 && r.body.ok === true, JSON.stringify(r));
  check("CK-1 sự kiện được ghi vào inbound_events",
    db().t.inbound_events.length === 1 && db().t.inbound_events[0].event_id === "m-ok",
    JSON.stringify(db().t.inbound_events));
}

// ═════════════════════ (2) CHỮ KÝ SAI ═════════════════════
{
  moi(); globalThis.__vault = VAULT_DAY;
  const ts = Date.now(); const raw = suKien("m-sai", "chào em", ts);
  const r = await goi(raw, { "X-ZEvent-Signature": `mac=${"0".repeat(64)}` });
  await xongViecNen();
  check("CK-2 chữ ký SAI → 401 invalid_signature",
    r.status === 401 && r.body.error === "invalid_signature", JSON.stringify(r));
  check("CK-2 KHÔNG ghi sự kiện, KHÔNG gọi bộ não, KHÔNG gửi OA",
    db().t.inbound_events.length === 0 && daGuiOA.length === 0, JSON.stringify(db().t.inbound_events));
  check("CK-2 có ghi sổ 'SAI CHU KY'", soLoi("SAI CHU KY").length === 1,
    JSON.stringify(db().t.bot_errors.map((e) => e.source)));
}

// ═════════════════════ (3) THIẾU CHỮ KÝ ═════════════════════
// Không gửi header nào cả. Phải rơi vào đúng nhánh "sai chữ ký", KHÔNG được
// coi header rỗng là "chắc bên gọi tin cậy".
{
  moi(); globalThis.__vault = VAULT_DAY;
  const ts = Date.now(); const raw = suKien("m-thieu-sig", "chào em", ts);
  const r = await goi(raw);
  await xongViecNen();
  check("CK-3 THIẾU header chữ ký → 401, không cho qua",
    r.status === 401 && r.body.error === "invalid_signature", JSON.stringify(r));
  check("CK-3 không ghi sự kiện", db().t.inbound_events.length === 0, "");
}

// ═════════════════════ (4) THIẾU SECRET ═════════════════════
// Đây là lỗ SEC-01 cũ: Vault rỗng → bỏ qua verify → xử lý tiếp.
{
  moi(); globalThis.__vault = VAULT_RONG;
  const raw = suKien("m-khong-secret");
  const r = await goi(raw, { "X-ZEvent-Signature": "mac=bat-ky" });
  await xongViecNen();
  check("CK-4 THIẾU SECRET → 503 signature_unconfigured (KHÔNG fail-open)",
    r.status === 503 && r.body.error === "signature_unconfigured", JSON.stringify(r));
  check("CK-4 không ghi sự kiện, không gọi bộ não",
    db().t.inbound_events.length === 0 && daGuiOA.length === 0, "");
  check("CK-4 có ghi sổ 'CHUA CO CHU KY'", soLoi("CHUA CO CHU KY").length === 1,
    JSON.stringify(db().t.bot_errors.map((e) => e.source)));
}

// (4b) ĐỌC HỤT Vault — cảnh đã xảy ra thật ở production hôm nay. Phải chặn,
// nhưng bằng mã lỗi KHÁC để người trực biết đi sửa cái gì.
{
  moi(); globalThis.__vault = VAULT_HUT;
  const r = await goi(suKien("m-vault-hut"), { "X-ZEvent-Signature": "mac=bat-ky" });
  await xongViecNen();
  check("CK-4b ĐỌC HỤT Vault → 503 signature_unavailable (khác 'chưa đặt')",
    r.status === 503 && r.body.error === "signature_unavailable", JSON.stringify(r));
  check("CK-4b ghi sổ 'VAULT HUT' kèm nguyên văn lỗi",
    soLoi("VAULT HUT").length === 1 &&
    String(soLoi("VAULT HUT")[0].detail).includes("JWT issued at future"),
    JSON.stringify(soLoi("VAULT HUT")));
}

// (4c) CỬA THOÁT CÓ CHỦ Ý — chạy tạm không chữ ký phải là hành động TƯỜNG MINH
// (đặt cờ), không phải hệ quả của việc quên đặt secret.
{
  moi(); globalThis.__vault = VAULT_RONG; ENV.ALLOW_UNVERIFIED_WEBHOOK = "1";
  const r = await goi(suKien("m-co-y"), {});
  await xongViecNen();
  check("CK-4c cờ ALLOW_UNVERIFIED_WEBHOOK=1 → cho qua (cửa thoát còn dùng được)",
    r.status === 200 && r.body.ok === true, JSON.stringify(r));
  check("CK-4c nhưng KÊU mỗi lượt: ghi sổ 'KHONG VERIFY'",
    soLoi("KHONG VERIFY").length === 1, JSON.stringify(db().t.bot_errors.map((e) => e.source)));
  delete ENV.ALLOW_UNVERIFIED_WEBHOOK;
}

// (4d) TIMESTAMP LỆCH — chữ ký đúng vẫn phát lại được mãi nếu không ràng giờ.
{
  moi(); globalThis.__vault = VAULT_DAY;
  const ts = Date.now() - 60 * 60 * 1000; // một giờ trước
  const raw = suKien("m-cu", "chào em", ts);
  const r = await goi(raw, { "X-ZEvent-Signature": await kyThat(raw, String(ts)) });
  check("CK-4d chữ ký đúng nhưng timestamp cũ 1 giờ → 401 stale_timestamp",
    r.status === 401 && r.body.error === "stale_timestamp", JSON.stringify(r));
}

// ═════════════════════ (5) BODY HỎNG ═════════════════════
{
  moi(); globalThis.__vault = VAULT_DAY;
  const r = await goi("{khong-phai-json", { "X-ZEvent-Signature": "mac=x" });
  check("CK-5 body không phải JSON → 400, không 500", r.status === 400, JSON.stringify(r));
}
{
  moi(); globalThis.__vault = VAULT_DAY;
  const r = await goi('"chuoi-json-hop-le-nhung-khong-phai-object"', {});
  check("CK-5 JSON hợp lệ nhưng không phải object → 400", r.status === 400, JSON.stringify(r));
}
{
  moi(); globalThis.__vault = VAULT_DAY;
  const r = await goi("x".repeat(65 * 1024), {});
  check("CK-5 body > 64 KB → 413, chặn trước khi parse", r.status === 413, JSON.stringify(r));
}

// ═════════════════════ (6) GIAO TRÙNG ═════════════════════
// Zalo giao lại cùng một sự kiện là chuyện bình thường. Phải đếm thêm chứ
// không đẻ dòng thứ hai — nếu không, mọi thứ đếm theo sổ đều sai.
{
  moi(); globalThis.__vault = VAULT_DAY;
  const ts = Date.now(); const raw = suKien("m-trung", "chào em", ts);
  const sig = await kyThat(raw, String(ts));
  const r1 = await goi(raw, { "X-ZEvent-Signature": sig });
  const r2 = await goi(raw, { "X-ZEvent-Signature": sig });
  await xongViecNen();
  const ev = db().t.inbound_events;
  check("CK-6 giao trùng → cả hai lượt 200", r1.status === 200 && r2.status === 200, "");
  check("CK-6 vẫn MỘT dòng sự kiện, delivery_count = 2",
    ev.length === 1 && ev[0].delivery_count === 2, JSON.stringify(ev));
}

// ═════════════════════ (7) PHÁT LẠI — KHÔNG QUYỀN ═════════════════════
{
  moi(); globalThis.__vault = VAULT_DAY;
  db().t.inbound_events.push({ event_id: "ev-1", payload: JSON.parse(suKien("ev-1")), delivery_count: 1 });
  const r = await goi(JSON.stringify({ replay_event_id: "ev-1" }));
  check("CK-7 replay_event_id KHÔNG có service key → 403",
    r.status === 403 && r.body.error === "forbidden", JSON.stringify(r));
  const r2 = await goi(JSON.stringify({ replay_event_id: "ev-1" }),
    { authorization: "Bearer KHONG-PHAI-SVC" });
  check("CK-7 Bearer sai → vẫn 403", r2.status === 403, JSON.stringify(r2));
}

// ═════════════════════ (8) PHÁT LẠI — SERVICE-ROLE ═════════════════════
{
  moi(); globalThis.__vault = VAULT_DAY;
  db().t.inbound_events.push({ event_id: "ev-2", payload: JSON.parse(suKien("ev-2")), delivery_count: 1 });
  globalThis.__vaultOA = true; // để handleEvent lấy được token OA giả bên dưới
  globalThis.__vault = (n) => n === "ZALO_OA_ACCESS_TOKEN"
    ? { data: "token-gia", error: null } : VAULT_DAY(n);
  const r = await goi(JSON.stringify({ replay_event_id: "ev-2" }), { authorization: "Bearer svc" });
  check("CK-8 replay + service-role → 200, đúng event",
    r.status === 200 && r.body.ok === true && r.body.replayed_event === "ev-2", JSON.stringify(r));
  check("CK-8 việc thật CHẠY: bong bóng đã đi qua OA API",
    daGuiOA.length === 1, JSON.stringify(daGuiOA).slice(0, 200));
}

// (8b) BẤT BIẾN QUAN TRỌNG NHẤT CỦA ĐỢT NÀY: siết chữ ký KHÔNG được phá đường
// cứu. `inbound-sweep` gọi cửa phát lại bằng service key và KHÔNG có chữ ký
// Zalo — nó phát lại sự kiện lấy từ sổ, làm gì có chữ ký. Nếu ai đó "dọn dẹp"
// bằng cách đưa khối verify lên trước khối replay thì đường cứu chết câm, mà
// không ca nào khác thấy.
{
  moi(); globalThis.__vault = VAULT_RONG; // Vault RỖNG: webhook thường sẽ 503
  db().t.inbound_events.push({ event_id: "ev-3", payload: JSON.parse(suKien("ev-3")), delivery_count: 1 });
  const r = await goi(JSON.stringify({ replay_event_id: "ev-3" }), { authorization: "Bearer svc" });
  check("CK-8b THIẾU SECRET vẫn phát lại được (inbound-sweep không gãy)",
    r.status === 200 && r.body.replayed_event === "ev-3", JSON.stringify(r));
}

// (8c) Phát lại sự kiện không có trong sổ → 404, không 200 giả vờ.
{
  moi(); globalThis.__vault = VAULT_DAY;
  const r = await goi(JSON.stringify({ replay_event_id: "khong-co" }), { authorization: "Bearer svc" });
  check("CK-8c phát lại sự kiện lạ → 404, không nói dối đường cứu", r.status === 404, JSON.stringify(r));
}

// ── kết ──
let hong = 0;
for (const [n, ok, d] of R) {
  if (!ok) hong++;
  console.log(`${ok ? "✓" : "✗"} ${n}${ok ? "" : "\n     → " + String(d).slice(0, 400)}`);
}
console.log(hong ? `\n${hong}/${R.length} CA HỎNG` : `\nTẤT CẢ ${R.length} CA ZALO-WEBHOOK ĐẠT`);
process.exit(hong ? 1 : 0);
