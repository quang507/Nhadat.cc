// chat-reply — "bộ não" hội thoại B-side tách khỏi kênh (NFR-12).
// Kênh nào (OA webhook, bridge zca-js test, web chat sau này) cũng gọi vào đây.
// POST { external_user_id, text, msg_id?, channel? }
//   → { reply, replies[], conversation_id }
// Nhánh BUYER theo FR-130: hồ sơ nhu cầu tích luỹ (buyers.preferences), mỗi
// lượt hỏi đúng MỘT tiêu chí thiếu, trả lời tách tối đa 2 bong bóng.
import Anthropic from "npm:@anthropic-ai/sdk";
import { z } from "npm:zod@4";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  BUYER_FEWSHOT,
  FEE_RULES,
  BUYER_PROFILE_FIELDS,
  FACT_LABELS,
  HUMAN_CHAT_RULES,
  SELLER_SCRIPT_RULES,
  SLANG_NOTES,
  TONE_RULES,
} from "../_shared/prompts.ts";

// Fallback quy tắc khi model lỗi/hết quota (hướng parseVnd của NhaDat-Radar):
// bắt tối thiểu ngân sách + hẻm/mặt tiền bằng regex để hồ sơ không mất dữ liệu,
// và trả lời template thay vì im lặng hay đổ lỗi cho khách.
function regexProfileFallback(text: string): Record<string, string> {
  const t = text.toLowerCase();
  const delta: Record<string, string> = {};
  const money = /([\d][\d.,]*)\s*(tỷ|ty|tỏi|tr\b|triệu|củ)/.exec(t);
  if (money) {
    const unit = /tr|triệu|củ/.test(money[2]) ? "triệu" : "tỷ";
    delta.budget = `${money[1]} ${unit}`;
  }
  if (/hxh|hẻm xe hơi/.test(t)) delta.alley = "hẻm xe hơi";
  else if (/mặt tiền|\bmt\b/.test(t)) delta.alley = "mặt tiền";
  if (/\bthuê\b|cho thuê/.test(t)) delta.deal = "thue";
  else if (/\bmua\b/.test(t)) delta.deal = "ban";
  return delta;
}

// FR-133: "chiều/mai/tối… em gửi" → hẹn giờ nhắc (giờ VN = UTC+7)
function mapDue(when: string): string {
  const t = when.toLowerCase();
  const now = Date.now();
  const vn = new Date(now + 7 * 3600e3);
  let day = 0;
  if (/mai|hôm sau/.test(t)) day = 1;
  // "thứ 7", "chủ nhật/CN" → số ngày tới thứ đó (trùng hôm nay thì lấy hôm nay)
  const wd = /thứ\s*([2-7])/.exec(t);
  if (wd) day = ((parseInt(wd[1], 10) - 1) - vn.getUTCDay() + 7) % 7;
  else if (/chủ nhật|\bcn\b/.test(t)) day = (7 - vn.getUTCDay()) % 7;
  let hour = 15;
  const hm = /(\d{1,2})\s*(?:h|giờ)/.exec(t);
  if (hm) {
    hour = Math.min(23, Math.max(0, parseInt(hm[1], 10)));
    // "3h chiều", "8h tối" — giờ kèm buổi thì cộng 12, kẻo thành 3h/8h SÁNG
    if (hour < 12 && /chiều|tối|đêm/.test(t)) hour += 12;
  } else if (/sáng/.test(t)) hour = 9;
  else if (/trưa/.test(t)) hour = 12;
  else if (/chiều/.test(t)) hour = 15;
  else if (/tối|đêm/.test(t)) hour = 19;
  else if (/cuối tuần/.test(t)) { day = ((6 - vn.getUTCDay()) + 7) % 7 || 6; hour = 10; }
  let due = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + day, hour - 7);
  if (due <= now) due = now + 2 * 3600e3; // đã qua giờ đó → nhắc sau 2 tiếng
  return new Date(due).toISOString();
}
// Regex bắt lời hứa cho nhánh seller (không qua parse có cấu trúc)
const PROMISE_RE = /(sáng mai|chiều|tối|trưa|mai|cuối tuần)[^.,;!?]{0,30}?(gửi|chụp|báo|đưa|bổ sung|cho em|check|coi lại)|(gửi|chụp|báo|đưa|bổ sung|check|coi lại)[^.,;!?]{0,30}?(sáng mai|chiều|tối|trưa|mai|cuối tuần)/i;

// SRS-4.5: khoảng giá trong hồ sơ → biên VND để lọc kho bằng price_vnd
// (cột số, parse_vnd phía DB — hướng parseVnd của NhaDat-Radar).
// "tầm/dưới 5 tỷ" → cận trên ×1.15; "trên/từ 4 tỷ" → cận DƯỚI; "5-6 tỷ" → cả hai.
function budgetRangeVnd(budget: unknown): { min?: number; max?: number } | null {
  if (typeof budget !== "string") return null;
  const unitOf = (u: string) => (/tỷ|ty|tỏi|tỉ/i.test(u) ? 1e9 : 1e6);
  const num = (s: string) => parseFloat(s.replace(",", "."));
  const range =
    /([\d][\d.,]*)\s*[-–~]\s*([\d][\d.,]*)\s*(tỷ|ty|tỏi|tỉ|triệu|trieu|củ)/i.exec(budget);
  if (range) {
    const u = unitOf(range[3]);
    const a = num(range[1]) * u, b = num(range[2]) * u;
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b >= a) {
      return { min: Math.round(a * 0.95), max: Math.round(b * 1.1) };
    }
  }
  const m = /([\d][\d.,]*)\s*(tỷ|ty|tỏi|tỉ)/i.exec(budget) ??
    /([\d][\d.,]*)\s*(triệu|trieu|củ|tr\b)/i.exec(budget);
  if (!m) return null;
  const n = num(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const base = n * unitOf(m[2]);
  if (/trên|hơn|từ|tối thiểu|ít nhất/i.test(budget)) return { min: Math.round(base * 0.95) };
  return { max: Math.round(base * 1.15) };
}

// FR-29: mã căn khách nhắc ("#BDS-Q5-0115", từ web bấm sang) — chào đúng căn đó
const CODE_RE = /(?:#\s*)?\b([A-Za-z]{2,5}(?:-[A-Za-z0-9]{1,8}){1,3})\b/g;

const MODEL = "claude-opus-5";

function db(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function secret(client: SupabaseClient, name: string): Promise<string | null> {
  const fromEnv = Deno.env.get(name);
  if (fromEnv) return fromEnv;
  const { data } = await client.rpc("get_secret", { secret_name: name });
  return (data as string) ?? null;
}

// Hồ sơ + trả lời trong MỘT lượt gọi model (FR-130)
const BuyerTurn = z.object({
  profile: z.object({
    name: z.string().nullable().describe("Tên khách nếu khách vừa xưng tên"),
    honorific: z.enum(["anh", "chị"]).nullable(),
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
    listing_code: z.string().nullable().describe("Mã căn muốn xem, ví dụ 'BDS-Q5-0115' (không có # đầu)"),
    when: z.string().describe("Khung giờ khách chốt, nguyên văn: 'mai 9h sáng', 'chiều thứ 7'…"),
    phone: z.string().nullable().describe("SĐT khách TỰ cho ở bước chốt lịch; không có thì null"),
  }).nullable().describe("CHỈ điền khi khách chốt/đề nghị lịch xem nhà cụ thể (UF-06). Không suy diễn."),
  need_human: z.boolean().describe(
    "true CHỈ khi: khách đòi gặp người thật/quản lý, khách bức xúc thật sự, đàm phán giá vào hồi kết, hoặc đã 'để em hỏi lại' 2 lần cùng một chuyện. Câu hỏi khó thường ngày thì false.",
  ),
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const body = await req.json().catch(() => ({}));
  const externalUserId = String(body.external_user_id ?? "").trim();
  const text = String(body.text ?? "").trim();
  const msgId = body.msg_id ? String(body.msg_id) : null;
  const channel = String(body.channel ?? "zalo_oa");
  const imageUrl = body.image_url ? String(body.image_url) : null;
  if (!externalUserId || (!text && !imageUrl)) {
    return new Response(JSON.stringify({ error: "external_user_id và text (hoặc image_url) bắt buộc" }), { status: 400 });
  }
  const textOrTag = text || "[khách gửi ảnh]";

  const client = db();

  // FR-138: "não" cấu hình được từ dashboard — bảng bot_prompts đè lên mặc định
  // trong prompts.ts. Chủ dự án sửa content ở Table Editor là bot đổi ngay lượt
  // sau, không cần deploy. Không có dòng nào thì dùng bản trong code.
  const { data: promptRows } = await client.from("bot_prompts").select("key, content");
  const P: Record<string, string> = Object.fromEntries(
    (promptRows ?? []).map((r) => [r.key, r.content]),
  );
  const TONE = P.tone_rules ?? TONE_RULES;
  const HUMAN = P.human_chat_rules ?? HUMAN_CHAT_RULES;
  const FEES = P.fee_rules ?? FEE_RULES;
  const SELLER_SCRIPT = P.seller_script_rules ?? SELLER_SCRIPT_RULES;
  const SLANG = P.slang_notes ?? SLANG_NOTES;
  const FEWSHOT = P.buyer_fewshot ?? BUYER_FEWSHOT;

  // NGƯỜI BÁN nhắn? (FR-129 — hỏi nhỏ giọt): nếu khớp sellers.zalo_user_id và
  // đang có câu hỏi chờ, coi tin nhắn là CÂU TRẢ LỜI → lưu fact, hỏi câu kế.
  const { data: sellerRow } = await client
    .from("sellers").select("id, name")
    .eq("zalo_user_id", externalUserId).maybeSingle();
  if (sellerRow) {
    const apiKeyS = await secret(client, "ANTHROPIC_API_KEY");
    const anthropicS = new Anthropic({ apiKey: apiKeyS! });
    const { data: pendingReq } = await client
      .from("info_requests")
      .select("id, listing_id, question, listings!inner(seller_id, code)")
      .eq("listings.seller_id", sellerRow.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle();

    // Seller quay lại nhắn → hủy nhắc-lời-hứa đang chờ (FR-133)
    await client.from("reminders").update({ status: "cancelled" })
      .eq("seller_id", sellerRow.id).eq("kind", "promise").eq("status", "pending");
    // Seller hứa "chiều gửi ảnh…" → đặt hẹn nhắc
    if (PROMISE_RE.test(text)) {
      await client.from("reminders").insert({
        kind: "promise", seller_id: sellerRow.id,
        due_at: mapDue(text), note: text.slice(0, 200),
      });
    }
    // Seller gửi ẢNH không kèm chữ → ghi nhận ảnh, TUYỆT ĐỐI không coi chuỗi
    // rỗng là "câu trả lời" cho câu hỏi đang chờ (từng làm mất fact pháp lý)
    if (!text && imageUrl) {
      if (pendingReq) {
        await client.from("listing_facts").insert({
          listing_id: pendingReq.listing_id, question: "hinh_anh",
          answer: `[ảnh] ${imageUrl}`, source: "seller_chat",
        });
      }
      const thanks =
        "Dạ em nhận được ảnh rồi ạ, em bổ sung vào tin ngay. Cảm ơn anh/chị nhiều!";
      return new Response(
        JSON.stringify({ reply: thanks, replies: [thanks], role: "seller" }),
        { headers: { "Content-Type": "application/json; charset=utf-8" } },
      );
    }
    if (pendingReq) {
      await client.from("listing_facts").insert({
        listing_id: pendingReq.listing_id,
        question: pendingReq.question,
        answer: text,
        source: "seller_chat",
      });
      await client.from("info_requests").update({
        status: "answered", answer: text, answered_at: new Date().toISOString(),
      }).eq("id", pendingReq.id);

      // Câu kế tiếp (chưa pending) theo ưu tiên
      const { data: nextFacts } = await client
        .from("listing_missing_facts")
        .select("fact_key, priority")
        .eq("listing_id", pendingReq.listing_id)
        .order("priority").limit(3);
      const { data: stillPending } = await client
        .from("info_requests").select("question")
        .eq("listing_id", pendingReq.listing_id).eq("status", "pending");
      const pendSet = new Set((stillPending ?? []).map((r) => r.question));
      const next = (nextFacts ?? []).find((f) => !pendSet.has(f.fact_key));

      const prompt = next
        ? `Người bán vừa trả lời câu hỏi "${FACT_LABELS[pendingReq.question] ?? pendingReq.question}": "${text}". Soạn MỘT tin RẤT NGẮN (~30 từ): ghi nhận/khen tự nhiên câu trả lời (điểm mạnh thật của nhà nếu có), rồi hỏi tiếp ĐÚNG MỘT thông tin: ${FACT_LABELS[next.fact_key] ?? next.fact_key}. Kèm lý do vì-khách nếu tự nhiên. Không hỏi gì khác.`
        : `Người bán vừa trả lời câu hỏi cuối: "${text}". Soạn MỘT tin NGẮN cảm ơn, báo tin rao giờ đã đầy đủ thông tin, tụi em sẽ báo ngay khi có khách quan tâm. Kết thúc bằng một câu hỏi nhẹ xem anh chị còn muốn bổ sung gì không.`;
      const r2 = await anthropicS.messages.create({
        model: MODEL, max_tokens: 512,
        output_config: { effort: "low" },
        system: [{
          type: "text",
          text: TONE + "\n\n" + SELLER_SCRIPT,
          cache_control: { type: "ephemeral" },
        }],
        messages: [{ role: "user", content: prompt }],
      });
      const sellerReply = r2.content.find((b) => b.type === "text")?.text?.trim() ?? null;

      if (next && sellerReply) {
        await client.from("info_requests").insert({
          listing_id: pendingReq.listing_id, question: next.fact_key, status: "pending",
        });
      }
      return new Response(
        JSON.stringify({
          reply: sellerReply,
          replies: sellerReply ? [sellerReply] : [],
          role: "seller",
          saved_fact: pendingReq.question,
        }),
        { headers: { "Content-Type": "application/json; charset=utf-8" } },
      );
    }
    // Seller nhắn nhưng KHÔNG có câu chờ → vẫn trả lời ĐÚNG VAI người bán
    // (trước đây rơi xuống luồng mua → bot hỏi "anh tìm khu nào" với chính chủ nhà)
    const { data: sellerLst } = await client.from("listings")
      .select("code, location_raw, ward, price_raw")
      .eq("seller_id", sellerRow.id)
      .order("created_at", { ascending: false }).limit(5);
    const lstLines = (sellerLst ?? [])
      .map((l) => `#${l.code} · ${l.location_raw ?? ""} ${l.ward ?? ""} · ${l.price_raw ?? "?"}`)
      .join("\n");
    const r3 = await anthropicS.messages.create({
      model: MODEL, max_tokens: 512,
      output_config: { effort: "low" },
      system: [{
        type: "text",
        text: TONE + "\n\n" + SELLER_SCRIPT + "\n\n" + FEES,
        cache_control: { type: "ephemeral" },
      }],
      messages: [{
        role: "user",
        content:
          `NGƯỜI BÁN${sellerRow.name ? ` (${sellerRow.name})` : ""} đang rao các tin:\n${lstLines || "(chưa có tin đang rao)"}\n\n` +
          `Họ vừa nhắn: "${textOrTag}". Soạn MỘT tin trả lời NGẮN đúng vai chăm sóc NGƯỜI BÁN — tuyệt đối KHÔNG hỏi nhu cầu mua nhà. ` +
          `Không bịa tình trạng tin/lượt khách quan tâm; điều chưa nắm thì nói "để em kiểm tra rồi báo lại anh/chị liền".`,
      }],
    });
    const sReply = r3.content.find((b) => b.type === "text")?.text?.trim() ??
      "Dạ em ghi nhận rồi ạ, em kiểm tra rồi báo lại anh/chị liền nha.";
    return new Response(
      JSON.stringify({ reply: sReply, replies: [sReply], role: "seller" }),
      { headers: { "Content-Type": "application/json; charset=utf-8" } },
    );
  }

  // Nhớ người trò chuyện (FR-21/26) + hồ sơ nhu cầu (FR-130).
  // Get-or-create buyer + conversation qua RPC advisory-lock (FR-131 —
  // 3 tin gõ vụn đến đồng thời không được tạo trùng buyer/conversation).
  const { data: bc, error: bcErr } = await client
    .rpc("ensure_buyer_conversation", {
      p_zalo_user_id: externalUserId,
      p_channel: channel,
    }).single();
  if (bcErr || !bc) {
    return new Response(JSON.stringify({ error: bcErr?.message ?? "ensure_buyer_conversation" }), { status: 500 });
  }
  const buyer = { id: bc.b_id as string, name: bc.b_name as string | null };
  const convId = bc.c_id as string;
  const prefs: Record<string, unknown> = (bc.b_prefs as Record<string, unknown>) ?? {};

  // Dedupe theo msg_id (retry không tạo tin đôi)
  const { data: insMsg, error: msgErr } = await client.from("messages").insert({
    conversation_id: convId, sender: "buyer",
    body: imageUrl ? `${textOrTag} [ảnh: ${imageUrl}]` : text,
    zalo_msg_id: msgId,
  }).select("id").single();
  if (msgErr?.code === "23505") {
    // Retry của kênh (cùng msg_id) — đã trả lời rồi, đừng trả lời lần hai
    return new Response(JSON.stringify({ reply: null, replies: [], deduped: true }), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
  if (msgErr) {
    return new Response(JSON.stringify({ error: msgErr.message }), { status: 500 });
  }
  await client.from("conversations")
    .update({ last_message_at: new Date().toISOString() }).eq("id", convId);

  // FR-131: gộp tin gõ vụn — debounce THÍCH ỨNG: tin ngắn cụt không dấu kết câu
  // ("tìm nhà", "quận 10") là kiểu đang gõ tiếp → đợi 3.5s gom chùm; tin đủ ý
  // thì chỉ đợi 1.5s cho đỡ chậm. Có tin mới hơn trong lúc đợi thì nhường lượt.
  const looksFragment = text.length > 0 && text.length < 18 && !/[?.!…]$/.test(text);
  await new Promise((r) => setTimeout(r, looksFragment ? 3500 : 1500));
  const { data: newest } = await client
    .from("messages").select("id")
    .eq("conversation_id", convId).eq("sender", "buyer")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (newest && insMsg && newest.id !== insMsg.id) {
    return new Response(JSON.stringify({ reply: null, replies: [], superseded: true }), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  // Buyer quay lại nhắn → hủy nhắc-lời-hứa + follow-up đang chờ (FR-133/FR-32)
  await client.from("reminders").update({ status: "cancelled" })
    .eq("buyer_id", buyer.id).in("kind", ["promise", "followup"]).eq("status", "pending");

  // Kho lọc theo hồ sơ: mua/thuê, phường (nếu bắt được), số PN, cận trên giá (SRS-4.5)
  let khoQ = client
    .from("listings")
    .select("code, ward, location_raw, price_raw, area_m2, bedrooms")
    .eq("deal", prefs.deal === "thue" ? "thue" : "ban")
    .not("price_raw", "is", null).neq("price_raw", "")
    .order("created_at", { ascending: false }).limit(6);
  const wardNum = typeof prefs.area === "string"
    ? /ph(?:ường|uong)?\s*\.?\s*(\d{1,2})|(?:^|\W)p\.?\s*(\d{1,2})/i.exec(prefs.area)
    : null;
  // Khớp ĐÚNG số phường (ilike không wildcard = so khớp nguyên chuỗi,
  // không phân biệt hoa thường) — '%1%' cũ khiến P1 dính cả P10-P16
  if (wardNum) khoQ = khoQ.ilike("ward", `Phường ${wardNum[1] ?? wardNum[2]}`);
  if (typeof prefs.bedrooms === "number") khoQ = khoQ.gte("bedrooms", prefs.bedrooms);
  const budgetR = budgetRangeVnd(prefs.budget);
  if (budgetR?.max) khoQ = khoQ.lte("price_vnd", budgetR.max);
  if (budgetR?.min) khoQ = khoQ.gte("price_vnd", budgetR.min);

  // FR-29/30: khách nhắc mã căn (gõ tay hoặc bấm từ trang chi tiết web sang)
  const mentioned = [...new Set(
    [...textOrTag.matchAll(CODE_RE)].map((m) => m[1].toUpperCase()),
  )].slice(0, 3);

  const [{ data: history }, { data: listings }, { data: partnerProj }, { data: matchedProj }, { data: askedListings }] = await Promise.all([
    client.from("messages").select("sender, body")
      .eq("conversation_id", convId).order("created_at", { ascending: false }).limit(12),
    khoQ,
    // FR-132: dự án nhà mình phân phối trực tiếp — luôn đứng đầu khối dự án
    client.from("projects")
      .select("name, developer, district, ward, location_raw, legal_status, status_text, amenities, specs, unit_types")
      .eq("is_partner", true).order("priority").limit(1),
    // Khách nhắc tên dự án nào trong kho (mogi/aond) thì nạp kiến thức dự án đó
    client.rpc("match_projects", { p_text: text }),
    // Căn khách đang nhắc tới — kèm facts đã xác minh từ chủ nhà (FR-29)
    mentioned.length
      ? client.from("listings")
        .select("code, ward, location_raw, price_raw, area_m2, bedrooms, listing_facts(question, answer)")
        .in("code", mentioned).limit(3)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const ordered = (history ?? []).reverse();
  const convo = ordered
    .map((m) => `${m.sender === "buyer" ? "KHÁCH" : "EM"}: ${m.body}`).join("\n");
  const kho = (listings ?? [])
    .map((l) =>
      `#${l.code} · ${l.location_raw ?? ""} ${l.ward ?? ""} · ${l.price_raw} · ${l.area_m2 ?? "?"}m2${l.bedrooms ? ` · ${l.bedrooms}PN` : ""}`)
    .join("\n");

  // Khối "căn khách đang nhắc" (FR-29): đủ chi tiết + facts đã xác minh
  type Asked = {
    code: string; ward?: string | null; location_raw?: string | null;
    price_raw?: string | null; area_m2?: number | null; bedrooms?: number | null;
    listing_facts?: Array<{ question: string; answer: string }> | null;
  };
  const askedBlock = ((askedListings ?? []) as Asked[])
    .map((l) => {
      const facts = (l.listing_facts ?? [])
        .map((f) => `${f.question}: ${f.answer}`).join("; ");
      return `#${l.code} · ${l.location_raw ?? ""} ${l.ward ?? ""} · ${l.price_raw ?? "giá đang cập nhật"} · ${l.area_m2 ?? "?"}m2${l.bedrooms ? ` · ${l.bedrooms}PN` : ""}${facts ? ` · đã xác minh từ chủ nhà: ${facts}` : ""}`;
    }).join("\n");

  // Khối DỰ ÁN (FR-113…115/FR-132): kiến thức chung đã xác thực, bot trả lời
  // tầng dự án trực tiếp; Ny'ah (is_partner) luôn ở trên cùng.
  type Proj = {
    name: string; developer?: string | null; district?: string | null;
    location_raw?: string | null; legal_status?: string | null; status_text?: string | null;
    amenities?: unknown; specs?: unknown; unit_types?: unknown; description?: string | null;
  };
  const projLine = (p: Proj, full: boolean) => {
    const parts = [`${p.name} — CĐT ${p.developer ?? "?"} · ${p.location_raw ?? p.district ?? ""}`];
    if (p.legal_status) parts.push(`pháp lý: ${p.legal_status}`);
    if (p.status_text) parts.push(`tình trạng: ${p.status_text}`);
    if (Array.isArray(p.amenities)) parts.push(`tiện ích: ${(p.amenities as string[]).join(", ")}`);
    if (full && p.specs) parts.push(`thông số: ${JSON.stringify(p.specs)}`);
    if (full && p.unit_types) parts.push(`mẫu nhà/căn: ${JSON.stringify(p.unit_types)}`);
    if (!full && p.description) parts.push(String(p.description).slice(0, 280));
    return "• " + parts.join(" · ");
  };
  const partner = (partnerProj ?? [])[0] as Proj | undefined;
  const matched = ((matchedProj ?? []) as Proj[])
    .filter((m) => m.name !== partner?.name);
  const duanBlock = [
    ...(partner ? [projLine(partner, true)] : []),
    ...matched.map((m) => projLine(m, true)),
  ].join("\n");

  // Chống hỏi cung: 2 tin gần nhất của bot đều là câu hỏi → lượt này đưa giá trị
  const botMsgs = ordered.filter((m) => m.sender === "bot");
  const interrogated = botMsgs.length >= 2 &&
    botMsgs.slice(-2).every((m) => m.body.trimEnd().endsWith("?"));

  // Hồ sơ ĐÃ BIẾT / CÒN THIẾU theo thứ tự ưu tiên UF-04
  const known = BUYER_PROFILE_FIELDS
    .filter(([k]) => prefs[k] != null && prefs[k] !== "")
    .map(([k, label]) => `- ${label}: ${prefs[k]}`).join("\n");
  const missing = BUYER_PROFILE_FIELDS
    .filter(([k]) => prefs[k] == null || prefs[k] === "")
    .map(([, label]) => `- ${label}`).join("\n");
  const minimumMet = prefs.area != null && prefs.budget != null;

  const apiKey = await secret(client, "ANTHROPIC_API_KEY");
  const anthropic = new Anthropic({ apiKey: apiKey! });
  let out:
    | {
      profile: Record<string, unknown>; replies: string[];
      promise?: { when: string; what: string } | null;
      viewing?: { listing_code: string | null; when: string; phone: string | null } | null;
      need_human?: boolean;
    }
    | null = null;
  try {
    const resp = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      // effort low: nhanh hơn rõ rệt, few-shot + luật đã gánh chất lượng (nudge
      // chạy low được chấm 4.5-4.7/5); cần sâu hơn thì nâng lại "medium"
      output_config: { effort: "low", format: zodOutputFormat(BuyerTurn) },
      // Tách 2 khối: khối LUẬT ổn định được cache (đỡ ~7KB prefill mỗi lượt);
      // khối KHO biến động theo hồ sơ nằm SAU điểm cache nên không phá cache.
      system: [{
        type: "text",
        text: TONE + "\n\n" + HUMAN + "\n\n" + FEES + "\n\n" + SLANG + "\n\n" + FEWSHOT +
          "\n\nBất biến: tối đa 3 listing một tin; không khẳng định còn/hết hay pháp lý khi chưa xác minh — nói 'để em hỏi lại chủ nhà'; tin chủ động kết thúc bằng MỘT câu hỏi. Chỉ dùng listing trong KHO ở khối sau, không bịa.",
        cache_control: { type: "ephemeral" },
      }, {
        type: "text",
        text: "KHO HIỆN CÓ:\n" +
          (kho || "(trống)") +
          (askedBlock
            ? "\n\nCĂN KHÁCH ĐANG NHẮC TỚI (khách vào từ web hoặc gõ mã — chào ĐÚNG căn này, trả lời thẳng vào nó; mục 'đã xác minh từ chủ nhà' được nói chắc, còn lại vẫn 'để em hỏi lại'):\n" +
              askedBlock
            : "") +
          (duanBlock
            ? "\n\nKHO DỰ ÁN (kiến thức chung ĐÃ XÁC THỰC — dùng trả lời TRỰC TIẾP câu hỏi tầng dự án: vị trí, chủ đầu tư, pháp lý dự án, tiện ích, mẫu nhà, quy cách bàn giao — KHÔNG cần 'hỏi lại chủ nhà'. GIÁ từng căn KHÔNG có trong kho: khách hỏi giá thì nói 'để em kiểm tra giá lô đó rồi báo anh/chị liền'. Dự án ĐẦU TIÊN là dự án nhà mình đang phân phối trực tiếp — khi khách hợp nhu cầu (nhà phố xây mới, khu biệt lập an ninh, ~43-92m2, quanh Q5/Q6/Q8) thì chủ động giới thiệu MỘT lần như một lựa chọn; khách không quan tâm thì thôi, đừng lặp lại):\n" +
              duanBlock
            : ""),
      }],
      messages: [{
        role: "user",
        content: [
          ...(imageUrl
            ? [{ type: "image" as const, source: { type: "url" as const, url: imageUrl } }]
            : []),
          { type: "text" as const, text:
          `HỒ SƠ ĐÃ BIẾT về khách${buyer.name ? ` (tên: ${buyer.name})` : ""}:\n${known || "(chưa biết gì)"}\n\n` +
          `CÒN THIẾU (thứ tự ưu tiên hỏi, mỗi lượt chỉ hỏi MỘT):\n${missing || "(đã đủ)"}\n\n` +
          (minimumMet
            ? "Đã đủ tiêu chí tối thiểu (khu vực + giá) — được gợi ý căn khớp hồ sơ.\n"
            : "CHƯA đủ tiêu chí tối thiểu (khu vực + giá) — chưa gợi ý căn trừ khi khách hỏi thẳng một căn.\n") +
          (interrogated
            ? "Hai tin trước em đều đã đặt câu hỏi — lượt này ĐƯA GIÁ TRỊ trước (gợi ý/thông tin), hỏi thật nhẹ hoặc không hỏi.\n"
            : "") +
          `\nHội thoại tới giờ:\n${convo}\n` +
          (imageUrl ? "\nKhách VỪA GỬI KÈM MỘT TẤM ẢNH (đính trên). Mô tả trung thực điều thấy được; đoán thì nói 'hình như là…' và xác nhận lại; KHÔNG suy diễn vật liệu/pháp lý từ ảnh.\n" : "") +
          `\nSoạn lượt trả lời tiếp theo của EM và cập nhật hồ sơ:` },
        ],
      }],
    });
    if (resp.stop_reason !== "refusal" && resp.parsed_output) {
      out = resp.parsed_output as typeof out;
    }
  } catch (e) {
    console.error("chat-reply model:", (e as Error)?.message);
  }

  // Fallback quy tắc: model hỏng ≠ khách nói không rõ — đừng đổ lỗi cho khách,
  // vẫn bóc được ngân sách/hẻm bằng regex và hỏi tiếp tiêu chí thiếu kế tiếp.
  if (!out) {
    const delta = regexProfileFallback(text);
    const nextMissing = BUYER_PROFILE_FIELDS
      .find(([k]) => (prefs[k] == null || prefs[k] === "") && delta[k] == null);
    out = {
      profile: delta,
      replies: [
        nextMissing
          ? `Dạ em ghi nhận rồi ạ. ${buyer.name ? `Anh/chị ${buyer.name}` : "Anh/chị"} cho em xin thêm ${nextMissing[1]} để em lọc đúng căn nha?`
          : "Dạ em ghi nhận rồi ạ. Em xem kỹ rồi báo lại anh/chị liền nha, anh/chị chờ em xíu!",
      ],
    };
  }

  // Gộp hồ sơ: chỉ ghi đè trường model bóc được (không xoá điều đã biết).
  // Riêng notes (hoàn cảnh) là TÍCH LUỸ — nối thêm, đừng ghi đè mất "mẹ già ở
  // cùng" chỉ vì hôm nay khách nói "ưu tiên gần chợ".
  const delta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(out.profile)) {
    if (v === null || v === "" || k === "name") continue;
    if (k === "notes" && typeof prefs.notes === "string" && prefs.notes) {
      if (!prefs.notes.includes(String(v))) {
        delta.notes = `${prefs.notes}; ${v}`.slice(-500);
      }
    } else {
      delta[k] = v;
    }
  }
  if (Object.keys(delta).length > 0) {
    await client.from("buyers")
      .update({ preferences: { ...prefs, ...delta } }).eq("id", buyer.id);
  }
  if (out.profile.name && !buyer.name) {
    await client.from("buyers").update({ name: out.profile.name }).eq("id", buyer.id);
  }

  // Bot bí / khách đòi người thật → gắn cờ cho CTV tiếp quản (FR-135)
  if (out.need_human) {
    await client.from("conversations")
      .update({ needs_human: true, needs_human_at: new Date().toISOString() })
      .eq("id", convId);
  }

  // Khách hứa gửi gì đó → đặt hẹn nhắc (FR-133)
  if (out.promise?.when && out.promise?.what) {
    await client.from("reminders").insert({
      kind: "promise", buyer_id: buyer.id,
      due_at: mapDue(out.promise.when), note: `${out.promise.what} (hẹn: ${out.promise.when})`,
    });
  }

  // Khách chốt lịch xem nhà (UF-06 / FR-50…53) → ghi viewings + nhắc trước giờ.
  // Khách bổ sung SĐT / đổi giờ ở lượt sau là CẬP NHẬT lịch pending đang có,
  // không tạo lịch trùng (từng tạo 2 dòng cho 1 cuộc hẹn).
  if (out.viewing?.when) {
    let listingId: string | null = null;
    if (out.viewing.listing_code) {
      const { data: lst } = await client.from("listings").select("id")
        .eq("code", out.viewing.listing_code).maybeSingle();
      listingId = lst?.id ?? null;
    }
    const slot = mapDue(out.viewing.when);
    const slotMs = Date.parse(slot);
    const { data: existVw } = await client.from("viewings")
      .select("id, listing_code")
      .eq("buyer_id", buyer.id).eq("status", "pending")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const sameAppt = existVw &&
      (!out.viewing.listing_code || !existVw.listing_code ||
        existVw.listing_code === out.viewing.listing_code);
    let vwId: string | null = null;
    if (existVw && sameAppt) {
      const patch: Record<string, unknown> = { time_text: out.viewing.when, slot };
      if (out.viewing.phone) patch.phone = out.viewing.phone;
      if (out.viewing.listing_code && !existVw.listing_code) {
        patch.listing_code = out.viewing.listing_code;
        patch.listing_id = listingId;
      }
      await client.from("viewings").update(patch).eq("id", existVw.id);
      vwId = existVw.id;
      // dời giờ nhắc theo slot mới
      await client.from("reminders")
        .update({ due_at: new Date(slotMs - 45 * 60e3).toISOString() })
        .eq("viewing_id", vwId).eq("kind", "viewing").eq("status", "pending");
    } else {
      const { data: vw } = await client.from("viewings").insert({
        buyer_id: buyer.id, listing_id: listingId,
        listing_code: out.viewing.listing_code, time_text: out.viewing.when,
        slot, phone: out.viewing.phone ?? null, status: "pending", source: "bot",
      }).select("id").single();
      vwId = vw?.id ?? null;
    }
    // Nhắc trước buổi xem ~45 phút (mẫu §6.8); lịch quá gần hoặc đã có nhắc thì thôi
    if (vwId && slotMs - Date.now() > 90 * 60e3) {
      const { count: remCnt } = await client.from("reminders")
        .select("id", { count: "exact", head: true })
        .eq("viewing_id", vwId).eq("status", "pending");
      if ((remCnt ?? 0) === 0) {
        await client.from("reminders").insert({
          kind: "viewing", buyer_id: buyer.id, viewing_id: vwId,
          due_at: new Date(slotMs - 45 * 60e3).toISOString(),
          note: `lịch xem ${out.viewing.listing_code ? "#" + out.viewing.listing_code : "nhà"} lúc ${out.viewing.when}`,
        });
      }
    }
  }

  const replies = out.replies.map((r) => r.trim()).filter(Boolean);
  for (const r of replies) {
    await client.from("messages").insert({
      conversation_id: convId, sender: "bot", body: r,
    });
  }

  // FR-32: lượt này có nói về một căn cụ thể mà khách KHÔNG chốt lịch → nếu
  // khách im ~2,5 tiếng thì chủ động gửi thêm thông tin căn đó (tối đa 1 lần/24h;
  // khách nhắn lại thì reminder này bị hủy ở đầu lượt sau).
  // Mã trong câu trả lời, không có thì lấy mã khách vừa nhắc (bot hay gọi căn
  // bằng tên đường thay vì lặp lại mã)
  const repliedCode = [...replies.join("\n").matchAll(CODE_RE)]
    .map((m) => m[1].toUpperCase())[0] ?? mentioned[0];
  if (repliedCode && !out.viewing) {
    // Trần 1 lần/24h chỉ đếm nhắc còn hiệu lực — nhắc đã CANCELLED (khách nhắn
    // lại nên chưa hề gửi) không được chặn follow-up mới
    const { count: fu24 } = await client.from("reminders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", buyer.id).eq("kind", "followup")
      .in("status", ["pending", "sent"])
      .gte("created_at", new Date(Date.now() - 24 * 3600e3).toISOString());
    if ((fu24 ?? 0) === 0) {
      const { data: fuLst } = await client.from("listings").select("id")
        .eq("code", repliedCode).maybeSingle();
      if (fuLst) {
        await client.from("reminders").insert({
          kind: "followup", buyer_id: buyer.id, listing_id: fuLst.id,
          due_at: new Date(Date.now() + 2.5 * 3600e3).toISOString(),
          note: `khách hỏi #${repliedCode} rồi im — chủ động gửi thêm thông tin căn này`,
        });
      }
    }
  }

  return new Response(
    JSON.stringify({ reply: replies.join("\n"), replies, conversation_id: convId }),
    { headers: { "Content-Type": "application/json; charset=utf-8" } },
  );
});
