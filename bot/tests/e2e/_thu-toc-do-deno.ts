// Thử tốc độ model chính nhánh mua — TẠM, không commit. bun _thu-toc-do.mjs
import Anthropic from "npm:@anthropic-ai/sdk";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { z } from "npm:zod@4";
import { readFileSync } from "node:fs";


const SBP = /const TOKEN = "([^"]+)"/.exec(readFileSync("C:/Users/quang/AppData/Local/Temp/claude/C--Users-quang-OneDrive---Nha-Dat-Co-Ltd-Team-Mktg---CAG-mktg-003-Content-Aioinhadat/f3589909-bbbd-4107-92e5-e89c5ebc4563/scratchpad/sql.mjs", "utf8"))[1];
const q = async (query) => (await (await fetch("https://api.supabase.com/v1/projects/tbcdpupiarkuxtntmosl/database/query", { method: "POST", headers: { Authorization: `Bearer ${SBP}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }) })).json());
const key = (await q("select decrypted_secret s from vault.decrypted_secrets where name='ANTHROPIC_API_KEY'"))[0]?.s;
const rows = await q("select key, content from bot_prompts");
const DB = Object.fromEntries(rows.map((r) => [r.key, r.content]));
const ai = new Anthropic({ apiKey: key });

const TINH = [DB.tone_rules, DB.human_chat_rules, DB.fee_rules, DB.slang_notes, DB.agree_rules, DB.buyer_fewshot].join("\n\n").replace(/\{ten\}/g, "«tên em»") +
  "\n\nBất biến: tối đa 3 listing một tin; không khẳng định còn/hết hay pháp lý khi chưa xác minh; chỉ dùng listing trong KHO.";
const DONG = 'TÊN EM là "M•ai".\n\nKHO HIỆN CÓ:\n(chưa lọc - chưa đủ khu vực + giá để lọc, đừng nói kho trống)';
const USER = "HỒ SƠ ĐÃ BIẾT về khách:\n(chưa biết gì)\n\nCÒN THIẾU: khu vực, khoảng giá, mục đích, số phòng ngủ\n\nHội thoại tới giờ:\nKHÁCH: có căn nào quận 10 tầm 5 tỷ không em\n\nSoạn lượt trả lời tiếp theo của EM và cập nhật hồ sơ:";

const DAY_THAT = z.object({
  profile: z.object({
    name: z.string().nullable().describe("Tên khách nếu khách vừa xưng tên"),
    deal: z.enum(["ban", "thue"]).nullable().describe("ban = khách muốn MUA, thue = muốn THUÊ"),
    area: z.string().nullable().describe("Khu vực khách tìm, nguyên văn kiểu nói"),
    budget: z.string().nullable().describe("Khoảng giá, nguyên văn kiểu nói ('tầm 5 tỷ')"),
    purpose: z.string().nullable().describe("Để ở / kinh doanh / đầu tư"),
    property_type: z.string().nullable(),
    bedrooms: z.number().nullable(),
    alley: z.string().nullable().describe("Hẻm xe hơi / mặt tiền / không quan trọng"),
    timeline: z.string().nullable(),
    notes: z.string().nullable().describe("Chi tiết đáng nhớ khác khách kể (trường học, cha mẹ già ở cùng…)"),
  }).describe("CHỈ ghi điều khách NÓI RÕ trong hội thoại. Không suy diễn. Chưa biết để null."),
  replies: z.array(z.string()).min(1).max(2)
    .describe("1-2 bong bóng tin nhắn gửi khách, theo đúng nhịp nhắn giống người"),
  promise: z.object({
    when: z.string().describe("Mốc hẹn nguyên văn: 'chiều nay', 'mai', 'tối', 'cuối tuần'…"),
    what: z.string().describe("Khách hứa làm gì: 'gửi ảnh sổ', 'báo lại tài chính'…"),
  }).nullable().describe("CHỈ điền khi khách chủ động hứa sẽ gửi/báo gì đó vào một mốc thời gian. Không suy diễn."),
  viewing: z.object({
    listing_code: z.string().nullable().describe("Mã căn muốn xem, ví dụ 'BDS-NP-BINHTAN-0001', 'BDS-NP-Q5-0001' (không có # đầu)"),
    when: z.string().describe("Khung giờ khách chốt, nguyên văn: 'mai 9h sáng', 'chiều thứ 7'…"),
    phone: z.string().nullable().describe("SĐT khách TỰ cho ở bước chốt lịch; không có thì null"),
  }).nullable().describe("CHỈ điền khi khách chốt/đề nghị lịch xem nhà cụ thể (UF-06). Không suy diễn."),
  agreed_deal: z.object({
    listing_code: z.string().nullable().describe("Mã căn khách vừa đồng ý chốt, ví dụ 'BDS-NP-BINHTAN-0001', 'BDS-NP-Q5-0001'; không rõ mã thì null"),
  }).nullable().describe("CHỈ điền khi tin NGAY TRƯỚC của EM có đề nghị chốt hợp đồng/cọc và khách vừa ĐỒNG Ý theo AGREE_RULES (bằng chữ, emoji vui, like/tim). Không suy diễn."),
  send_photos: z.string().nullable().describe("Mã căn cần gửi hình kèm tin này - CHỈ điền khi khách xin hình và khối căn ghi 'có hình sẵn'; không thì null"),
  ask_owner: z.object({
    listing_code: z.string().nullable().describe("Mã căn cần hỏi, ví dụ 'BDS-NP-BINHTAN-0001', 'BDS-NP-Q5-0001' (không có # đầu)"),
    question: z.string().describe("Điều cần hỏi/xin từ chủ tin, ngắn gọn: 'hình + địa chỉ chi tiết', 'pháp lý', 'còn bán không'…"),
  }).nullable().describe("CHỈ điền khi em vừa hứa 'để em hỏi lại chủ nhà / xin hình rồi gửi anh chị' về MỘT căn cụ thể. Không suy diễn."),
  need_human: z.boolean().describe(
    "true CHỈ khi: khách đòi gặp người thật/quản lý, khách bức xúc thật sự, đàm phán giá vào hồi kết, hoặc đã 'để em hỏi lại' 2 lần cùng một chuyện. Câu hỏi khó thường ngày thì false.",
  ),
  // FR-79 (v48): khách đòi gọi điện / voice / "alo được không" → cờ riêng để hệ
  // thống mở việc VOICE cho người thật gọi lại (kèm need_human).
  voice_request: z.boolean().describe(
    "true khi khách muốn GỌI ĐIỆN / voice / nói chuyện qua điện thoại hoặc xin số để gọi bên em. Khách CHO số của họ ở bước chốt lịch thì false.",
  ),
});
const DAY = DAY_THAT;
const system = [{ type: "text", text: TINH, cache_control: { type: "ephemeral", ttl: "1h" } }, { type: "text", text: DONG }];
const MODEL = "claude-haiku-4-5-20251001";

async function lan(ten, fn) {
  const t0 = Date.now();
  let dau = null;
  const r = await fn((t) => { if (dau == null) dau = t; });
  console.log(`${ten.padEnd(28)} ${String(Date.now() - t0).padStart(5)}ms  ttft=${dau == null ? "-" : dau - t0}ms  out=${r.usage.output_tokens} cache_read=${r.usage.cache_read_input_tokens}`);
}
const kieu = {
  "parse+format (đang chạy)": () => ai.messages.parse({ model: MODEL, max_tokens: 1024, output_config: { format: zodOutputFormat(DAY) }, system, messages: [{ role: "user", content: USER }] }),
  "create, JSON bằng lời": () => ai.messages.create({ model: MODEL, max_tokens: 1024, system, messages: [{ role: "user", content: USER + "\nTrả về DUY NHẤT một object JSON {profile:{…10 khoá…}, replies:[…], promise, viewing, agreed_deal, send_photos, ask_owner, need_human, voice_request}." }] }),
  "stream+format (đo ttft)": async (onTok) => {
    const t0 = Date.now();
    const s = ai.messages.stream({ model: MODEL, max_tokens: 1024, output_config: { format: zodOutputFormat(DAY) }, system, messages: [{ role: "user", content: USER }] });
    s.on("text", () => onTok(Date.now()));
    void t0;
    return await s.finalMessage();
  },
};
for (let vong = 0; vong < 0; vong++) for (const [ten, fn] of Object.entries(kieu)) {
  try { await lan(ten, fn); } catch (e) { console.log(ten, "LỖI", String(e).slice(0, 200)); }
}

// ── Thử 2: parse KHÔNG format, schema JSON trong khối nhớ tạm, tự kiểm bằng zod ──
const SCHEMA_TXT = JSON.stringify(z.toJSONSchema(DAY));
const system2 = [{ type: "text", text: TINH + "\n\nĐẦU RA: trả về DUY NHẤT một object JSON (không markdown, không chữ nào ngoài JSON) đúng JSON Schema sau:\n" + SCHEMA_TXT, cache_control: { type: "ephemeral", ttl: "1h" } }, { type: "text", text: DONG }];
const CAUS = [
  "có căn nào quận 10 tầm 5 tỷ không em",
  "chị đang tìm mua nhà quận 5 tầm 7 tỷ, nhà có mẹ già nên muốn gần bệnh viện",
  "mai 9h anh qua xem căn BDS-Q5-0001 được không, sđt anh 0903123456",
  "cho anh gặp người thật đi, bot trả lời chán quá",
  "tìm thuê căn hộ 2 phòng ngủ quận 7 tầm 15 triệu",
  "chiều nay chị gửi ảnh sổ nha em",
  "em ơi gọi điện cho anh được không",
  "ok em",
];
let hong = 0;
for (const c of CAUS) {
  const t0 = Date.now();
  const r = await ai.messages.parse({ model: MODEL, max_tokens: 1024, system: system2, messages: [{ role: "user", content: USER.replace("có căn nào quận 10 tầm 5 tỷ không em", c) }] });
  const txt = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  let ok = false, loi = "";
  try {
    const j = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
    const kq = DAY.safeParse(j);
    ok = kq.success; if (!ok) loi = JSON.stringify(kq.error.issues).slice(0, 160);
    if (ok) console.log(`  ${String(Date.now() - t0).padStart(5)}ms out=${r.usage.output_tokens} nho=${r.usage.cache_read_input_tokens} OK  ${JSON.stringify({ rep: kq.data.replies[0].slice(0, 60), hs: Object.fromEntries(Object.entries(kq.data.profile).filter(([, v]) => v != null)), vw: kq.data.viewing, nh: kq.data.need_human, vc: kq.data.voice_request, pr: kq.data.promise })}`);
  } catch (e) { loi = String(e).slice(0, 120); }
  if (!ok) { hong++; console.log(`  ${Date.now() - t0}ms HỎNG ${loi} | ${txt.slice(0, 120)}`); }
}
console.log("hỏng", hong, "/", CAUS.length);
