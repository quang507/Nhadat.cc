// TS-GROQ-04/05 — thứ tự model (FR-194 b, 15/09/2026).
//
// Chủ dự án: "dùng con groq trả lời trước nếu bị chặn trần thì fall back về
// claude api liền luôn". Bài này dựng Groq giả bằng `globalThis.fetch` và Claude
// giả bằng một object có `messages.create/parse`, rồi đếm AI được gọi, theo thứ
// tự nào, trong từng cảnh: Groq trả lời được · Groq 429 cả danh sách · Groq 400
// (lỗi không phải nhịp) · lượt có ẢNH · đường cũ `claude`. Không gọi ra ngoài,
// không tốn một đồng.
import { bocDuPhong } from "../supabase/functions/_shared/groq.ts";

let dat = 0, hong = 0;
const ok = (t) => { dat++; console.log(`✓ ${t}`); };
const ko = (t, chi) => { hong++; console.log(`✗ ${t}\n    ${chi}`); };
const la = (t, thuc, mong) => {
  const a = JSON.stringify(thuc), b = JSON.stringify(mong);
  a === b ? ok(t) : ko(t, `thật ${a}\n    mong ${b}`);
};

console.log("TS-GROQ-04/05 — thứ tự model Groq → Claude\n");

// ── Dàn cảnh ────────────────────────────────────────────────────────────────
// `kichBan[model]` = mã HTTP Groq trả cho model đó (200 kèm chữ, hoặc số lỗi).
let kichBan = {};
let goiGroq = [];   // model đã gọi, theo thứ tự
let goiClaude = []; // "create"/"parse" đã gọi
let claudeNem = null; // Claude ném lỗi này nếu khác null
let soGhiSo = 0;

globalThis.fetch = async (url, init) => {
  if (!/api\.groq\.com/.test(String(url))) throw new Error(`fetch lạ: ${url}`);
  const than = JSON.parse(init.body);
  goiGroq.push(than.model);
  const kb = kichBan[than.model] ?? 200;
  if (kb !== 200) return new Response(`loi ${kb}`, { status: kb });
  return new Response(JSON.stringify({
    choices: [{ message: { content: `groq:${than.model}` } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  }), { status: 200, headers: { "content-type": "application/json" } });
};
const claude = {
  messages: {
    create: async () => { goiClaude.push("create"); if (claudeNem) throw claudeNem; return { content: [{ type: "text", text: "claude" }] }; },
    parse: async () => { goiClaude.push("parse"); if (claudeNem) throw claudeNem; return { content: [{ type: "text", text: "claude" }], parsed_output: { a: 1 } }; },
  },
};
const ghiSo = async () => { soGhiSo++; };
const reset = () => { kichBan = {}; goiGroq = []; goiClaude = []; claudeNem = null; soGhiSo = 0; };
const P = { messages: [{ role: "user", content: "xin chào" }], max_tokens: 200 };
const P_ANH = { messages: [{ role: "user", content: [{ type: "image", source: {} }, { type: "text", text: "ảnh gì" }] }] };
const DS = "m1,m2";
const chu = (r) => r?.content?.[0]?.text;

// ── Groq trước (mặc định của hệ thống từ 15/09) ─────────────────────────────
{
  reset();
  const c = bocDuPhong(claude, "k", DS, ghiSo, "groq");
  const r = await c.messages.create(P);
  la("groq trước: Groq m1 trả lời → Claude KHÔNG được gọi", [chu(r), goiGroq, goiClaude], ["groq:m1", ["m1"], []]);
  la("groq trước: không ghi sổ lỗi", soGhiSo, 0);
}
{
  reset(); kichBan = { m1: 429 };
  const c = bocDuPhong(claude, "k", DS, ghiSo, "groq");
  const r = await c.messages.create(P);
  la("groq trước: m1 chạm trần → xoay m2, vẫn chưa đụng Claude", [chu(r), goiGroq, goiClaude], ["groq:m2", ["m1", "m2"], []]);
}
{
  reset(); kichBan = { m1: 429, m2: 429 };
  const c = bocDuPhong(claude, "k", DS, ghiSo, "groq");
  const r = await c.messages.create(P);
  la("groq trước: cả danh sách chạm trần → Claude LIỀN trong cùng lượt", [chu(r), goiGroq, goiClaude], ["claude", ["m1", "m2"], ["create"]]);
  la("groq trước: chạm trần là đường bình thường — KHÔNG vào sổ lỗi", soGhiSo, 0);
}
{
  reset(); kichBan = { m1: 503, m2: 500 };
  const c = bocDuPhong(claude, "k", DS, ghiSo, "groq");
  const r = await c.messages.parse({ ...P, output_config: { format: { type: "json_schema", schema: { type: "object" } } } });
  la("groq trước: Groq 5xx cả danh sách → Claude parse", [r?.parsed_output, goiGroq, goiClaude], [{ a: 1 }, ["m1", "m2"], ["parse"]]);
}
{
  reset(); kichBan = { m1: 400 };
  const c = bocDuPhong(claude, "k", DS, ghiSo, "groq");
  const r = await c.messages.create(P);
  la("groq trước: Groq 400 (không phải nhịp) → không xoay m2, sang Claude luôn", [chu(r), goiGroq, goiClaude], ["claude", ["m1"], ["create"]]);
}
{
  reset();
  const c = bocDuPhong(claude, "k", DS, ghiSo, "groq");
  const r = await c.messages.create(P_ANH);
  la("groq trước: lượt có ẢNH đi thẳng Claude, Groq không được gọi", [chu(r), goiGroq, goiClaude], ["claude", [], ["create"]]);
}
{
  reset(); kichBan = { m1: 429, m2: 429 }; claudeNem = Object.assign(new Error("credit balance is too low"), { status: 400 });
  const c = bocDuPhong(claude, "k", DS, ghiSo, "groq");
  let loi = null;
  try { await c.messages.create(P); } catch (e) { loi = e.message; }
  la("groq trước: Groq chạm trần VÀ Claude hết tiền → ném lỗi Claude lên (tầng gọi có câu mẫu)", [loi, goiGroq, goiClaude], ["credit balance is too low", ["m1", "m2"], ["create"]]);
}
{
  reset(); kichBan = { m1: 429, m2: 429 };
  const c = bocDuPhong(null, "k", DS, ghiSo, "groq");
  let loi = null;
  try { await c.messages.create(P); } catch (e) { loi = e.message.slice(0, 8); }
  la("groq trước, không khoá Claude: hết danh sách thì ném lỗi Groq", [loi, goiGroq], ["Groq 429", ["m1", "m2"]]);
}

// ── Đường cũ: Claude trước (MODEL_TRUOC=claude) ─────────────────────────────
{
  reset();
  const c = bocDuPhong(claude, "k", DS, ghiSo, "claude");
  const r = await c.messages.create(P);
  la("claude trước: Claude trả lời → Groq KHÔNG được gọi", [chu(r), goiGroq, goiClaude], ["claude", [], ["create"]]);
}
{
  reset(); claudeNem = Object.assign(new Error("rate limit"), { status: 429 });
  const c = bocDuPhong(claude, "k", DS, ghiSo, "claude");
  const r = await c.messages.create(P);
  la("claude trước: Claude 429 → Groq m1, có ghi sổ 1 dòng", [chu(r), goiGroq, goiClaude, soGhiSo], ["groq:m1", ["m1"], ["create"], 1]);
}
{
  reset(); claudeNem = Object.assign(new Error("invalid_request_error"), { status: 400 });
  const c = bocDuPhong(claude, "k", DS, ghiSo, "claude");
  let loi = null;
  try { await c.messages.create(P); } catch (e) { loi = e.message; }
  la("claude trước: lỗi 400 sai tham số KHÔNG đổi sang Groq (đổi model không chữa được)", [loi, goiGroq], ["invalid_request_error", []]);
}
{
  reset();
  const c = bocDuPhong(claude, "k", DS, ghiSo);
  const r = await c.messages.create(P);
  la("không truyền thứ tự: giữ đường cũ Claude trước (tham số mặc định của hàm)", [chu(r), goiGroq], ["claude", []]);
}

console.log(`\n${dat} đạt, ${hong} hỏng`);
process.exit(hong ? 1 : 0);
