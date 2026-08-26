// chat-reply — "bộ não" hội thoại B-side tách khỏi kênh (NFR-12).
// Kênh nào (OA webhook, bridge zca-js test, web chat sau này) cũng gọi vào đây.
// POST { external_user_id, text, msg_id?, channel? }
//   → { reply, replies[], conversation_id }
// Nhánh BUYER theo FR-130: hồ sơ nhu cầu tích luỹ (buyers.preferences), mỗi
// lượt hỏi đúng MỘT tiêu chí thiếu, trả lời tách tối đa 2 bong bóng.
import { z } from "npm:zod@4";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import {
  anthropicClient,
  jsonResponse,
  MODEL,
  secretOf,
  serviceClient,
} from "../_shared/claude.ts";
import {
  AGREE_RULES,
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
  const money = /([\d][\d.,]*)\s*(tỷ|tỉ|ty|tỏi|tr(?![a-zA-ZÀ-ỹ])|triệu|củ)/.exec(t);
  if (money) {
    const unit = /tr|triệu|củ/.test(money[2]) ? "triệu" : "tỷ";
    delta.budget = `${money[1]} ${unit}`;
  }
  if (/hxh|hẻm xe hơi/.test(t)) delta.alley = "hẻm xe hơi";
  else if (/mặt tiền|\bmt\b/.test(t)) delta.alley = "mặt tiền";
  // \b của JS chỉ biết ký tự ASCII, mà "thuê" kết bằng "ê" → /\bthuê\b/ KHÔNG
  // BAO GIỜ khớp. Tự dựng biên từ bằng lớp chữ tiếng Việt. ("thuế" phải trượt.)
  if (/(^|[^a-zà-ỹ])thu[êe](?![a-zà-ỹ])/.test(t)) delta.deal = "thue";
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
    /([\d][\d.,]*)\s*(triệu|trieu|củ|tr(?![a-zA-ZÀ-ỹ]))/i.exec(budget);
  if (!m) return null;
  const n = num(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const base = n * unitOf(m[2]);
  if (/trên|hơn|từ|tối thiểu|ít nhất/i.test(budget)) return { min: Math.round(base * 0.95) };
  return { max: Math.round(base * 1.15) };
}

// HAI BẢNG TỪ VỰNG cho cùng một khái niệm mua/thuê, đừng lẫn:
//   · cột DB `listings.deal` là enum `ban | cho_thue`;
//   · hồ sơ khách (buyers.preferences, JSON) và schema model dùng từ ngắn `thue`.
// Chạm vào CỘT thì phải quy đổi, không thì INSERT tin cho thuê nổ vì sai enum,
// còn bộ lọc kho .eq("deal","thue") lỗi truy vấn → khách tìm thuê không bao giờ
// được gợi ý căn nào.
const dealCol = (v: unknown): "ban" | "cho_thue" =>
  v === "thue" || v === "cho_thue" ? "cho_thue" : "ban";

// FR-29: mã căn khách nhắc ("#BDS-Q5-0115", từ web bấm sang) — chào đúng căn đó
const CODE_RE = /(?:#\s*)?\b([A-Za-z]{2,5}(?:-[A-Za-z0-9]{1,8}){1,3})\b/g;

// Hồ sơ + trả lời trong MỘT lượt gọi model (FR-130)
const BuyerTurn = z.object({
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
    listing_code: z.string().nullable().describe("Mã căn muốn xem, ví dụ 'BDS-Q5-0115' (không có # đầu)"),
    when: z.string().describe("Khung giờ khách chốt, nguyên văn: 'mai 9h sáng', 'chiều thứ 7'…"),
    phone: z.string().nullable().describe("SĐT khách TỰ cho ở bước chốt lịch; không có thì null"),
  }).nullable().describe("CHỈ điền khi khách chốt/đề nghị lịch xem nhà cụ thể (UF-06). Không suy diễn."),
  agreed_deal: z.object({
    listing_code: z.string().nullable().describe("Mã căn khách vừa đồng ý chốt, ví dụ 'BDS-Q5-0164'; không rõ mã thì null"),
  }).nullable().describe("CHỈ điền khi tin NGAY TRƯỚC của EM có đề nghị chốt hợp đồng/cọc và khách vừa ĐỒNG Ý theo AGREE_RULES (bằng chữ, emoji vui, like/tim). Không suy diễn."),
  send_photos: z.string().nullable().describe("Mã căn cần gửi hình kèm tin này — CHỈ điền khi khách xin hình và khối căn ghi 'có hình sẵn'; không thì null"),
  ask_owner: z.object({
    listing_code: z.string().nullable().describe("Mã căn cần hỏi, ví dụ 'BDS-Q5-0164' (không có # đầu)"),
    question: z.string().describe("Điều cần hỏi/xin từ chủ tin, ngắn gọn: 'hình + địa chỉ chi tiết', 'pháp lý', 'còn bán không'…"),
  }).nullable().describe("CHỈ điền khi em vừa hứa 'để em hỏi lại chủ nhà / xin hình rồi gửi anh chị' về MỘT căn cụ thể. Không suy diễn."),
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
    return jsonResponse({ error: "external_user_id và text (hoặc image_url) bắt buộc" }, 400);
  }
  const textOrTag = text || "[khách gửi ảnh]";

  const client = serviceClient();

  // ─── CỔNG 1: bí mật dùng chung (tuỳ chọn, cùng khuôn với escalation-feed).
  // chat-reply KHÔNG phải endpoint công khai: chỉ bridge (máy local) và
  // zalo-webhook (server-to-server) gọi nó, không trình duyệt nào cả. Nhưng nó
  // đang mở cho bất kỳ ai cầm anon key — mà anon key nằm sẵn trong bundle JS
  // của web VÀ trong bot/bridge-zca/index.mjs của repo PUBLIC này.
  // Đặt secret BRIDGE_SECRET trong Vault là bật cổng; chưa đặt thì chạy như cũ,
  // không làm gãy bridge đang chạy. zalo-webhook gọi bằng service_role key nên
  // luôn được cho qua.
  const gate = await secretOf(client, "BRIDGE_SECRET");
  const isService =
    req.headers.get("authorization") ===
      `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (gate && !isService && req.headers.get("x-bridge-secret") !== gate) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  // FR-141: bridge báo NGƯỜI THẬT (CTV/admin gõ tay từ acc clone) vừa nhắn cho
  // khách này → ghi tin sender='human' + đặt human_touch_at; bot nhường sân
  // 30 phút, hết yên ắng thì tự tiếp sức lại như thường.
  if (body.human_note) {
    const { data: hSeller } = await client.from("sellers").select("id")
      .eq("zalo_user_id", externalUserId).maybeSingle();
    if (!hSeller) {
      const { data: hbc } = await client.rpc("ensure_buyer_conversation", {
        p_zalo_user_id: externalUserId, p_channel: channel,
      }).single();
      const hConvId = (hbc as { c_id?: string } | null)?.c_id;
      const hBuyerId = (hbc as { b_id?: string } | null)?.b_id;
      if (hConvId) {
        await client.from("messages").insert({
          conversation_id: hConvId, sender: "human", body: text,
        });
        // FR-147: người thật đã vào tay → hạ cờ cần-người-thật, khỏi leo lên admin
        await client.from("conversations").update({
          human_touch_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
          needs_human: false,
        }).eq("id", hConvId);
        if (hBuyerId) {
          await client.from("reminders").update({ status: "cancelled" })
            .eq("buyer_id", hBuyerId).eq("kind", "escalation").eq("status", "pending");
        }
      }
    }
    return jsonResponse({ ok: true, human_note: true });
  }

  // ─── CỔNG 2: trần TOÀN CỤC lượt gọi model mỗi ngày.
  // Trần 100 tin/24h bên dưới đếm theo `conversation_id`, mà conversation sinh
  // ra từ `external_user_id` — chuỗi do người gọi tự đặt và KHÔNG được kiểm.
  // Đổi id mỗi request là bộ đếm đó về 0, tức nó chặn khách thật nhắn nhiều
  // chứ không chặn được ai cố tình đốt tiền. Trần này đếm theo ngày, không phụ
  // thuộc thứ gì người gọi kiểm soát, nên là chốt chặn cuối về TIỀN.
  // Chỉnh bằng secret DAILY_MODEL_CALL_CAP trong Vault; mặc định 1000/ngày.
  const capRaw = await secretOf(client, "DAILY_MODEL_CALL_CAP");
  const dailyCap = Number(capRaw) > 0 ? Number(capRaw) : 1000;
  const { data: underQuota } = await client.rpc("bump_model_quota", { p_limit: dailyCap });
  if (underQuota === false) {
    // Im lặng hoàn toàn: trả lời thì vẫn tốn lượt model, mà đây đúng là thứ
    // đang cần chặn. bump_model_quota đã báo admin đúng một lần trong ngày.
    return jsonResponse({ reply: null, replies: [], quota_exceeded: true }, 429);
  }

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
  const AGREE = P.agree_rules ?? AGREE_RULES;

  // NGƯỜI BÁN nhắn? (FR-129 — hỏi nhỏ giọt): nếu khớp sellers.zalo_user_id và
  // đang có câu hỏi chờ, coi tin nhắn là CÂU TRẢ LỜI → lưu fact, hỏi câu kế.
  const { data: sellerRow } = await client
    .from("sellers").select("id, name")
    .eq("zalo_user_id", externalUserId).maybeSingle();
  if (sellerRow) {
    const anthropicS = await anthropicClient(client);
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
      return jsonResponse({ reply: thanks, replies: [thanks], role: "seller" });
    }
    if (pendingReq) {
      // Câu trả lời nào cập nhật thẳng một CỘT của listings thì ghi cột TRƯỚC,
      // ghi fact sau: trigger đẩy-lên-web đọc được giá trị mới ngay lượt này.
      if (/^dien_tich/.test(pendingReq.question)) {
        const areaM = /([\d]+(?:[.,]\d+)?)\s*(?:m2|m²|mét)?/i.exec(text);
        const areaV = areaM ? parseFloat(areaM[1].replace(",", ".")) : NaN;
        if (Number.isFinite(areaV) && areaV > 5 && areaV < 5000) {
          await client.from("listings").update({ area_m2: areaV }).eq("id", pendingReq.listing_id);
        }
      }
      // Tin "chưa rõ loại" vừa được khai loại → ghi vào cột, lượt sau
      // listing_missing_facts tự đổi sang đúng bộ câu hỏi của loại đó.
      // Dùng hàm DB (FR-150) — một bộ trích xuất chung cho trigger/backfill/chat;
      // bản _answer nhận cả từ cụt ("đất", "trọ") vì đây là câu TRẢ LỜI đúng
      // câu hỏi loại, không phải cả câu rao.
      if (pendingReq.question === "loai_bds") {
        const { data: pt } = await client.rpc("guess_property_type_answer", { p_text: text });
        if (pt) {
          await client.from("listings").update({ property_type: pt })
            .eq("id", pendingReq.listing_id);
        } else {
          // Không đọc ra loại → HỎI LẠI, giữ nguyên câu hỏi pending. TUYỆT ĐỐI
          // không ghi fact `loai_bds`: ghi xong là listing_missing_facts hết
          // hỏi, tin nằm `chua_ro` vĩnh viễn — đúng kiểu chết lặng FR-150 diệt.
          const again =
            "Dạ em chưa rõ lắm ạ, nhà mình thuộc loại nào ta: nhà phố, nhà cấp 4, chung cư, đất, biệt thự, phòng trọ hay mặt bằng ạ?";
          return jsonResponse({
            reply: again, replies: [again], role: "seller", reask: "loai_bds",
          });
        }
      }

      await client.from("listing_facts").insert({
        listing_id: pendingReq.listing_id,
        question: pendingReq.question,
        answer: text,
        source: "seller_chat",
      });
      await client.from("info_requests").update({
        status: "answered", answer: text, answered_at: new Date().toISOString(),
      }).eq("id", pendingReq.id);

      // FR-144: tin ĐÃ ĐỦ ĐĂNG (auto-publish xong, hết cho_thong_tin) → NGỪNG
      // hỏi drip, để yên; khách quan tâm hỏi thêm thì FR-140 tự mở lại vòng hỏi.
      const { data: lstNow } = await client.from("listings")
        .select("code, status").eq("id", pendingReq.listing_id).maybeSingle();
      const published = !!lstNow && lstNow.status !== "cho_thong_tin";

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
      const next = published
        ? undefined
        : (nextFacts ?? []).find((f) => !pendSet.has(f.fact_key));

      const prompt = next
        ? `Người bán vừa trả lời câu hỏi "${FACT_LABELS[pendingReq.question] ?? pendingReq.question}": "${text}". Soạn MỘT tin RẤT NGẮN (~30 từ): ghi nhận/khen tự nhiên câu trả lời (điểm mạnh thật của nhà nếu có), rồi hỏi tiếp ĐÚNG MỘT thông tin: ${FACT_LABELS[next.fact_key] ?? next.fact_key}. Kèm lý do vì-khách nếu tự nhiên. Không hỏi gì khác.`
        : published
        ? `Người bán vừa trả lời: "${text}". Tin #${lstNow?.code ?? ""} giờ đã đủ thông tin và ĐÃ LÊN WEB nhadat.cc. Soạn MỘT tin NGẮN cảm ơn + báo tin đã đăng, có khách quan tâm là em báo liền. KHÔNG hỏi thêm thông tin nào nữa.`
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
      return jsonResponse({
        reply: sellerReply,
        replies: sellerReply ? [sellerReply] : [],
        role: "seller",
        saved_fact: pendingReq.question,
      });
    }
    // FR-144: chính chủ nhắn CÂU RAO MỚI (bán/cho thuê + loại BĐS, thường kèm
    // giá) → tạo tin nháp cho_thong_tin ngay + mở vòng hỏi nhỏ giọt, hỏi tới
    // khi đủ-để-đăng (giá + diện tích + phường, trigger FR-139 tự đẩy lên web)
    // thì nghỉ; khách quan tâm hỏi thêm thì FR-140 mở lại vòng hỏi.
    // \b cuối cụm chặn "cho thuê": "ê" ngoài ASCII nên sau nó không bao giờ là biên
    // từ → MỌI câu rao CHO THUÊ từ trước tới giờ đều rơi âm thầm, không tạo tin.
    const wantsSell = (/\b(bán|rao)\b|cho thu[êe]/i.test(text)) &&
      /(nhà|căn hộ|chung cư|đất|mặt bằng|phòng trọ|biệt thự|căn\b)/i.test(text) &&
      /[\d][\d.,]*\s*(tỷ|tỉ|ty|tỏi|triệu|tr(?![a-zA-ZÀ-ỹ]))|\d+\s*m2|hẻm|mặt tiền|phường/i.test(text);
    if (wantsSell) {
      // Loại BĐS KHÔNG hỏi: trigger trg_listings_fill_property_type đọc chính
      // câu rao (description) mà điền (FR-150). Chỉ tin nào câu chữ không đủ
      // để đoán mới nằm lại 'chua_ro' và bị hỏi ở vòng drip.
      // Cùng một mẫu với cổng wantsSell ở trên — lệch một chữ là câu rao lọt
      // cổng "cho thue" nhưng bị ghi thành tin BÁN.
      const sDeal = dealCol(/cho thu[êe]/i.test(text) ? "thue" : "ban");
      const wardM = /ph(?:ường|uong)\s*\.?\s*(\d{1,2})/i.exec(text);
      // "tr" viết tắt của triệu, nhưng \b sau "tr" khớp luôn "TRệt" (dấu tiếng
      // Việt không phải ký tự \w) — từng làm price_raw thành "1 trệt 2 lầu".
      // Lookahead chặn mọi chữ cái có dấu đứng sau.
      const priceM = /([\d][\d.,]*\s*(?:tỷ|tỉ|ty|tỏi|triệu|tr(?![a-zA-ZÀ-ỹ]))[^,.;\n]*)/i.exec(text);
      const newCode = `CCRB-${Date.now().toString(36).toUpperCase()}`;
      const { data: newLst } = await client.from("listings").insert({
        code: newCode, seller_id: sellerRow.id, deal: sDeal, district: "Quận 5",
        ward: wardM ? `Phường ${wardM[1]}` : null,
        description: text, price_raw: priceM?.[1]?.trim() ?? null,
        property_type: "chua_ro", status: "cho_thong_tin",
      }).select("id, code").single();
      if (newLst) {
        const { data: firstFacts } = await client.from("listing_missing_facts")
          .select("fact_key").eq("listing_id", newLst.id).order("priority").limit(1);
        const firstKey = firstFacts?.[0]?.fact_key ?? null;
        if (firstKey) {
          await client.from("info_requests").insert({
            listing_id: newLst.id, question: firstKey, status: "pending",
          });
        }
        const r1 = await anthropicS.messages.create({
          model: MODEL, max_tokens: 512,
          output_config: { effort: "low" },
          system: [{
            type: "text",
            text: TONE + "\n\n" + SELLER_SCRIPT,
            cache_control: { type: "ephemeral" },
          }],
          messages: [{
            role: "user",
            content:
              `Chính chủ vừa nhắn rao: "${text}". Em đã tạo tin #${newLst.code}. ` +
              `Soạn MỘT tin NGẮN (~35 từ): khen một điểm mạnh thật của BĐS + báo em đã ghi nhận tin rao` +
              (firstKey
                ? `, rồi hỏi ĐÚNG MỘT thông tin: ${FACT_LABELS[firstKey] ?? firstKey}. Kèm lý do vì-khách nếu tự nhiên. Không hỏi gì khác.`
                : ` và sẽ đăng lên web ngay.`),
          }],
        });
        const raoReply = r1.content.find((b) => b.type === "text")?.text?.trim() ??
          `Dạ em nhận tin rao rồi ạ, em tạo tin #${newLst.code} và sẽ hỏi thêm vài thông tin để đăng cho đẹp nha.`;
        return jsonResponse({ reply: raoReply, replies: [raoReply], role: "seller", listing_code: newLst.code });
      }
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
    return jsonResponse({ reply: sReply, replies: [sReply], role: "seller" });
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
    return jsonResponse({ error: bcErr?.message ?? "ensure_buyer_conversation" }, 500);
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
    return jsonResponse({ reply: null, replies: [], deduped: true });
  }
  if (msgErr) {
    return jsonResponse({ error: msgErr.message }, 500);
  }
  await client.from("conversations")
    .update({ last_message_at: new Date().toISOString() }).eq("id", convId);

  // FR-141: người thật nhắn tay trong 30 phút gần đây → bot im, chỉ ghi log
  // tin khách; người thật ngừng đủ lâu thì bot tự tiếp chuyện lại.
  const { data: convRow } = await client.from("conversations")
    .select("ctv_id, human_touch_at").eq("id", convId).maybeSingle();
  if (convRow?.human_touch_at &&
      Date.now() - Date.parse(convRow.human_touch_at as string) < 30 * 60e3) {
    return jsonResponse({ reply: null, replies: [], human_active: true });
  }

  // FR-146: trần 100 tin/24h mỗi khách. Chống người ta lấy anon key gọi thẳng
  // function đốt tiền model; khách thật nhắn nhiều đến mức này thì cũng nên có
  // người thật vào. Chạm trần: trả lời MỘT lần + báo CTV/admin, sau đó im.
  const DAILY_LIMIT = 100;
  const { count: msg24h } = await client.from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", convId).eq("sender", "buyer")
    .gte("created_at", new Date(Date.now() - 24 * 3600e3).toISOString());
  if ((msg24h ?? 0) > DAILY_LIMIT) {
    const { count: quotaEsc } = await client.from("reminders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", buyer.id).eq("kind", "escalation")
      .gte("created_at", new Date(Date.now() - 24 * 3600e3).toISOString());
    if ((quotaEsc ?? 0) > 0) {
      // đã báo rồi → im tới hết ngày, không tốn thêm lượt model nào
      return jsonResponse({ reply: null, replies: [], rate_limited: true });
    }
    const capMsg =
      "Dạ hôm nay mình trao đổi nhiều rồi, để em nhờ anh/chị phụ trách nhắn lại trực tiếp cho mình nha!";
    await client.from("messages").insert({
      conversation_id: convId, sender: "bot", body: capMsg,
    });
    await client.from("conversations").update({
      needs_human: true, needs_human_at: new Date().toISOString(),
    }).eq("id", convId);
    await client.from("reminders").insert({
      kind: "escalation", buyer_id: buyer.id,
      ctv_id: convRow?.ctv_id ?? null,
      due_at: new Date().toISOString(),
      note: `khách nhắn hơn ${DAILY_LIMIT} tin trong 24h, bot tạm dừng trả lời. Anh/chị vào xem giúp`,
    });
    return jsonResponse({ reply: capMsg, replies: [capMsg], rate_limited: true });
  }

  // FR-131: KHÔNG delay nhân tạo (quyết định chủ dự án 25/08 — "càng nhanh càng
  // tốt"). Chỉ giữ check nhường-lượt: tin mới hơn của cùng khách đã vào trong
  // lúc xử lý thì lượt này im, lượt của tin cuối trả lời trên ngữ cảnh gộp.
  const { data: newest } = await client
    .from("messages").select("id")
    .eq("conversation_id", convId).eq("sender", "buyer")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (newest && insMsg && newest.id !== insMsg.id) {
    return jsonResponse({ reply: null, replies: [], superseded: true });
  }

  // Buyer quay lại nhắn → hủy nhắc-lời-hứa + follow-up đang chờ (FR-133/FR-32)
  await client.from("reminders").update({ status: "cancelled" })
    .eq("buyer_id", buyer.id).in("kind", ["promise", "followup"]).eq("status", "pending");

  // Kho lọc theo hồ sơ: mua/thuê, phường (nếu bắt được), số PN, cận trên giá (SRS-4.5)
  let khoQ = client
    .from("listings")
    .select("code, ward, location_raw, price_raw, area_m2, bedrooms")
    .eq("deal", dealCol(prefs.deal))
    .in("status", ["dang_ban", "dang_quan_tam"]) // FR-139: chỉ gợi ý tin đang lên kệ
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

  const [{ data: history }, { data: listings }, { data: partnerProj }, { data: matchedProj }, { data: askedListings }, { data: askedPhotos }] = await Promise.all([
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
        .select("code, status, ward, location_raw, price_raw, area_m2, bedrooms, listing_facts(question, answer)")
        .in("code", mentioned).limit(3)
      : Promise.resolve({ data: [] as never[] }),
    // FR-148: kho ảnh thật up theo MÃ tin (bucket listing-photos/<mã>/…)
    mentioned.length
      ? client.from("listing_photos_v").select("code, url").in("code", mentioned).limit(24)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const ordered = (history ?? []).reverse();
  const convo = ordered
    .map((m) =>
      `${m.sender === "buyer" ? "KHÁCH" : m.sender === "human" ? "EM (người thật bên mình nhắn tay)" : "EM"}: ${m.body}`)
    .join("\n");
  const kho = (listings ?? [])
    .map((l) =>
      `#${l.code} · ${l.location_raw ?? ""} ${l.ward ?? ""} · ${l.price_raw} · ${l.area_m2 ?? "?"}m2${l.bedrooms ? ` · ${l.bedrooms}PN` : ""}`)
    .join("\n");

  // Khối "căn khách đang nhắc" (FR-29): đủ chi tiết + facts đã xác minh + trạng thái
  const STATUS_VI: Record<string, string> = {
    cho_thong_tin: "đang chờ bổ sung thông tin, chưa lên kệ",
    dang_ban: "đang bán",
    dang_quan_tam: "đang được nhiều khách quan tâm",
    da_chot: "ĐÃ CHỐT GIAO DỊCH — báo thật với khách là căn này đã chốt rồi gợi ý căn tương tự trong KHO",
    an: "đã gỡ khỏi kệ",
  };
  type Asked = {
    code: string; status?: string | null; ward?: string | null; location_raw?: string | null;
    price_raw?: string | null; area_m2?: number | null; bedrooms?: number | null;
    listing_facts?: Array<{ question: string; answer: string }> | null;
  };
  // FR-143/148: hình sẵn có của một căn = ảnh up theo mã (bucket listing-photos)
  // + URL chính chủ gửi qua chat (facts hinh_anh). Ảnh kho đứng trước.
  const PHOTO_URL_RE = /https?:\/\/\S+/g;
  const photoByCode: Record<string, string[]> = {};
  for (const p of (askedPhotos ?? []) as Array<{ code: string; url: string }>) {
    (photoByCode[p.code] ??= []).push(p.url);
  }
  const photosOf = (l: Asked): string[] => [
    ...(photoByCode[l.code] ?? []),
    ...(l.listing_facts ?? [])
      .filter((f) => f.question === "hinh_anh")
      .flatMap((f) => f.answer.match(PHOTO_URL_RE) ?? []),
  ];
  const askedBlock = ((askedListings ?? []) as Asked[])
    .map((l) => {
      const facts = (l.listing_facts ?? [])
        .filter((f) => f.question !== "hinh_anh")
        .map((f) => `${f.question}: ${f.answer}`).join("; ");
      const nPhotos = photosOf(l).length;
      return `#${l.code} · ${l.location_raw ?? ""} ${l.ward ?? ""} · ${l.price_raw ?? "giá đang cập nhật"} · ${l.area_m2 ?? "?"}m2${l.bedrooms ? ` · ${l.bedrooms}PN` : ""}${l.status ? ` · trạng thái: ${STATUS_VI[l.status] ?? l.status}` : ""}${facts ? ` · đã xác minh từ chủ nhà: ${facts}` : ""}${nPhotos ? ` · CÓ ${nPhotos} HÌNH SẴN (khách xin hình thì điền send_photos, hệ thống tự đính kèm — ĐỪNG hứa đi hỏi chủ nhà)` : " · chưa có hình sẵn"}`;
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

  let out:
    | {
      profile: Record<string, unknown>; replies: string[];
      promise?: { when: string; what: string } | null;
      viewing?: { listing_code: string | null; when: string; phone: string | null } | null;
      ask_owner?: { listing_code: string | null; question: string } | null;
      agreed_deal?: { listing_code: string | null } | null;
      send_photos?: string | null;
      need_human?: boolean;
    }
    | null = null;
  try {
    // Dựng client TRONG try: thiếu key/hỏng model đều rơi về fallback regex bên
    // dưới thay vì 500 — không đổ lỗi cho khách (giữ đúng ý đồ fallback cũ).
    const anthropic = await anthropicClient(client);
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
        text: TONE + "\n\n" + HUMAN + "\n\n" + FEES + "\n\n" + SLANG + "\n\n" + AGREE + "\n\n" + FEWSHOT +
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
          (minimumMet
            ? `CHƯA BIẾT (chỉ NHẶT khi khách tự kể hoặc khi khách chê căn vừa gửi, TUYỆT ĐỐI không hỏi chủ động — đủ khu vực + giá là ngừng dò hồ sơ):\n${missing || "(đã đủ)"}\n\n`
            : `CÒN THIẾU (hỏi theo thứ tự ưu tiên; gộp 2-3 ý vào MỘT câu hỏi liền mạch cũng được, đừng thành bảng hỏi):\n${missing || "(đã đủ)"}\n\n`) +
          (minimumMet
            ? "Đã đủ tiêu chí tối thiểu (khu vực + giá) — NGỪNG hỏi hồ sơ, chuyển sang gợi ý căn khớp và để khách dẫn chuyện.\n"
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

  // Bot bí / khách đòi người thật → gắn cờ (FR-135) + BÁO NGAY cho CTV đang
  // chăm đơn (FR-147). Quá 30 phút chưa ai đụng tay thì nudge leo tiếp lên
  // admin. Chống báo lặp: đã có escalation pending cho khách này thì thôi.
  if (out.need_human) {
    await client.from("conversations")
      .update({ needs_human: true, needs_human_at: new Date().toISOString() })
      .eq("id", convId);
    const { count: hEsc } = await client.from("reminders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", buyer.id).eq("kind", "escalation").eq("status", "pending");
    if ((hEsc ?? 0) === 0) {
      await client.from("reminders").insert({
        kind: "escalation", buyer_id: buyer.id, ctv_id: convRow?.ctv_id ?? null,
        due_at: new Date().toISOString(),
        note: `🙋 khách cần người thật${buyer.name ? ` (${buyer.name})` : ""}. Tin cuối: "${text.slice(0, 120)}"`,
      });
    }
  }

  // FR-140: bot hứa "để em hỏi lại chủ nhà" → tạo info_request; trigger DB
  // định tuyến: chính chủ có Zalo → CTV còn liên lạc được → admin phụ trách
  // (kèm reminder escalation để nudge/bridge đi báo ngay).
  if (out.ask_owner?.question) {
    const aoCode = (out.ask_owner.listing_code ?? mentioned[0] ?? "").toUpperCase();
    if (aoCode) {
      const { data: aoLst } = await client.from("listings").select("id")
        .eq("code", aoCode).maybeSingle();
      if (aoLst) {
        // chống hỏi trùng: đã có yêu cầu pending của khách cho căn này trong 24h thì thôi
        const { count: aoDup } = await client.from("info_requests")
          .select("id", { count: "exact", head: true })
          .eq("listing_id", aoLst.id).eq("status", "pending").eq("source", "buyer_ask")
          .gte("created_at", new Date(Date.now() - 24 * 3600e3).toISOString());
        if ((aoDup ?? 0) === 0) {
          await client.from("info_requests").insert({
            listing_id: aoLst.id, buyer_id: buyer.id,
            question: out.ask_owner.question, status: "pending", source: "buyer_ask",
          });
        }
      }
    }
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
  const repliedCodes = [...replies.join("\n").matchAll(CODE_RE)]
    .map((m) => m[1].toUpperCase());
  const repliedCode = repliedCodes[0] ?? mentioned[0];

  // FR-139: khách hỏi / bot đưa căn nào ra → đánh dấu "đang được quan tâm"
  // (7 ngày không ai hỏi nữa thì cron tự trả về đang bán)
  const interestCodes = [...new Set([...mentioned, ...repliedCodes])];
  if (interestCodes.length) {
    await client.rpc("mark_listing_interest", { p_codes: interestCodes });
  }

  // FR-142: khách ĐỒNG Ý chốt (chữ / emoji vui / like-tim theo AGREE_RULES) →
  // ghi deals + listing sang da_chot + báo gấp CTV/admin qua kênh escalation.
  if (out.agreed_deal) {
    const dealCode = (out.agreed_deal.listing_code ?? mentioned[0] ?? repliedCode ?? "").toUpperCase();
    if (dealCode) {
      const { data: dl } = await client.from("listings")
        .select("id, price_vnd, seller_id, sellers(seller_type)")
        .eq("code", dealCode).maybeSingle();
      if (dl) {
        const { count: dupDeal } = await client.from("deals")
          .select("id", { count: "exact", head: true })
          .eq("listing_id", dl.id).eq("buyer_id", buyer.id);
        if ((dupDeal ?? 0) === 0) {
          const sType = (dl.sellers as { seller_type?: string } | null)?.seller_type;
          await client.from("deals").insert({
            listing_id: dl.id, buyer_id: buyer.id,
            ctv_id: convRow?.ctv_id ?? null,
            price_vnd: dl.price_vnd ?? null,
            fee_pct: sType === "ccrb" ? 1.0 : sType ? 0.5 : null,
            closed_at: new Date().toISOString(),
          });
          await client.from("listings").update({ status: "da_chot" }).eq("id", dl.id);
          await client.from("reminders").insert({
            kind: "escalation", listing_id: dl.id, buyer_id: buyer.id,
            ctv_id: convRow?.ctv_id ?? null, due_at: new Date().toISOString(),
            note: `🤝 khách vừa ĐỒNG Ý CHỐT căn #${dealCode}. Liên hệ làm hợp đồng gấp`,
          });
        }
      }
    }
  }

  // FR-143: gửi hình thật kèm tin — nguồn là URL chính chủ đã gửi (facts
  // hinh_anh). Model điền send_photos; khách xin hình mà model quên thì vẫn
  // tự đính kèm theo mã khách nhắc.
  let photos: string[] = [];
  const photoWanted = out.send_photos ??
    (/hình|ảnh|hinh anh|photo|\bpic\b/i.test(text) ? (mentioned[0] ?? repliedCode ?? null) : null);
  if (photoWanted) {
    const pCode = photoWanted.toUpperCase();
    const inAsked = ((askedListings ?? []) as Asked[]).find((l) => l.code === pCode);
    if (inAsked) photos = photosOf(inAsked).slice(0, 4);
    else {
      const [{ data: pStore }, { data: pFacts }] = await Promise.all([
        client.from("listing_photos_v").select("url").eq("code", pCode).limit(4),
        client.from("listing_facts")
          .select("answer, listings!inner(code)")
          .eq("question", "hinh_anh").eq("listings.code", pCode).limit(4),
      ]);
      photos = [
        ...(pStore ?? []).map((p) => p.url as string),
        ...(pFacts ?? []).flatMap((f) => (f.answer as string).match(PHOTO_URL_RE) ?? []),
      ].slice(0, 4);
    }
  }
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

  return jsonResponse({ reply: replies.join("\n"), replies, photos, conversation_id: convId });
});
