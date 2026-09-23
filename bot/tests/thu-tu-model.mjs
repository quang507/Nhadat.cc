// TS-GROQ-04/05 — thứ tự model (FR-194 b, 15/09/2026).
//
// Chủ dự án: "dùng con groq trả lời trước nếu bị chặn trần thì fall back về
// claude api liền luôn". Bài này dựng Groq giả bằng `globalThis.fetch` và Claude
// giả bằng một object có `messages.create/parse`, rồi đếm AI được gọi, theo thứ
// tự nào, trong từng cảnh: Groq trả lời được · Groq 429 cả danh sách · Groq 400
// (lỗi không phải nhịp) · lượt có ẢNH · đường cũ `claude`. Không gọi ra ngoài,
// không tốn một đồng.
import { bocDuPhong, giaiThamChieu, nguonGemini, nguonGroq } from "../supabase/functions/_shared/groq.ts";

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
let thanCuoi = null; // body lượt gọi Groq gần nhất

globalThis.fetch = async (url, init) => {
  const laGemini = /generativelanguage\.googleapis\.com\/v1beta\/openai\/chat\/completions/.test(String(url));
  if (!laGemini && !/api\.groq\.com/.test(String(url))) throw new Error(`fetch lạ: ${url}`);
  const than = JSON.parse(init.body);
  thanCuoi = than;
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
const reset = () => { kichBan = {}; goiGroq = []; goiClaude = []; claudeNem = null; soGhiSo = 0; thanCuoi = null; };
const P = { messages: [{ role: "user", content: "xin chào" }], max_tokens: 200 };
const P_ANH = { messages: [{ role: "user", content: [{ type: "image", source: {} }, { type: "text", text: "ảnh gì" }] }] };
const DS = "m1,m2";
const G = [nguonGroq("k", DS)];
const chu = (r) => r?.content?.[0]?.text;

// ── Groq trước (mặc định của hệ thống từ 15/09) ─────────────────────────────
{
  reset();
  const c = bocDuPhong(claude, G, ghiSo, "groq");
  const r = await c.messages.create(P);
  la("groq trước: Groq m1 trả lời → Claude KHÔNG được gọi", [chu(r), goiGroq, goiClaude], ["groq:m1", ["m1"], []]);
  la("groq trước: không ghi sổ lỗi", soGhiSo, 0);
}
{
  reset(); kichBan = { m1: 429 };
  const c = bocDuPhong(claude, G, ghiSo, "groq");
  const r = await c.messages.create(P);
  la("groq trước: m1 chạm trần → xoay m2, vẫn chưa đụng Claude", [chu(r), goiGroq, goiClaude], ["groq:m2", ["m1", "m2"], []]);
}
{
  reset(); kichBan = { m1: 429, m2: 429 };
  const c = bocDuPhong(claude, G, ghiSo, "groq");
  const r = await c.messages.create(P);
  la("groq trước: cả danh sách chạm trần → Claude LIỀN trong cùng lượt", [chu(r), goiGroq, goiClaude], ["claude", ["m1", "m2"], ["create"]]);
  la("groq trước: chạm trần là đường bình thường — KHÔNG vào sổ lỗi", soGhiSo, 0);
}
{
  reset(); kichBan = { m1: 503, m2: 500 };
  const c = bocDuPhong(claude, G, ghiSo, "groq");
  const r = await c.messages.parse({ ...P, output_config: { format: { type: "json_schema", schema: { type: "object" } } } });
  la("groq trước: Groq 5xx cả danh sách → Claude parse", [r?.parsed_output, goiGroq, goiClaude], [{ a: 1 }, ["m1", "m2"], ["parse"]]);
}
{
  reset(); kichBan = { m1: 413 };
  const c = bocDuPhong(claude, G, ghiSo, "groq");
  const r = await c.messages.create(P);
  la("groq trước: m1 413 quá cỡ → xoay m2 (trần chữ theo model), chưa đụng Claude", [chu(r), goiGroq, goiClaude], ["groq:m2", ["m1", "m2"], []]);
}
{
  reset(); kichBan = { m1: 400 };
  const c = bocDuPhong(claude, G, ghiSo, "groq");
  const r = await c.messages.create(P);
  la("groq trước: Groq 400 (không phải nhịp) → không xoay m2, sang Claude luôn", [chu(r), goiGroq, goiClaude], ["claude", ["m1"], ["create"]]);
}
{
  reset();
  const c = bocDuPhong(claude, G, ghiSo, "groq");
  const r = await c.messages.create(P_ANH);
  la("groq trước: lượt có ẢNH đi thẳng Claude, Groq không được gọi", [chu(r), goiGroq, goiClaude], ["claude", [], ["create"]]);
}
{
  reset(); kichBan = { m1: 429, m2: 429 }; claudeNem = Object.assign(new Error("credit balance is too low"), { status: 400 });
  const c = bocDuPhong(claude, G, ghiSo, "groq");
  let loi = null;
  try { await c.messages.create(P); } catch (e) { loi = e.message; }
  la("groq trước: Groq chạm trần VÀ Claude hết tiền → ném lỗi Claude lên (tầng gọi có câu mẫu)", [loi, goiGroq, goiClaude], ["credit balance is too low", ["m1", "m2"], ["create"]]);
}
{
  reset(); kichBan = { m1: 429, m2: 429 };
  const c = bocDuPhong(null, G, ghiSo, "groq");
  let loi = null;
  try { await c.messages.create(P); } catch (e) { loi = e.message.slice(0, 8); }
  la("groq trước, không khoá Claude: hết danh sách thì ném lỗi Groq", [loi, goiGroq], ["Groq 429", ["m1", "m2"]]);
}

// ── Gemini (FR-194 c, 23/09/2026): cùng cổng giọng OpenAI, đứng trước Groq khi MODEL_TRUOC=gemini ──
const GG = [nguonGemini("kg", "g1,g2"), nguonGroq("k", DS)];
{
  reset();
  const c = bocDuPhong(claude, GG, ghiSo, "groq");
  const r = await c.messages.create(P);
  la("gemini trước: Gemini g1 trả lời → Groq lẫn Claude KHÔNG được gọi", [chu(r), goiGroq, goiClaude], ["groq:g1", ["g1"], []]);
  la("gemini: body có reasoning_effort=low, trần chữ ≥ 1500, KHÔNG có reasoning_format của Groq",
    [thanCuoi.reasoning_effort, thanCuoi.max_completion_tokens >= 1500, "reasoning_format" in thanCuoi], ["low", true, false]);
}
{
  reset(); kichBan = { g1: 429, g2: 429 };
  const c = bocDuPhong(claude, GG, ghiSo, "groq");
  const r = await c.messages.create(P);
  la("gemini trước: cả danh sách Gemini chạm trần → sang Groq m1, chưa đụng Claude", [chu(r), goiGroq, goiClaude], ["groq:m1", ["g1", "g2", "m1"], []]);
  la("groq: body có reasoning_format=hidden, không reasoning_effort", [thanCuoi.reasoning_format, "reasoning_effort" in thanCuoi], ["hidden", false]);
  la("xoay nguồn là đường bình thường — KHÔNG vào sổ lỗi", soGhiSo, 0);
}
{
  reset(); kichBan = { g1: 400 };
  const c = bocDuPhong(claude, GG, ghiSo, "groq");
  const r = await c.messages.create(P);
  la("gemini 400 (không phải nhịp) → bỏ g2 cùng nguồn, sang nguồn kế Groq", [chu(r), goiGroq, goiClaude], ["groq:m1", ["g1", "m1"], []]);
}
{
  reset(); kichBan = { g1: 429, g2: 503, m1: 429, m2: 429 };
  const c = bocDuPhong(claude, GG, ghiSo, "groq");
  const r = await c.messages.create(P);
  la("mọi nguồn dự phòng hỏng → Claude liền trong cùng lượt", [chu(r), goiGroq, goiClaude], ["claude", ["g1", "g2", "m1", "m2"], ["create"]]);
}
{
  reset(); claudeNem = Object.assign(new Error("credit balance is too low"), { status: 400 });
  const c = bocDuPhong(claude, GG, ghiSo, "claude");
  const r = await c.messages.create(P);
  la("claude trước, Claude hết tiền → nguồn dự phòng ĐẦU danh sách (Gemini), sổ ghi tên nguồn", [chu(r), goiGroq, soGhiSo], ["groq:g1", ["g1"], 1]);
}

// ── Schema gửi Groq: giải `$ref` (bắt tại trận 15/09, trường `can` của boc-rao) ──
// Đúng hình `zodOutputFormat()` sinh cho z.number().int().nullable(): $defs + anyOf[$ref, null].
const KHUON_REF = {
  $defs: { __schema0: { type: "integer", description: "{minimum: -9007199254740991, maximum: 9007199254740991}" } },
  type: "object",
  properties: {
    so_can: { type: "integer" },
    truong: {
      type: "array",
      items: {
        type: "object",
        properties: {
          khoa: { type: "string" },
          can: { anyOf: [{ $ref: "#/$defs/__schema0" }, { type: "null" }], description: "Căn số mấy" },
        },
        additionalProperties: false, required: ["khoa", "can"],
      },
    },
  },
  additionalProperties: false, required: ["so_can", "truong"],
};
{
  const r = giaiThamChieu(KHUON_REF);
  la("giaiThamChieu: chép thân $defs vào chỗ $ref, giữ description, bỏ $defs",
    [r.properties.truong.items.properties.can, "$defs" in r],
    [{ anyOf: [{ type: "integer", description: "{minimum: -9007199254740991, maximum: 9007199254740991}" }, { type: "null" }], description: "Căn số mấy" }, false]);
  la("giaiThamChieu: schema không có $ref thì trả y nguyên", giaiThamChieu({ type: "object", properties: { a: { type: ["string", "null"] } } }), { type: "object", properties: { a: { type: ["string", "null"] } } });
  la("giaiThamChieu: không phải object thì trả nguyên", [giaiThamChieu(null), giaiThamChieu("x")], [null, "x"]);
  // Đúng hình zodOutputFormat() sinh cho z.enum(): enum bị nhét vào description.
  const KHUON_ENUM = {
    type: "object",
    properties: {
      vai: { type: "string", description: "{enum: [\"ban\",\"mua\",\"chua_ro\"]}" },
      loai: { anyOf: [{ type: "string", description: "Loại nơi\n\n{enum: [\"benh_vien\",\"truong_hoc\"]}" }, { type: "null" }] },
      ghi: { type: "string", description: "mô tả thường, không phải enum" },
      so: { type: "integer", description: "{minimum: -1, maximum: 9}" },
    },
    additionalProperties: false, required: ["vai", "loai", "ghi", "so"],
    description: "{$schema: \"https://json-schema.org/draft/2020-12/schema\"}",
  };
  const e = giaiThamChieu(KHUON_ENUM);
  la("giaiThamChieu: enum nằm trong description → trả về đúng chỗ enum, bỏ description rỗng",
    e.properties.vai, { type: "string", enum: ["ban", "mua", "chua_ro"] });
  la("giaiThamChieu: enum có mô tả phía trước (trong anyOf) → giữ mô tả, thêm enum",
    e.properties.loai.anyOf[0], { type: "string", description: "Loại nơi", enum: ["benh_vien", "truong_hoc"] });
  la("giaiThamChieu: description thường và {minimum…} không bị đụng",
    [e.properties.ghi, e.properties.so, e.description],
    [{ type: "string", description: "mô tả thường, không phải enum" }, { type: "integer", description: "{minimum: -1, maximum: 9}" }, "{$schema: \"https://json-schema.org/draft/2020-12/schema\"}"]);
  la("giaiThamChieu: description enum hỏng JSON → để nguyên, không ném",
    giaiThamChieu({ type: "string", description: "{enum: [ban,mua]}" }), { type: "string", description: "{enum: [ban,mua]}" });
}
{
  reset();
  const c = bocDuPhong(claude, G, ghiSo, "groq");
  await c.messages.parse({ ...P, output_config: { format: { type: "json_schema", schema: KHUON_REF } } });
  const s = JSON.stringify(thanCuoi.response_format);
  la("parse qua Groq: response_format KHÔNG còn $ref/$defs, strict json_schema", [/\$ref|\$defs/.test(s), thanCuoi.response_format.type, thanCuoi.response_format.json_schema.strict], [false, "json_schema", true]);
}

// ── Đường cũ: Claude trước (MODEL_TRUOC=claude) ─────────────────────────────
{
  reset();
  const c = bocDuPhong(claude, G, ghiSo, "claude");
  const r = await c.messages.create(P);
  la("claude trước: Claude trả lời → Groq KHÔNG được gọi", [chu(r), goiGroq, goiClaude], ["claude", [], ["create"]]);
}
{
  reset(); claudeNem = Object.assign(new Error("rate limit"), { status: 429 });
  const c = bocDuPhong(claude, G, ghiSo, "claude");
  const r = await c.messages.create(P);
  la("claude trước: Claude 429 → Groq m1, có ghi sổ 1 dòng", [chu(r), goiGroq, goiClaude, soGhiSo], ["groq:m1", ["m1"], ["create"], 1]);
}
{
  reset(); claudeNem = Object.assign(new Error("invalid_request_error"), { status: 400 });
  const c = bocDuPhong(claude, G, ghiSo, "claude");
  let loi = null;
  try { await c.messages.create(P); } catch (e) { loi = e.message; }
  la("claude trước: lỗi 400 sai tham số KHÔNG đổi sang Groq (đổi model không chữa được)", [loi, goiGroq], ["invalid_request_error", []]);
}
{
  reset();
  const c = bocDuPhong(claude, G, ghiSo);
  const r = await c.messages.create(P);
  la("không truyền thứ tự: giữ đường cũ Claude trước (tham số mặc định của hàm)", [chu(r), goiGroq], ["claude", []]);
}

console.log(`\n${dat} đạt, ${hong} hỏng`);
process.exit(hong ? 1 : 0);
