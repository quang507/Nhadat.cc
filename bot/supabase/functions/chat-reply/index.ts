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
  doTien,
  ghiLoi,
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

// FR-161 — RẤT NHIỀU người nhắn Zalo không bỏ dấu, mà mọi cổng regex ở đây
// từng viết bằng chữ có dấu: "ban nha quan 5 gia 5 ty" trượt cổng rao im lặng,
// "toi muon mua nha" không tách được vai, "chieu gui anh" không thành lời hứa.
// Chữa ở GỐC chứ không vá từng mẫu: chuẩn hoá đầu vào một lần rồi khớp.
//
// Luật hai chế độ: tin CÓ DẤU thì khớp bằng bộ regex có dấu như cũ (dấu của
// người gõ là thông tin — "đang bàn" khác "đang bán", đừng vứt đi); tin KHÔNG
// DẤU mới rơi về bộ regex đã bỏ dấu, chấp nhận nhập nhằng vốn có của tiếng
// Việt không dấu (ban = bán/bàn/bạn). Model thì đọc text GỐC — model không mù
// dấu, chỉ regex là mù.
const boDau = (s: string): string =>
  s.toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
// Fallback quy tắc khi model lỗi/hết quota (hướng parseVnd của NhaDat-Radar):
// bắt tối thiểu ngân sách + hẻm/mặt tiền bằng regex để hồ sơ không mất dữ liệu,
// và trả lời template thay vì im lặng hay đổ lỗi cho khách.
function regexProfileFallback(text: string): Record<string, string> {
  // Chạy trên bản BỎ DẤU (FR-161): fallback này chỉ nhặt số + từ khoá thô,
  // và bản không dấu phủ được cả hai kiểu gõ. "thuế" → "thue" vẫn dính nhầm
  // như trước, chấp nhận — đây là lưới cuối khi model đã hỏng.
  const t = boDau(text);
  const delta: Record<string, string> = {};
  const money = /([\d][\d.,]*)\s*(ty|ti|toi|tr(?![a-z])|trieu|cu)/.exec(t);
  if (money) {
    const unit = /^(tr|trieu|cu)$/.test(money[2]) ? "triệu" : "tỷ";
    delta.budget = `${money[1]} ${unit}`;
  }
  if (/hxh|hem xe hoi/.test(t)) delta.alley = "hẻm xe hơi";
  else if (/mat tien|\bmt\b/.test(t)) delta.alley = "mặt tiền";
  if (/(^|[^a-z])thue(?![a-z])/.test(t)) delta.deal = "thue";
  else if (/\bmua\b/.test(t)) delta.deal = "ban";
  return delta;
}

// FR-133: "chiều/mai/tối… em gửi" → hẹn giờ nhắc (giờ VN = UTC+7)
function mapDue(when: string): string {
  // Bản bỏ dấu (FR-161) phủ cả hai kiểu gõ: "chieu mai" hẹn được y như
  // "chiều mai". Đổi lại "tôi"/"tối" nhập một — chỉ lệch GIỜ nhắc, không mất nhắc.
  const t = boDau(when);
  const now = Date.now();
  const vn = new Date(now + 7 * 3600e3);
  let day = 0;
  if (/mai|hom sau/.test(t)) day = 1;
  // "thứ 7", "chủ nhật/CN" → số ngày tới thứ đó (trùng hôm nay thì lấy hôm nay)
  const wd = /thu\s*([2-7])/.exec(t);
  if (wd) day = ((parseInt(wd[1], 10) - 1) - vn.getUTCDay() + 7) % 7;
  else if (/chu nhat|\bcn\b/.test(t)) day = (7 - vn.getUTCDay()) % 7;
  let hour = 15;
  const hm = /(\d{1,2})\s*(?:h|gio)/.exec(t);
  if (hm) {
    hour = Math.min(23, Math.max(0, parseInt(hm[1], 10)));
    // "3h chiều", "8h tối" — giờ kèm buổi thì cộng 12, kẻo thành 3h/8h SÁNG
    if (hour < 12 && /chieu|toi|dem/.test(t)) hour += 12;
  } else if (/sang/.test(t)) hour = 9;
  else if (/trua/.test(t)) hour = 12;
  else if (/chieu/.test(t)) hour = 15;
  else if (/toi|dem/.test(t)) hour = 19;
  else if (/cuoi tuan/.test(t)) { day = ((6 - vn.getUTCDay()) + 7) % 7 || 6; hour = 10; }
  let due = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + day, hour - 7);
  if (due <= now) due = now + 2 * 3600e3; // đã qua giờ đó → nhắc sau 2 tiếng
  return new Date(due).toISOString();
}
// Regex bắt lời hứa cho nhánh seller (không qua parse có cấu trúc).
// Hai bản có-dấu / không-dấu, chọn theo tin (FR-161).
const PROMISE_RE = /(sáng mai|chiều|tối|trưa|mai|cuối tuần)[^.,;!?]{0,30}?(gửi|chụp|báo|đưa|bổ sung|cho em|check|coi lại)|(gửi|chụp|báo|đưa|bổ sung|check|coi lại)[^.,;!?]{0,30}?(sáng mai|chiều|tối|trưa|mai|cuối tuần)/i;
const PROMISE_RE_KD = /(sang mai|chieu|toi|trua|mai|cuoi tuan)[^.,;!?]{0,30}?(gui|chup|bao|dua|bo sung|cho em|check|coi lai)|(gui|chup|bao|dua|bo sung|check|coi lai)[^.,;!?]{0,30}?(sang mai|chieu|toi|trua|mai|cuoi tuan)/;

// SRS-4.5: khoảng giá trong hồ sơ → biên VND để lọc kho bằng price_vnd
// (cột số, parse_vnd phía DB — hướng parseVnd của NhaDat-Radar).
// "tầm/dưới 5 tỷ" → cận trên ×1.15; "trên/từ 4 tỷ" → cận DƯỚI; "5-6 tỷ" → cả hai.
function budgetRangeVnd(budget: unknown): { min?: number; max?: number } | null {
  if (typeof budget !== "string") return null;
  // Bỏ dấu một lần (FR-161): hồ sơ do model bóc thì có dấu, do fallback regex
  // thì không — hàm này phải nuốt được cả hai mà không nhân đôi bảng mẫu.
  const bd = boDau(budget);
  const unitOf = (u: string) => (/^(ty|ti|toi)$/.test(u) ? 1e9 : 1e6);
  const num = (s: string) => parseFloat(s.replace(",", "."));
  const range =
    /([\d][\d.,]*)\s*[-–~]\s*([\d][\d.,]*)\s*(ty|ti|toi|trieu|cu)/.exec(bd);
  if (range) {
    const u = unitOf(range[3]);
    const a = num(range[1]) * u, b = num(range[2]) * u;
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b >= a) {
      return { min: Math.round(a * 0.95), max: Math.round(b * 1.1) };
    }
  }
  const m = /([\d][\d.,]*)\s*(ty|ti|toi)(?![a-z])/.exec(bd) ??
    /([\d][\d.,]*)\s*(trieu|cu|tr(?![a-z]))/.exec(bd);
  if (!m) return null;
  const n = num(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const base = n * unitOf(m[2]);
  if (/tren|hon|\btu\b|toi thieu|it nhat/.test(bd)) return { min: Math.round(base * 0.95) };
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
  // `mark_sent` là cửa ghi sổ, không phải tin nhắn — nó không có người gửi lẫn
  // nội dung. Xử ở dưới, SAU cổng bí mật.
  if (!body.mark_sent && (!externalUserId || (!text && !imageUrl))) {
    return jsonResponse({ error: "external_user_id và text (hoặc image_url) bắt buộc" }, 400);
  }
  const textOrTag = text || "[khách gửi ảnh]";

  // FR-161: người ta gõ LẪN dấu suốt — "ban nha q5 giá 5 ty" có đúng một chữ
  // có dấu. Bản trước dò một cờ "câu này có dấu không" (bật khi câu chứa BẤT KỲ
  // ký tự có dấu nào) rồi chọn MỘT bộ regex theo cờ đó, nên câu lẫn dấu bị dồn
  // hết vào bộ CÓ DẤU và "ban", "nha" không khớp "bán", "nhà" — câu rơi im
  // lặng. Cờ đó nay bỏ hẳn: giữ lại là mời người sau dùng lại đúng cái bẫy.
  // `khop` thử CẢ HAI rồi lấy hợp: bộ không dấu chạy trên `tKD` (đã bỏ dấu)
  // nên phủ luôn câu gõ đủ dấu, bộ có dấu giữ cụm chỉ đúng khi có dấu. Chỉ nới
  // thêm, không bỏ mất khớp nào. Model vẫn nhận `text` gốc.
  const tKD = boDau(text);
  const khop = (coDau: RegExp, khongDau: RegExp) =>
    coDau.test(text) || khongDau.test(tKD);

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
  // Cổng fail-open là chủ ý (gắn cổng trước khi có bí mật thì cron không gãy),
  // nhưng KHÔNG được im: một lần đọc hụt Vault là hàm này thành công khai mà
  // chẳng ai hay. Ghi sổ để /admin thấy — im lặng mới là cái nguy.
  if (!gate) {
    await ghiLoi(client, "chat-reply CONG MO",
      "Không đọc được BRIDGE_SECRET (env lẫn Vault) — cổng đang MỞ, ai cũng gọi được.");
  }
  const isService =
    req.headers.get("authorization") ===
      `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (gate && !isService && req.headers.get("x-bridge-secret") !== gate) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  // FR-162 — CỬA GHI NHẬN ĐÃ GỬI, cho người gọi không cầm service key.
  // `zalo-webhook` có service key nên tự ghi `sent_bubbles`/`sent_at` vào sổ.
  // Bridge (máy local) chỉ có publishable key + bí mật cổng, không đụng bảng
  // được — nên bên kênh `zalo_personal_test`, `sent_at` KHÔNG BAO GIỜ được ghi
  // và `already_sent` vĩnh viễn false. Tức cờ chống-gửi-đúp của FR-162 là chữ
  // chết ở đúng cái kênh đang chạy thật: một `msg_id` giao hai lần — hai lượt
  // thả tim cùng map về `react-<tid>-<gMsgID>` — là khách nhận lại nguyên loạt
  // bong bóng. Cửa này trả cho bridge đúng nửa còn thiếu.
  if (body.mark_sent) {
    const soDaGui = Number(body.sent_bubbles ?? 0);
    const xong = body.done !== false;
    const { error: msErr } = await client.from("inbound_ledger").update({
      sent_bubbles: Number.isFinite(soDaGui) ? soDaGui : 0,
      ...(xong
        ? { sent_at: new Date().toISOString(), send_error: null }
        : { send_error: "gửi hụt giữa chừng — bridge báo lại" }),
      updated_at: new Date().toISOString(),
    }).eq("zalo_msg_id", String(body.mark_sent));
    if (msErr) await ghiLoi(client, "chat-reply mark_sent", msErr.message);
    return jsonResponse({ ok: !msErr, marked: String(body.mark_sent), done: xong });
  }

  // FR-141: bridge báo NGƯỜI THẬT (CTV/admin gõ tay từ acc clone) vừa nhắn cho
  // khách này → ghi tin sender='human' + đặt human_touch_at; bot nhường sân
  // 30 phút, hết yên ắng thì tự tiếp sức lại như thường.
  //
  // Tin gõ tay KHÔNG mang theo vai, mà một Zalo có thể vừa bán vừa mua
  // (OPEN-22/FR-157). Trước bản này `if (!hSeller)` bỏ qua SẠCH người bán —
  // tức `human_touch_at` không bao giờ được đặt trên hội thoại người bán, nên
  // cổng nhường sân bên nhánh seller là code chết: CTV đang thương lượng với
  // chủ nhà mà chủ nhắn tiếp thì bot vẫn chen ngang. Giờ đóng cổng ở MỌI hội
  // thoại đang có của người này.
  if (body.human_note) {
    const now141 = new Date().toISOString();
    const cham: string[] = [];
    const chamVao = async (convId: string, vai: string) => {
      const { error: hErr } = await client.from("messages").insert({
        conversation_id: convId, sender: "human", body: text,
      });
      if (hErr) await ghiLoi(client, `chat-reply human_note messages(${vai})`, hErr.message);
      // FR-147: người thật đã vào tay → hạ cờ cần-người-thật, khỏi leo lên admin
      await client.from("conversations").update({
        human_touch_at: now141, last_message_at: now141, needs_human: false,
      }).eq("id", convId);
      cham.push(vai);
    };

    const { data: hSeller } = await client.from("sellers").select("id")
      .eq("zalo_user_id", externalUserId).maybeSingle();

    if (hSeller) {
      const { data: hsc, error: hscErr } = await client
        .rpc("ensure_seller_conversation", {
          p_seller_id: hSeller.id, p_channel: channel,
        }).single();
      const hsConvId = (hsc as { c_id?: string } | null)?.c_id ?? null;
      if (hscErr || !hsConvId) {
        await ghiLoi(client, "chat-reply human_note ensure_seller_conversation",
          hscErr?.message ?? "không trả về c_id");
      } else {
        await chamVao(hsConvId, "seller");
      }

      // Người đang bán VẪN có thể đang có hội thoại mua (FR-157) — cổng phải
      // phủ luôn nhánh đó. Nhưng chỉ đụng hội thoại ĐÃ CÓ: tạo mới buyer cho
      // một người đang bán là bịa ra một đơn khách không tồn tại.
      const { data: hBuyer } = await client.from("buyers").select("id")
        .eq("zalo_user_id", externalUserId).maybeSingle();
      if (hBuyer) {
        const { data: hbConv } = await client.from("conversations").select("id")
          .eq("buyer_id", hBuyer.id).order("started_at", { ascending: false })
          .limit(1).maybeSingle();
        if (hbConv) {
          await chamVao(hbConv.id, "buyer");
          await client.from("reminders").update({ status: "cancelled" })
            .eq("buyer_id", hBuyer.id).eq("kind", "escalation").eq("status", "pending");
        }
      }
    } else {
      const { data: hbc, error: hbcErr } = await client.rpc("ensure_buyer_conversation", {
        p_zalo_user_id: externalUserId, p_channel: channel,
      }).single();
      const hConvId = (hbc as { c_id?: string } | null)?.c_id ?? null;
      const hBuyerId = (hbc as { b_id?: string } | null)?.b_id ?? null;
      if (hbcErr || !hConvId) {
        await ghiLoi(client, "chat-reply human_note ensure_buyer_conversation",
          hbcErr?.message ?? "không trả về c_id");
      } else {
        await chamVao(hConvId, "buyer");
        if (hBuyerId) {
          await client.from("reminders").update({ status: "cancelled" })
            .eq("buyer_id", hBuyerId).eq("kind", "escalation").eq("status", "pending");
        }
      }
    }
    return jsonResponse({ ok: true, human_note: true, cham });
  }

  // ─── SỔ INBOUND (FR-162): mỗi zalo_msg_id là MỘT vòng đời xử lý
  // received → processing → completed/failed, lưu nguyên payload trả lời.
  // Đứng TRƯỚC cổng quota là cố ý: tin duplicate không được đốt lượt model.
  //   * completed → PHÁT LẠI payload đã lưu. Kênh gửi hụt (Zalo lỗi, bridge
  //     timeout) cứ gọi lại cùng msg_id là lấy lại được câu trả lời — retry
  //     outbound không cần chạy lại AI.
  //   * in_flight → bản sao thứ hai của cùng tin đang được lượt khác xử lý
  //     NGAY LÚC NÀY (race hai bản sao). Đứng ngoài, không xử lý đôi; bridge
  //     thấy cờ này thì chờ rồi hỏi lại.
  //   * claimed  → làm như thường. r_attempts > 1 nghĩa là lượt trước
  //     failed/chết giữa chừng — tin có thể ĐÃ nằm trong `messages`, nên 23505
  //     ở dưới không được nuốt nữa mà phải đi tiếp trả lời nốt.
  // Sổ hỏng (RPC lỗi) thì chạy như cũ — unique index messages.zalo_msg_id vẫn
  // là lưới đỡ cuối — nhưng phải vào bot_errors (FR-152).
  let coSo = false;      // lượt này có cầm sổ không
  let soAttempts = 1;    // lần thử thứ mấy của msg_id này
  if (msgId) {
    const { data: so, error: soErr } = await client
      .rpc("claim_inbound", { p_msg_id: msgId }).single();
    const soRow = so as {
      r_state?: string; r_reply?: Record<string, unknown> | null; r_attempts?: number;
      r_sent_at?: string | null;
    } | null;
    if (soErr || !soRow?.r_state) {
      await ghiLoi(client, "chat-reply claim_inbound",
        soErr?.message ?? "không trả về r_state");
    } else if (soRow.r_state === "completed") {
      // `already_sent` = lần trước MỌI bong bóng đã tới Zalo (webhook ghi
      // sent_at). Kênh dựa vào cờ này để exactly-once chiều gửi: provider giao
      // trùng thì im (khách không nhận đúp), gửi hụt lần trước thì gửi lại.
      return jsonResponse({
        reply: null, replies: [], ...(soRow.r_reply ?? {}),
        deduped: true, replayed: true, already_sent: !!soRow.r_sent_at,
      });
    } else if (soRow.r_state === "in_flight") {
      return jsonResponse({ reply: null, replies: [], deduped: true, in_flight: true });
    } else if (soRow.r_state === "dead" || soRow.r_dead) {
      // FR-166 bất biến 7: đã hỏng đủ 8 lượt, ĐỪNG THỬ NỮA. Trước bản này
      // `dead` rơi tuột vào nhánh `else` bên dưới và được xử như việc mới:
      //   * đốt một lượt gọi model đầy đủ cho một dòng đã bị bỏ,
      //   * `baoHong` sau đó va guard `inbound_ledger_giu_completed` nên không
      //     ghi được gì — hỏng im lặng,
      //   * và vì nhánh này KHÔNG cầm hợp đồng thuê, hai lượt giao cùng lúc của
      //     cùng msg_id đều chạy tới cuối và ĐỀU GỬI, phá đúng cái bất biến
      //     exactly-once mà cả FR-162 dựng lên để giữ.
      // Không giành sổ (`coSo` giữ false) nên mọi đường ra phía sau không đụng
      // vào dòng thư chết nữa.
      await ghiLoi(client, "chat-reply dead",
        `msg_id ${msgId} đã ở thư chết sau ${soRow.r_attempts ?? "?"} lượt — bỏ qua, ` +
          `không gọi model. Xem /admin để xử tay.`);
      return jsonResponse({
        reply: null, replies: [], deduped: true, dead: true,
        already_sent: !!soRow.r_sent_at,
      });
    } else {
      coSo = true;
      soAttempts = soRow.r_attempts ?? 1;
    }
  }
  // MỌI đường ra phía sau phải đi qua một trong hai cửa này, để sổ không bao
  // giờ kẹt ở processing oan (kẹt thật — function chết — thì claim_inbound tự
  // reclaim sau 150s). Ghi sổ hụt không được chặn đường trả lời: chỉ ghiLoi.
  const hoanTat = async (payload: Record<string, unknown>, code = 200) => {
    if (coSo) {
      const { error: soErr2 } = await client.from("inbound_ledger").update({
        status: "completed", reply: payload, updated_at: new Date().toISOString(),
      }).eq("zalo_msg_id", msgId);
      if (soErr2) await ghiLoi(client, "chat-reply hoanTat ledger", soErr2.message);
    }
    return jsonResponse(payload, code);
  };
  const baoHong = async (payload: Record<string, unknown>, code: number, detail: string) => {
    if (coSo) {
      // FR-166: PHẢI đi qua `bao_hong_inbound`, đừng ghi thẳng `status='failed'`.
      // Hàm đó mới là chỗ đặt `next_retry_at = now() + lan_thu_ke(attempts)` và
      // tự chuyển thư chết ở lượt thứ 8. Ghi tay như trước là bỏ mất giờ hẹn:
      // `inbound-sweep` quét `failed` với `next_retry_at` NULL thì coi là tới
      // giờ NGAY, nên nó cứu lại mỗi phút một lượt — một tin gặp lỗi hết hạn
      // mức (quota) đốt sạch 8 lượt trong 8 phút rồi nằm `dead` vĩnh viễn,
      // đúng ngược lại lời hứa "lùi dần" ghi trong chính comment cũ.
      // Hàm này cũng tự né dòng đã `completed` (guard FR-163), nên không cần
      // kiểm trước ở đây.
      const { error: soErr3 } = await client.rpc("bao_hong_inbound", {
        p_msg_id: msgId, p_detail: detail.slice(0, 500),
      });
      if (soErr3) await ghiLoi(client, "chat-reply baoHong ledger", soErr3.message);
    }
    return jsonResponse(payload, code);
  };

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
    // Sổ ghi failed chứ không completed: sang ngày quota reset, kênh gửi lại
    // cùng msg_id thì tin ĐƯỢC xử lý thật chứ không bị phát lại cái rỗng.
    return await baoHong(
      { reply: null, replies: [], quota_exceeded: true }, 429, "quota ngày đã chạm trần",
    );
  }

  // Qua hết các cổng — từ đây là xử lý thật.
  if (coSo) {
    const { error: soPErr } = await client.from("inbound_ledger").update({
      status: "processing", updated_at: new Date().toISOString(),
    }).eq("zalo_msg_id", msgId);
    if (soPErr) await ghiLoi(client, "chat-reply ledger processing", soPErr.message);
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
    .from("sellers").select("id, name, active_listing_id")
    .eq("zalo_user_id", externalUserId).maybeSingle();

  // OPEN-22 / FR-157: một Zalo VỪA BÁN VỪA MUA. Nhận diện người vẫn theo
  // zalo_user_id (quyết định chủ dự án 27/08/2026), nhưng VAI thì xét từng
  // lượt: có dòng `sellers` không có nghĩa cả đời người này chỉ được bán.
  // Trước bản này, hễ khớp `sellers` là chốt vai bán cho MỌI tin — chính chủ
  // vừa rao xong muốn hỏi mua căn khác thì không có đường nào đi tới nhánh
  // buyer, bot cứ hỏi ngược lại về căn của họ.
  // Câu hỏi chờ KHÔNG mất khi rẽ sang nhánh mua: `info_requests` vẫn
  // `pending`, cron drip sẽ hỏi lại.
  // Cổng này quyết định NGƯỜI BÁN nhắn có được rẽ sang nhánh mua hay không, nên
  // trượt vì gõ lẫn dấu là nặng nhất trong ba chỗ: "toi muon mua nha q5, giá
  // tốt ko" có đúng hai chữ có dấu, bản trước dồn vào bộ có dấu, không khớp vế
  // nào, và người hỏi mua bị bot hỏi ngược về căn của chính họ.
  const hoiMua =
    khop(
      /(muốn|cần|tìm|kiếm|đang coi|đang xem)\s*(mua|thu[êe]|nhà|căn|đất|phòng|mặt bằng|chung cư)/i,
      /(muon|can|tim|kiem|dang coi|dang xem)\s*(mua|thue|nha|can|dat|phong|mat bang|chung cu)/,
    ) ||
    khop(
      /(có|còn)\s*căn nào|xem nhà|coi nhà|tư vấn (mua|thu[êe])/i,
      /(co|con)\s*can nao|xem nha|coi nha|tu van (mua|thue)/,
    );

  if (sellerRow && !hoiMua) {
    // OPEN-30 → đóng: model là NGƯỜI SOẠN CÂU CHỮ, không phải điều kiện sống
    // của nhánh. Key hỏng/hết credit thì mọi lệnh gọi bên dưới rơi về câu mẫu
    // tất định — chủ nhà không bao giờ nhận im lặng + 500 như trước, và lỗi
    // vào sổ qua ghiLoi (FR-152) thay vì xuyên thẳng ra ngoài không dấu vết.
    // Nhánh mua đã làm đúng bài này từ đầu; đây là đưa nhánh bán về cùng chuẩn.
    let anthropicS: Awaited<ReturnType<typeof anthropicClient>> | null = null;
    try {
      anthropicS = await anthropicClient(client);
    } catch (e) {
      await ghiLoi(client, "chat-reply anthropic(seller)", e);
    }

    // FR-141/FR-152 — hội thoại NGƯỜI BÁN cũng phải vào sổ.
    // Trước bản này nhánh seller trả lời rồi `return` thẳng, không ghi dòng nào
    // vào `messages`: CTV mở hội thoại chủ nhà thấy trống trơn, không có gì để
    // bàn giao khi người thật tiếp quản. `conversations.seller_id` vốn đã có
    // sẵn kèm khoá ngoại — chỉ là chưa đường code nào ghi vào.
    // Hàm get-or-create ở migration 20260827i_hoi_thoai_nguoi_ban.sql, có
    // advisory lock như bên mua (chủ nhà gõ vụn 3 tin là 3 lượt gọi đồng thời).
    const { data: convS, error: convSErr } = await client
      .rpc("ensure_seller_conversation", {
        p_seller_id: sellerRow.id,
        p_channel: channel,
      }).single();
    const convSRow = convS as
      { c_id?: string; c_human_touch_at?: string | null } | null;
    const convSId = convSRow?.c_id ?? null;
    // Hàm thiếu / mất quyền / DB nghẽn mà đi tiếp thì bot vẫn trả lời trong khi
    // KHÔNG ghi được dòng nào: dedup 23505 tắt (Zalo gửi lại là bóc fact hai
    // lần, câu rao gửi lại là đẻ thêm một tin rao trùng), cổng nhường sân tắt, mà
    // HTTP vẫn 200 nên bot_health_tick không thấy gì. Nhánh mua ở đây trả 500 —
    // nhánh bán phải cùng ngữ nghĩa (FR-152).
    if (convSErr || !convSId) {
      const detail = convSErr?.message ?? "không trả về c_id";
      await ghiLoi(client, "chat-reply ensure_seller_conversation", detail);
      return await baoHong({ error: detail }, 500, detail);
    }

    // Ghi tin CHỦ NHÀ trước khi gọi model: model lỗi giữa chừng thì vẫn còn dấu
    // vết chủ nhà đã nhắn gì. Trùng `zalo_msg_id` (23505) = kênh gửi lại tin cũ
    // → đã trả lời rồi, đừng trả lời lần hai. Cùng ngữ nghĩa với nhánh mua.
    const { error: msgSErr } = await client.from("messages").insert({
      conversation_id: convSId,
      sender: "seller",
      body: imageUrl ? `${textOrTag} [ảnh: ${imageUrl}]` : text,
      zalo_msg_id: msgId,
    });
    if (msgSErr?.code === "23505" && !(coSo && soAttempts > 1)) {
      // Trùng từ THỜI TRƯỚC SỔ (sổ chưa có dòng nào cho msg_id này mà messages
      // đã có): lượt cũ đã trả lời rồi — dừng, và chốt sổ completed-rỗng để
      // các retry sau không quay lại đây nữa.
      return await hoanTat({ reply: null, replies: [], role: "seller", deduped: true });
    }
    if (msgSErr && msgSErr.code !== "23505") {
      // Mọi lỗi KHÁC 23505 (khoá ngoại, timeout, enum sai…) trước đây rơi im:
      // bot vẫn trả lời vào một hội thoại thiếu đúng dòng chủ nhà vừa nhắn.
      await ghiLoi(client, "chat-reply messages seller", msgSErr.message);
      return await baoHong({ error: msgSErr.message }, 500, msgSErr.message);
    }
    // 23505 khi soAttempts > 1: lượt trước của CHÍNH msg_id này chết giữa chừng
    // — tin chủ nhà đã nằm trong sổ messages rồi. Đi tiếp trả lời nốt, đừng
    // nuốt (đây đúng là ca "AI chưa kịp chạy / Zalo chưa kịp gửi thì hỏng").
    await client.from("conversations")
      .update({ last_message_at: new Date().toISOString() }).eq("id", convSId);

    // FR-141 — người thật gõ tay trong 30 phút gần đây thì bot im.
    // Cổng này trước chỉ có ở nhánh mua, nên CTV đang thương lượng với chủ nhà
    // mà chủ nhắn tiếp là bot nhảy vào nói chen giữa cuộc.
    // Trả về NGAY tại đây là bỏ luôn khúc bóc fact bên dưới: câu trả lời của
    // chủ nhà không vào `listing_facts`, `info_requests` nằm `pending` mãi, và
    // vòng drip hỏi lại đúng câu người ta vừa trả lời — CTV vào tay một cái là
    // dữ liệu căn đó đứng hình. Nên cổng chỉ khoá ĐƯỜNG RA (traLoiSeller) và
    // khoá lượt gọi model, không khoá đường ghi.
    const nguoiThatDangCham = convSRow?.c_human_touch_at;
    const humanActive = !!nguoiThatDangCham &&
      Date.now() - Date.parse(nguoiThatDangCham) < 30 * 60e3;

    // MỌI đường ra của nhánh này phải đi qua đây — trả lời của bot cũng là một
    // dòng trong sổ. Thêm `return jsonResponse(...)` trần ở nhánh seller là
    // thủng lại đúng chỗ vừa vá, và thủng im lặng.
    // FR-164: lời cảm ơn cho phần SỬA FACT, gắn vào bong bóng ĐẦU của bất kỳ
    // đường ra nào phía sau. Để ở đây (trước `traLoiSeller`) vì nhánh người bán
    // có sáu lối thoát khác nhau — chép câu cảm ơn ra từng lối là kiểu bỏ sót
    // đúng một chỗ rồi không ai thấy.
    let ackSua: string | null = null;
    const traLoiSeller = async (
      replies: string[],
      extra: Record<string, unknown> = {},
    ) => {
      if (humanActive) {
        // FR-141 — người thật đang cầm cuộc: không gửi, không ghi dòng bot nào.
        return await hoanTat({
          reply: null, replies: [], role: "seller", human_active: true, ...extra,
        });
      }
      const sach = [...(ackSua ? [ackSua] : []), ...replies]
        .map((r) => r.trim()).filter(Boolean);
      ackSua = null;
      for (const r of sach) {
        const { error: botErr } = await client.from("messages").insert({
          conversation_id: convSId, sender: "bot", body: r,
        });
        // Ghi hụt câu bot vừa nói = sổ một chiều (có trả lời, không có câu hỏi).
        // Không chặn đường trả lời chủ nhà, nhưng phải vào bot_errors (FR-152).
        if (botErr) await ghiLoi(client, "chat-reply messages bot(seller)", botErr.message);
      }
      return await hoanTat({
        reply: sach.join("\n") || null, replies: sach, role: "seller", ...extra,
      });
    };

    // NEO NGỮ CẢNH THEO CĂN, không theo "câu hỏi mới nhất" (FR-157).
    // Người bán 2-3 căn, cả hai đều đang thiếu thông tin: bot vừa hỏi căn B,
    // chủ nhớ ra chuyện căn A và nhắn "căn A hoàn công 2020 nha em" — lấy
    // `limit 1` theo created_at là ghi thẳng dữ liệu căn A vào căn B. Sai kiểu
    // này KHÔNG bao giờ tự lộ: fact vẫn có, tin vẫn lên web, chỉ là sai nhà.
    // Thứ tự tin cậy: mã tin chủ tự nhắc > căn bot vừa hỏi > câu mới nhất.
    // Một dãy mã duy nhất kể từ FR-158 — nhánh `CCRB-` cũ bỏ đi vì kho chưa bao
    // giờ có mã đó (kiểm 27/08/2026: 173 tin, 100% BDS-Q5-####).
    const codeInText =
      /(bds-q5-[a-z0-9]+)/.exec(tKD)?.[1]?.toUpperCase() ?? null;
    const { data: pendings } = await client
      .from("info_requests")
      .select("id, listing_id, question, created_at, listings!inner(seller_id, code, location_raw)")
      .eq("listings.seller_id", sellerRow.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);
    type PendRow = {
      id: string; listing_id: string; question: string;
      listings: { code: string | null; location_raw: string | null };
    };
    const ds = (pendings ?? []) as unknown as PendRow[];
    const pendingReq: PendRow | null =
      (codeInText ? ds.find((p) => p.listings?.code?.toUpperCase() === codeInText) : null) ??
      (sellerRow.active_listing_id
        ? ds.find((p) => p.listing_id === sellerRow.active_listing_id)
        : null) ??
      ds[0] ?? null;

    // Seller quay lại nhắn → hủy nhắc-lời-hứa đang chờ (FR-133)
    await client.from("reminders").update({ status: "cancelled" })
      .eq("seller_id", sellerRow.id).eq("kind", "promise").eq("status", "pending");
    // Seller hứa "chiều gửi ảnh…" → đặt hẹn nhắc
    if (khop(PROMISE_RE, PROMISE_RE_KD)) {
      await client.from("reminders").insert({
        kind: "promise", seller_id: sellerRow.id,
        due_at: mapDue(text), note: text.slice(0, 200),
      });
    }
    // ─── CỔNG CÂU RAO MỚI (dùng ở khối `wantsSell` bên dưới; tính SỚM vì bộ
    // bắt-lời-sửa FR-164 ngay sau đây phải biết "đây có phải câu rao mới không"
    // — câu rao cũng chứa "giá …", "phường …", nếu không hỏi cổng này trước thì
    // câu rao mới bị hiểu thành lời sửa tin cũ và không tin nào được tạo).
    //
    // \b cuối cụm chặn "cho thuê": "ê" ngoài ASCII nên sau nó không bao giờ là
    // biên từ → MỌI câu rao CHO THUÊ từng rơi âm thầm, không tạo tin.
    // FR-158 — cổng KHÔNG còn bắt buộc có giá/diện tích: câu rao trần trụi
    // ("anh muốn bán căn nhà") từng trượt vế thứ ba và bay mất, trong khi cả
    // điểm của vòng drip là hỏi cho ĐỦ những thứ còn thiếu. Nới thì phải có thứ
    // khác gánh dương-tính-giả — thứ đó là THỨ TỰ TỪ: "nhà mình bán chưa em?"
    // có đủ "bán" lẫn "nhà" nhưng không có cặp "bán nhà"/"muốn bán".
    // FR-161: tin gõ LẪN dấu là chuyện thường — "ban nha q5 giá 5 ty" có đúng
    // MỘT chữ có dấu. `coDauTin` bật khi câu chứa BẤT KỲ ký tự có dấu nào, nên
    // bản trước dồn cả câu vào bộ regex CÓ DẤU: "ban"/"nha" không khớp
    // "bán"/"nhà", `wantsSell` ra false và câu rao rơi IM LẶNG — đúng cái hỏng
    // FR-161 sinh ra để bịt, chỉ đổi sang một dạng khác.
    // Nay thử CẢ HAI bộ rồi lấy hợp. Bộ không dấu chạy trên `tKD` (đã bỏ dấu)
    // nên nó phủ luôn câu gõ đủ dấu; bộ có dấu giữ những cụm chỉ đúng khi có
    // dấu. Phép hợp chỉ NỚI THÊM, không bỏ mất khớp nào so với bản cũ.
    const coChiTiet = khop(
      /[\d][\d.,]*\s*(tỷ|tỉ|ty|tỏi|triệu|tr(?![a-zA-ZÀ-ỹ]))|\d+\s*m2|hẻm|mặt tiền|phường/i,
      /[\d][\d.,]*\s*(ty|ti|toi|trieu|tr(?![a-z]))|\d+\s*m2|\bhem\b|mat tien|phuong/,
    );
    const coYDinhRao =
      khop(
        /(muốn|cần|đang|nhờ|ký gửi)\s+(bán|cho thu[êe])/i,
        /(muon|can|dang|nho|ky gui)\s+(ban|cho thue)\b/,
      ) ||
      khop(
        /(bán|rao|cho thu[êe])\s+(nhà|căn hộ|chung cư|đất|mặt bằng|phòng trọ|biệt thự|căn)/i,
        /(ban|rao|cho thue)\s+(nha|can ho|chung cu|dat|mat bang|phong tro|biet thu|can)\b/,
      );
    // Chỉ chặn câu hỏi tình trạng khi câu KHÔNG kèm chi tiết thật nào.
    const laCauHoiTinhTrang = khop(
      /(chưa|sao r[oồ]i|th[eế] n[aà]o|ra sao|đư[ơợ]c không|đc ko|xong ch[uư]a)/i,
      /(chua|sao roi|the nao|ra sao|duoc khong|dc ko|xong chua)/,
    );
    const wantsSell =
      khop(/\b(bán|rao)\b|cho thu[êe]/i, /\b(ban|rao)\b|cho thue/) &&
      khop(
        /(nhà|căn hộ|chung cư|đất|mặt bằng|phòng trọ|biệt thự|căn\b)/i,
        /(nha|can ho|chung cu|dat|mat bang|phong tro|biet thu|\bcan\b)/,
      ) &&
      (coChiTiet || (coYDinhRao && !laCauHoiTinhTrang));

    // ─── FR-164: CHỦ NHÀ SỬA THÔNG TIN GIỮA CHỪNG.
    // "à giá 6.8 tỷ nha em", "nhà ở phường 12 chứ không phải 8" — trước bản này
    // KHÔNG có đường nào nhận: đang có câu hỏi chờ thì lời sửa bị ghi thành câu
    // TRẢ LỜI cho câu hỏi đó (sai chỗ), không có thì rơi xuống nhánh chăm sóc
    // chung rồi bay mất. Mà giá và phường là hai trong ba trường quyết định tin
    // có được lên kệ hay không.
    //
    // CHỈ bắt khi câu có NHÃN tường minh ("giá …", "phường …", "… phòng ngủ",
    // "diện tích …"). Câu trả lời cho drip thường KHÔNG lặp nhãn ("50m2", "sổ
    // hồng") nên hai đường không giẫm chân nhau; ai có lặp nhãn đúng lúc đang
    // được hỏi chính trường đó thì nhường hẳn cho đường drip bên dưới.
    // Ghi qua `ghi_fact_listing` — cửa fact duy nhất; chuẩn hoá, kiểm giá trị và
    // đo bậc ưu tiên đều nằm ở tầng DB, không chép luật lên đây.
    const suaFacts: Array<[string, string]> = [];
    // Vị trí các đoạn đã được nhận là "lời sửa". Bóc chúng ra khỏi câu thì phần
    // CÒN LẠI cho biết câu này có kèm câu trả lời cho câu hỏi đang treo không.
    const nhipSua: Array<[number, number]> = [];
    const batSua = (
      m: RegExpExecArray | null,
      key: string,
      lay: (m: RegExpExecArray) => string,
    ) => {
      if (!m) return;
      suaFacts.push([key, lay(m)]);
      nhipSua.push([m.index, m.index + m[0].length]);
    };
    if (!wantsSell) {
      const mGia =
        /gi[áa]\s*[^0-9]{0,12}?([\d][\d.,]*\s*(?:tỷ|tỉ|tỏi|triệu|ty|ti|toi|trieu|tr)(?![a-zA-ZÀ-ỹ])[^,.;\n]*)/i
          .exec(text);
      // Đuôi `[^,.;\n]*` giữ phần CÓ NGHĨA đi sau đơn vị ("6 tỷ 8", "5 tỷ
      // thương lượng"), nhưng cũng vơ luôn tiểu từ cuối câu ("6.8 tỷ nha em").
      // KHÔNG cắt ở đây: chuỗi này là bằng chứng thô, còn `price_raw` do
      // `chuan_hoa_gia_raw()` ở tầng DB gọt — một luật, một chỗ, và mọi cửa ghi
      // (form admin, câu trả lời drip) đều đi qua nó chứ không riêng cửa này.
      batSua(mGia, "gia", (m) => m[1].trim());
      batSua(/(?:phường|phuong)\s*\.?\s*(\d{1,2})\b/i.exec(text), "phuong",
        (m) => `Phường ${m[1]}`);
      batSua(/(\d{1,2})\s*(?:phòng ngủ|phong ngu|\bpn\b)/i.exec(text), "so_phong_ngu",
        (m) => m[1]);
      batSua(
        /(?:diện tích|dien tich|\bdt\b)\s*[^0-9]{0,8}?(\d{1,4}(?:[.,]\d+)?)\s*m2?/i.exec(text),
        "dien_tich", (m) => `${m[1]}m2`);
    }
    // Trường nào đang là câu hỏi chờ thì để đường drip xử — tránh vừa ghi lời
    // sửa vừa bỏ lửng câu hỏi đang treo.
    const suaThat = suaFacts.filter(([k]) =>
      !(pendingReq &&
        (k === pendingReq.question ||
          (k === "dien_tich" && /^dien_tich/.test(pendingReq.question)))));

    // Bóc các đoạn "lời sửa" ra, cắt từ PHẢI sang TRÁI để chỉ số không trượt.
    const conLai = nhipSua.length
      ? nhipSua.slice().sort((a, b) => b[0] - a[0])
        .reduce((s, [i, j]) => `${s.slice(0, i)} ${s.slice(j)}`, text)
        .replace(/\s+/g, " ").replace(/^[\s,.;:–-]+|[\s,.;:–-]+$/g, "").trim()
      : text;
    // Tiểu từ đứng trơ một mình KHÔNG phải câu trả lời: "à giá 6.8 tỷ nha em"
    // bóc xong còn "à em" — đó vẫn chỉ là lời sửa. Lọc sau `boDau` nên danh
    // sách chỉ cần bản không dấu.
    const conChu = boDau(conLai)
      .replace(
        /\b(a|u|o|da|vang|em|anh|chi|nha|nhe|nhen|ha|hen|ok|oke|roi|thi|ma|voi|va|do|luon)\b/gi,
        "",
      )
      .replace(/[^a-z0-9]+/gi, "");
    // Câu VỪA sửa một trường VỪA trả lời câu hỏi đang treo. Hai việc, không
    // được chọn một: đây chính là chỗ bản trước làm rơi câu trả lời drip.
    const vuaTraLoiVuaSua = !!pendingReq && conChu.length >= 2;

    if (suaThat.length) {
      // Neo đúng CĂN theo cùng thứ tự tin cậy của FR-157: mã chủ tự nhắc > căn
      // bot đang hỏi > căn của câu hỏi chờ > tin mới nhất của người này.
      let suaId: string | null = null;
      if (codeInText) {
        const { data: cl } = await client.from("listings").select("id")
          .eq("code", codeInText).eq("seller_id", sellerRow.id).maybeSingle();
        suaId = cl?.id ?? null;
      }
      suaId = suaId ?? sellerRow.active_listing_id ?? pendingReq?.listing_id ?? null;
      if (!suaId) {
        const { data: ml } = await client.from("listings").select("id")
          .eq("seller_id", sellerRow.id).order("created_at", { ascending: false })
          .limit(1).maybeSingle();
        suaId = ml?.id ?? null;
      }
      if (suaId) {
        const NHAN: Record<string, string> = {
          gia: "giá", phuong: "phường",
          so_phong_ngu: "số phòng ngủ", dien_tich: "diện tích",
        };
        const daGhi: string[] = [];
        for (const [k, v] of suaThat) {
          const { error: fErr } = await client.rpc("ghi_fact_listing", {
            p_listing_id: suaId, p_question: k, p_answer: v, p_source: "seller_chat",
          });
          if (fErr) await ghiLoi(client, `chat-reply ghi_fact_listing(${k})`, fErr.message);
          // Giá trị đã tự mang nhãn ("Phường 3") thì đừng dán nhãn lần nữa —
          // "phường Phường 3" đọc như máy hỏng.
          else {
            const nhan = NHAN[k] ?? k;
            daGhi.push(
              boDau(v).startsWith(boDau(nhan)) ? v : `${nhan} ${v}`,
            );
          }
        }
        if (daGhi.length) {
          const cau =
            `Dạ em cập nhật lại rồi ạ: ${daGhi.join(", ")}. Cảm ơn anh/chị đã báo em nha!`;
          if (!vuaTraLoiVuaSua) {
            return await traLoiSeller([cau], { sua_fact: suaThat.map(([k]) => k) });
          }
          // KHÔNG dừng ở đây. Trước bản này khối này `return` thẳng, nên câu
          // "sổ hồng rồi em, à giá 6.8 tỷ nha" (đang treo câu hỏi pháp lý) chỉ
          // ghi được GIÁ: câu trả lời pháp lý bay mất, `info_requests` kẹt
          // `pending`, và nhịp drip sau lại hỏi đúng cái chủ nhà vừa trả lời —
          // bot hỏi lại điều vừa được đáp là kiểu mất mặt FR-144 sinh ra để
          // tránh. Gắn lời cảm ơn vào đường ra chung rồi đi tiếp xuống khối
          // `pendingReq` để câu trả lời cũng vào sổ.
          ackSua = cau;
        }
      }
    }

    // Seller gửi ẢNH không kèm chữ → ghi nhận ảnh, TUYỆT ĐỐI không coi chuỗi
    // rỗng là "câu trả lời" cho câu hỏi đang chờ (từng làm mất fact pháp lý)
    if (!text && imageUrl) {
      if (pendingReq) {
        // FR-164: qua cửa fact chung như mọi bằng chứng khác.
        const { error: aErr } = await client.rpc("ghi_fact_listing", {
          p_listing_id: pendingReq.listing_id, p_question: "hinh_anh",
          p_answer: `[ảnh] ${imageUrl}`, p_source: "seller_chat",
        });
        if (aErr) await ghiLoi(client, "chat-reply ghi_fact_listing(anh)", aErr.message);
      }
      const thanks =
        "Dạ em nhận được ảnh rồi ạ, em bổ sung vào tin ngay. Cảm ơn anh/chị nhiều!";
      return await traLoiSeller([thanks]);
    }
    if (pendingReq) {
      // FR-164: KHÔNG còn ghi thẳng cột ở đây nữa.
      // Trước bản này khối này tự UPDATE `area_m2` rồi `property_type` trước khi
      // ghi fact — một nhà chức trách THỨ HAI ghi đúng những cột mà trigger fact
      // đang ghi, và nó lách được hai luật:
      //   * bậc ưu tiên: ghi đè bất kể cột đang do admin giữ, lại không đặt
      //     `property_type_source` nên giá trị mới đội lốt nhãn nguồn cũ;
      //   * luật tim-tường FR-163: `/^dien_tich/` khớp luôn `dien_tich_tim_tuong`
      //     nên diện tích tim tường vẫn đè area_m2 của nhà phố — đúng cái chỗ
      //     FR-163 vừa bịt ở tầng DB, thủng lại từ phía app.
      // Nay chỉ ghi FACT; `listing_facts_sync_cols` lo chuẩn hoá, kiểm giá trị,
      // đo bậc ưu tiên và đặt nhãn nguồn. Một luật, một chỗ.
      //
      // Riêng loai_bds vẫn hỏi hàm DB TRƯỚC, nhưng chỉ để quyết định có HỎI LẠI
      // không — không ghi cột. Dùng hàm DB (FR-150/FR-164) nên câu có phủ định
      // ("nhà phố chứ không phải chung cư") cũng đọc đúng.
      // Câu có kèm lời sửa thì phần ĐÃ BÓC mới là câu trả lời. Giữ nguyên cả
      // câu là nhét "giá 6.8 tỷ" vào fact pháp lý — bằng chứng sai chỗ còn tệ
      // hơn thiếu bằng chứng, vì nó trông như chủ nhà đã xác nhận.
      const dapAn = ackSua ? conLai : text;
      if (pendingReq.question === "loai_bds") {
        const { data: pt } = await client.rpc("guess_property_type_answer", { p_text: dapAn });
        if (!pt) {
          // Không đọc ra loại → HỎI LẠI, giữ nguyên câu hỏi pending. TUYỆT ĐỐI
          // không ghi fact `loai_bds`: ghi xong là listing_missing_facts hết
          // hỏi, tin nằm `chua_ro` vĩnh viễn — đúng kiểu chết lặng FR-150 diệt.
          const again =
            "Dạ em chưa rõ lắm ạ, nhà mình thuộc loại nào ta: nhà phố, nhà cấp 4, chung cư, đất, biệt thự, phòng trọ hay mặt bằng ạ?";
          return await traLoiSeller([again], { reask: "loai_bds" });
        }
      }

      const { error: factErr } = await client.rpc("ghi_fact_listing", {
        p_listing_id: pendingReq.listing_id,
        p_question: pendingReq.question,
        p_answer: dapAn,
        p_source: "seller_chat",
      });
      if (factErr) await ghiLoi(client, "chat-reply ghi_fact_listing(drip)", factErr.message);
      await client.from("info_requests").update({
        status: "answered", answer: dapAn, answered_at: new Date().toISOString(),
      }).eq("id", pendingReq.id);

      // Fact đã vào sổ — từ đây trở xuống là phần "nói". Người thật đang cầm
      // cuộc thì dừng: không gọi model, và KHÔNG mở câu hỏi pending mới (bot
      // có hỏi đâu mà chờ trả lời). Cron drip hỏi tiếp khi CTV buông tay.
      if (humanActive) {
        return await traLoiSeller([], { saved_fact: pendingReq.question });
      }

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

      // Câu hỏi drip PHẢI vắt vai mã căn + địa chỉ (FR-157). Người bán nhiều
      // căn mà nghe "hoàn công năm nào ạ?" trống không thì họ trả lời về căn
      // đang nghĩ trong đầu, không phải căn bot đang hỏi — neo phía DB xong mà
      // câu chữ không neo thì vẫn lệch, chỉ là lệch ở đầu bên kia.
      const neo = [
        lstNow?.code ? `#${lstNow.code}` : null,
        pendingReq.listings?.location_raw?.split(",")[0]?.trim() || null,
      ].filter(Boolean).join(" ở ");

      const prompt = next
        ? `Người bán vừa trả lời câu hỏi "${FACT_LABELS[pendingReq.question] ?? pendingReq.question}": "${text}". Soạn MỘT tin RẤT NGẮN (~30 từ): ghi nhận/khen tự nhiên câu trả lời (điểm mạnh thật của nhà nếu có), rồi hỏi tiếp ĐÚNG MỘT thông tin: ${FACT_LABELS[next.fact_key] ?? next.fact_key}. ${neo ? `BẮT BUỘC nhắc rõ đang hỏi về căn ${neo} ngay trong câu hỏi (người này rao nhiều căn, không nói rõ là họ trả lời nhầm căn khác).` : ""} Kèm lý do vì-khách nếu tự nhiên. Không hỏi gì khác.`
        : published
        ? `Người bán vừa trả lời: "${text}". Tin #${lstNow?.code ?? ""} giờ đã đủ thông tin và ĐÃ LÊN WEB nhadat.cc. Soạn MỘT tin NGẮN cảm ơn + báo tin đã đăng, có khách quan tâm là em báo liền. KHÔNG hỏi thêm thông tin nào nữa.`
        : `Người bán vừa trả lời câu hỏi cuối: "${text}". Soạn MỘT tin NGẮN cảm ơn, báo tin rao giờ đã đầy đủ thông tin, tụi em sẽ báo ngay khi có khách quan tâm. Kết thúc bằng một câu hỏi nhẹ xem anh chị còn muốn bổ sung gì không.`;
      // OPEN-30: model hỏng thì hỏi bằng câu mẫu tất định — vòng drip không
      // đứng lại chờ model sống. Câu mẫu CÓ hỏi thật (kèm neo căn) nên mở
      // info_request bên dưới vẫn đúng luật "không mở khi chưa hỏi được".
      let sellerReply: string | null = null;
      if (anthropicS) {
        try {
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
          sellerReply = r2.content.find((b) => b.type === "text")?.text?.trim() ?? null;
          await doTien(client, r2.usage);
        } catch (e) {
          await ghiLoi(client, "chat-reply model r2(seller)", e);
        }
      }
      if (!sellerReply) {
        sellerReply = next
          ? `Dạ em ghi nhận rồi ạ. Anh/chị cho em xin thêm ${FACT_LABELS[next.fact_key] ?? next.fact_key}${neo ? ` của căn ${neo}` : ""} nha?`
          : published
          ? `Dạ em cảm ơn anh/chị! Tin ${lstNow?.code ? `#${lstNow.code} ` : ""}đã đủ thông tin và lên web rồi ạ, có khách quan tâm là em báo liền.`
          : `Dạ em cảm ơn anh/chị, tin rao giờ đã đầy đủ thông tin. Có khách quan tâm là em báo anh/chị ngay ạ.`;
      }

      if (next && sellerReply) {
        await client.from("info_requests").insert({
          listing_id: pendingReq.listing_id, question: next.fact_key, status: "pending",
        });
      }
      return await traLoiSeller([sellerReply], {
        saved_fact: pendingReq.question,
      });
    }
    // FR-144: chính chủ nhắn CÂU RAO MỚI → tạo tin nháp cho_thong_tin ngay + mở
    // vòng hỏi nhỏ giọt, hỏi tới khi đủ-để-đăng (giá + diện tích + phường) thì
    // nghỉ; khách quan tâm hỏi thêm thì FR-140 mở lại vòng hỏi.
    // (Cổng `wantsSell` tính ở trên — FR-164 cần nó sớm để bộ bắt-lời-sửa không
    //  nuốt mất câu rao mới.)
    if (wantsSell) {
      // Loại BĐS KHÔNG hỏi: trigger trg_listings_fill_property_type đọc chính
      // câu rao (description) mà điền (FR-150). Chỉ tin nào câu chữ không đủ
      // để đoán mới nằm lại 'chua_ro' và bị hỏi ở vòng drip.
      // Cùng một mẫu với cổng wantsSell ở trên — lệch một chữ là câu rao lọt
      // cổng "cho thue" nhưng bị ghi thành tin BÁN.
      const sDeal = dealCol(/cho thue/.test(tKD) ? "thue" : "ban");
      // Phường bắt trên bản bỏ dấu — chỉ lấy CON SỐ nên bỏ dấu không mất gì
      const wardM = /phuong\s*\.?\s*(\d{1,2})/.exec(tKD);
      // "tr" viết tắt của triệu, nhưng \b sau "tr" khớp luôn "TRệt" (dấu tiếng
      // Việt không phải ký tự \w) — từng làm price_raw thành "1 trệt 2 lầu".
      // Lookahead chặn mọi chữ cái có dấu đứng sau.
      // price_raw cắt từ text GỐC (giữ nguyên chữ người gõ); tin không dấu thì
      // text gốc vốn đã ascii nên bản nào cũng là chữ của họ. parse_vnd phía DB
      // đã nuốt được "ty"/"trieu" (kiểm 27/08).
      // Hai bộ cùng chạy trên `text` GỐC (giữ nguyên chữ người gõ cho
      // `price_raw`), thử bộ có dấu trước rồi mới tới bộ không dấu. Chọn MỘT bộ
      // theo `coDauTin` như bản trước là hụt đơn vị gõ lẫn: "giá 5 ti" có dấu ở
      // "giá" nên đi bộ có dấu, mà bộ đó có "tỉ" chứ không có "ti" trần.
      const priceM =
        /([\d][\d.,]*\s*(?:tỷ|tỉ|ty|tỏi|triệu|tr(?![a-zA-ZÀ-ỹ]))[^,.;\n]*)/i.exec(text) ??
          /([\d][\d.,]*\s*(?:ty|ti|toi|trieu|tr(?![a-zA-Z]))[^,.;\n]*)/i.exec(text);
      // FR-158: mã do trigger `trg_listings_fill_code` cấp, nối tiếp đúng dãy
      // BDS-Q5-#### mà admin và web đang dùng. Đưa `code: null` xuống là cố ý —
      // bộ đúc mã `CCRB-<base36>` cũ ở đây là dãy thứ hai không ai cần, lại
      // không khoá gì nên hai chủ nhà rao cùng lúc là có cửa trùng mã.
      const { data: newLst, error: newLstErr } = await client.from("listings").insert({
        code: null, seller_id: sellerRow.id, deal: sDeal, district: "Quận 5",
        ward: wardM ? `Phường ${wardM[1]}` : null,
        description: text, price_raw: priceM?.[1]?.trim() ?? null,
        property_type: "chua_ro", status: "cho_thong_tin",
      }).select("id, code").single();
      // Tạo tin hỏng mà đi tiếp là NUỐT MẤT CÂU RAO: chủ nhà nhận một câu chăm
      // sóc chung chung ở nhánh dưới, tưởng đã rao xong, còn kho thì không có
      // gì. Vào sổ rồi mới đi tiếp (FR-152).
      if (newLstErr) {
        await ghiLoi(client, "chat-reply tao tin rao", newLstErr.message);
      }
      if (newLst) {
        // Tin nháp vẫn phải tạo (không được đánh rơi câu rao), nhưng người thật
        // đang cầm cuộc thì không hỏi, không nói.
        if (humanActive) {
          return await traLoiSeller([], { listing_code: newLst.code });
        }
        const { data: firstFacts } = await client.from("listing_missing_facts")
          .select("fact_key").eq("listing_id", newLst.id).order("priority").limit(1);
        const firstKey = firstFacts?.[0]?.fact_key ?? null;
        if (firstKey) {
          await client.from("info_requests").insert({
            listing_id: newLst.id, question: firstKey, status: "pending",
          });
        }
        // OPEN-30: tin rao ĐÃ tạo xong (mã đã cấp) — model chỉ soạn lời chào.
        // Model hỏng thì chào bằng câu mẫu, kèm luôn câu hỏi đầu nếu có.
        let raoReply: string | null = null;
        if (anthropicS) {
          try {
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
            raoReply = r1.content.find((b) => b.type === "text")?.text?.trim() ?? null;
            await doTien(client, r1.usage);
          } catch (e) {
            await ghiLoi(client, "chat-reply model r1(seller)", e);
          }
        }
        if (!raoReply) {
          raoReply = `Dạ em nhận tin rao rồi ạ, em tạo tin #${newLst.code}.` +
            (firstKey
              ? ` Anh/chị cho em xin thêm ${FACT_LABELS[firstKey] ?? firstKey} để em đăng cho đẹp nha?`
              : ` Em sẽ đăng lên web ngay ạ.`);
        }
        return await traLoiSeller([raoReply], { listing_code: newLst.code });
      }
    }
    // Seller nhắn nhưng KHÔNG có câu chờ → vẫn trả lời ĐÚNG VAI người bán
    // (trước đây rơi xuống luồng mua → bot hỏi "anh tìm khu nào" với chính chủ nhà)
    // Không có câu chờ mà người thật đang cầm cuộc → im, khỏi tốn lượt model.
    if (humanActive) return await traLoiSeller([]);

    const { data: sellerLst } = await client.from("listings")
      .select("code, location_raw, ward, price_raw")
      .eq("seller_id", sellerRow.id)
      .order("created_at", { ascending: false }).limit(5);
    const lstLines = (sellerLst ?? [])
      .map((l) => `#${l.code} · ${l.location_raw ?? ""} ${l.ward ?? ""} · ${l.price_raw ?? "?"}`)
      .join("\n");
    // OPEN-30: chăm sóc chung — model hỏng thì ghi nhận bằng câu mẫu.
    let sReply: string | null = null;
    if (anthropicS) {
      try {
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
        sReply = r3.content.find((b) => b.type === "text")?.text?.trim() ?? null;
        await doTien(client, r3.usage);
      } catch (e) {
        await ghiLoi(client, "chat-reply model r3(seller)", e);
      }
    }
    return await traLoiSeller([
      sReply ?? "Dạ em ghi nhận rồi ạ, em kiểm tra rồi báo lại anh/chị liền nha.",
    ]);
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
    const detail = bcErr?.message ?? "ensure_buyer_conversation";
    return await baoHong({ error: detail }, 500, detail);
  }
  const buyer = { id: bc.b_id as string, name: bc.b_name as string | null };
  const convId = bc.c_id as string;
  const prefs: Record<string, unknown> = (bc.b_prefs as Record<string, unknown>) ?? {};

  // Dedupe theo msg_id (retry không tạo tin đôi)
  const { data: insMsg, error: msgErr } = await client.from("messages").insert({
    conversation_id: convId, sender: "buyer",
    body: imageUrl ? `${textOrTag} [ảnh: ${imageUrl}]` : text,
    zalo_msg_id: msgId,
  }).select("id, seq").single();
  if (msgErr?.code === "23505" && !(coSo && soAttempts > 1)) {
    // Trùng từ THỜI TRƯỚC SỔ — lượt cũ đã trả lời rồi, đừng trả lời lần hai.
    // Chốt sổ completed-rỗng để retry sau không quay lại đây.
    return await hoanTat({ reply: null, replies: [], deduped: true });
  }
  if (msgErr && msgErr.code !== "23505") {
    return await baoHong({ error: msgErr.message }, 500, msgErr.message);
  }
  // 23505 khi soAttempts > 1: lượt trước của chính msg_id này chết giữa chừng,
  // tin khách ĐÃ nằm trong messages — lấy lại seq dòng cũ (check nhường-lượt
  // FR-131 bên dưới cần nó) rồi đi tiếp trả lời nốt, đừng nuốt.
  let insMsgSeq = insMsg?.seq ?? null;
  if (insMsgSeq == null && msgId) {
    const { data: cu } = await client.from("messages").select("seq")
      .eq("zalo_msg_id", msgId).maybeSingle();
    insMsgSeq = cu?.seq ?? null;
  }
  await client.from("conversations")
    .update({ last_message_at: new Date().toISOString() }).eq("id", convId);

  // FR-141: người thật nhắn tay trong 30 phút gần đây → bot im, chỉ ghi log
  // tin khách; người thật ngừng đủ lâu thì bot tự tiếp chuyện lại.
  const { data: convRow } = await client.from("conversations")
    .select("ctv_id, human_touch_at").eq("id", convId).maybeSingle();
  if (convRow?.human_touch_at &&
      Date.now() - Date.parse(convRow.human_touch_at as string) < 30 * 60e3) {
    return await hoanTat({ reply: null, replies: [], human_active: true });
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
      return await hoanTat({ reply: null, replies: [], rate_limited: true });
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
    return await hoanTat({ reply: capMsg, replies: [capMsg], rate_limited: true });
  }

  // FR-131: KHÔNG delay nhân tạo (quyết định chủ dự án 25/08 — "càng nhanh càng
  // tốt"). Chỉ giữ check nhường-lượt: tin mới hơn của cùng khách đã vào trong
  // lúc xử lý thì lượt này im, lượt của tin cuối trả lời trên ngữ cảnh gộp.
  // "Tin mới nhất" xếp theo `seq` (identity DB cấp, không bao giờ hoà) chứ
  // không theo `created_at` — hai tin cùng mili-giây là created_at bốc thăm.
  // Lượt này vẫn xử lý ĐÚNG tin của nó (insMsgSeq), không lấy "tin mới nhất"
  // làm danh tính; câu này chỉ quyết định NHƯỜNG hay không.
  const { data: newest } = await client
    .from("messages").select("seq")
    .eq("conversation_id", convId).eq("sender", "buyer")
    .order("seq", { ascending: false }).limit(1).maybeSingle();
  if (newest && insMsgSeq != null && (newest.seq as number) > insMsgSeq) {
    // Completed-rỗng là ĐÚNG cả với sổ: tin này được lượt của tin cuối trả lời
    // trên ngữ cảnh gộp — phát lại rỗng, không phát lại đôi.
    return await hoanTat({ reply: null, replies: [], superseded: true });
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
      .eq("conversation_id", convId).order("seq", { ascending: false }).limit(12),
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
  // Dự án nhà mình đứng RIÊNG khỏi khối kho: nó giống hệt nhau cho mọi khách và
  // gần như không đổi, nên chỗ của nó là trong phần được nhớ tạm (rẻ 1/10), chứ
  // không phải nằm chung với khối kho biến động theo từng hồ sơ. Riêng thông số
  // + mẫu căn đã là 1.350 ký tự, gửi đủ giá mỗi lượt cho cả khách chưa hỏi tới
  // dự án là phí. Xem bot/README §01/09.
  const duanNhaMinh = partner ? projLine(partner, true) : "";
  // Dự án khách vừa nhắc tên thì mới nạp — biến động, phải nằm sau điểm nhớ tạm.
  const duanBlock = matched.map((m) => projLine(m, true)).join("\n");

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
      // Tách 2 khối theo GIÁ, không theo chủ đề: mọi thứ giống hệt nhau cho mọi
      // khách nằm trước điểm nhớ tạm (đọc lại chỉ tốn 1/10 giá); mọi thứ đổi
      // theo hồ sơ từng khách nằm sau (phải trả đủ giá dù có cache hay không).
      //
      // TTL 1 GIỜ, KHÔNG PHẢI 5 PHÚT MẶC ĐỊNH — và đây là lựa chọn theo LƯU
      // LƯỢNG, phải xem lại khi lưu lượng đổi. Khối tĩnh ~5.800 token. Nạp lại
      // tốn 1,25 lần giá gốc ở nhịp 5 phút, 2 lần ở nhịp 1 giờ; đọc lại tốn
      // 1/10. Đồng hồ đếm từ lúc BẮT ĐẦU mỗi lượt và mỗi lần đọc lại đặt lại
      // đồng hồ, nên cái quyết định là KHOẢNG CÁCH giữa hai lượt bất kỳ dùng
      // chung khối này — của mọi khách cộng lại, không phải của riêng một khách.
      //
      //   cách nhau < 5 phút  → để 5 phút: lượt nào cũng làm nóng lại, rẻ nhất
      //   cách nhau 5–60 phút → để 1 giờ: đây là khoảng DUY NHẤT bù nổi giá nạp
      //   cách nhau > 1 giờ   → cả hai đều không cứu; chịu lượt nguội
      //
      // Hôm nay khách thưa, khoảng cách rơi vào 5–60 phút. Ở nhịp đó để 5 phút
      // thì lượt nào cũng trượt, mà một lượt trượt (1,25) còn ĐẮT HƠN không
      // dùng nhớ tạm (1,0) — mất tiền để không được gì.
      //
      // ĐỔI NGƯỢC LẠI VỀ 5 PHÚT khi vượt ~12 lượt trả lời/giờ (cỡ 10 khách/ngày
      // trong giờ làm). Lúc đó lưu lượng tự giữ nóng và giá nạp gấp đôi thành
      // lỗ thuần. Đọc số thật ở cache_read_input_tokens trong usage.
      system: [{
        type: "text",
        text: TONE + "\n\n" + HUMAN + "\n\n" + FEES + "\n\n" + SLANG + "\n\n" + AGREE + "\n\n" + FEWSHOT +
          "\n\nBất biến: tối đa 3 listing một tin; không khẳng định còn/hết hay pháp lý khi chưa xác minh — nói 'để em hỏi lại chủ nhà'; tin chủ động kết thúc bằng MỘT câu hỏi. Chỉ dùng listing trong KHO ở khối sau, không bịa." +
          (duanNhaMinh
            ? "\n\nDỰ ÁN NHÀ MÌNH ĐANG PHÂN PHỐI TRỰC TIẾP (kiến thức chung ĐÃ XÁC THỰC — trả lời TRỰC TIẾP câu hỏi tầng dự án: vị trí, chủ đầu tư, pháp lý dự án, tiện ích, mẫu nhà, quy cách bàn giao — KHÔNG cần 'hỏi lại chủ nhà'. GIÁ từng căn KHÔNG có ở đây: khách hỏi giá thì nói 'để em kiểm tra giá lô đó rồi báo anh/chị liền'. Khách hợp nhu cầu (nhà phố xây mới, khu biệt lập an ninh, ~43-92m2, quanh Q5/Q6/Q8) thì chủ động giới thiệu MỘT lần như một lựa chọn; khách không quan tâm thì thôi, đừng lặp lại):\n" +
              duanNhaMinh
            : ""),
        cache_control: { type: "ephemeral", ttl: "1h" },
      }, {
        type: "text",
        text: "KHO HIỆN CÓ:\n" +
          (kho || "(trống)") +
          (askedBlock
            ? "\n\nCĂN KHÁCH ĐANG NHẮC TỚI (khách vào từ web hoặc gõ mã — chào ĐÚNG căn này, trả lời thẳng vào nó; mục 'đã xác minh từ chủ nhà' được nói chắc, còn lại vẫn 'để em hỏi lại'):\n" +
              askedBlock
            : "") +
          (duanBlock
            ? "\n\nDỰ ÁN KHÁCH VỪA NHẮC TỚI (kiến thức chung ĐÃ XÁC THỰC — dùng trả lời TRỰC TIẾP câu hỏi tầng dự án: vị trí, chủ đầu tư, pháp lý dự án, tiện ích, mẫu nhà, quy cách bàn giao — KHÔNG cần 'hỏi lại chủ nhà'. GIÁ từng căn KHÔNG có ở đây: khách hỏi giá thì nói 'để em kiểm tra giá lô đó rồi báo anh/chị liền'):\n" +
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
    // Đo SAU khi đã cầm chắc câu trả lời trong tay: lượt buyer là lượt đắt nhất
    // (khối tĩnh ~5.800 chữ-máy), nên đây là con số quan trọng nhất của đồng hồ.
    await doTien(client, resp.usage);
  } catch (e) {
    // Chỗ này nguy hơn vẻ ngoài: model hỏng thì khối dưới vẫn dựng câu trả lời
    // bằng regex và trả 200 tử tế. Khách không thấy gì lạ, mã HTTP không thấy
    // gì lạ, nên bot_health_tick cũng mù. Phải tự ghi sổ (FR-152).
    await ghiLoi(client, "chat-reply model", e);
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
    // FR-163: trộn bằng `||` phía DB (merge_buyer_prefs) thay vì ghi đè cả
    // object {...prefs, ...delta} — bản ghi-đè là đọc-trộn-ghi kinh điển: hai
    // lượt gối nhau là lượt sau chôn mất delta lượt trước bằng prefs cũ.
    const { error: prefErr } = await client
      .rpc("merge_buyer_prefs", { p_buyer_id: buyer.id, p_delta: delta });
    if (prefErr) await ghiLoi(client, "chat-reply merge_buyer_prefs", prefErr.message);
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
  // "hinh" không dấu thêm vào (FR-161); "anh" trần thì KHÔNG — đó là đại từ,
  // thêm vào là mọi câu có chữ "anh" đều bị coi là xin ảnh.
  const photoWanted = out.send_photos ??
    (/hình|ảnh|\bhinh\b|hinh anh|photo|\bpic\b/i.test(text) ? (mentioned[0] ?? repliedCode ?? null) : null);
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

  return await hoanTat({ reply: replies.join("\n"), replies, photos, conversation_id: convId });
});
