// nudge — FR-133: hai loại "cú hích" chạy theo cron nudge-tick (30 phút):
// 1. promise: người ta hứa "chiều gửi ảnh/thông tin" → tới hẹn nhắc khéo MỘT tin.
// 2. reengage: buyer im lặng 5-6 ngày → hỏi thăm ngắn, kịch bản đa dạng (góc
//    ngẫu nhiên + tránh lặp 2 tin bot gần nhất), trước mốc Zalo xoá 7 ngày (INS-03).
// POST {} (cron) | { dry_run?: bool } — trả về tóm tắt việc đã làm.
import {
  anthropicClient,
  escalationText,
  jsonResponse,
  MODEL,
  secretOf,
  sendZalo,
  serviceClient,
  zaloToken,
} from "../_shared/claude.ts";
import { TONE_RULES } from "../_shared/prompts.ts";

// Kịch bản đa dạng cho reengage — chọn ngẫu nhiên, đổi góc mỗi lần
const ANGLES = [
  "hỏi thăm tiến độ tìm nhà, nhẹ nhàng, không thúc ép",
  "hỏi xem tiêu chí có gì thay đổi không (giá/khu vực/loại nhà)",
  "nhắc khéo giữ kết nối Zalo (nhắn lại một tin kẻo Zalo tự ngắt), kèm cam kết vẫn đang tìm giúp",
  "kể MỘT quan sát thị trường ngắn gọn thật thà (ví dụ khu người ta hay hỏi gần đây) rồi hỏi còn quan tâm không",
];

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const { dry_run = false, force = false } = await req.json().catch(() => ({}));
  // Giờ giấc con người (docs/06 §6.8): chỉ chủ động nhắn trong 8h-21h giờ VN;
  // ngoài cửa sổ thì để nhịp cron sau xử — reminder vẫn pending, không mất.
  const vnHour = (new Date(Date.now() + 7 * 3600e3)).getUTCHours();
  if (!force && (vnHour < 8 || vnHour >= 21)) {
    return jsonResponse({ done: 0, skipped: "quiet_hours", vn_hour: vnHour });
  }
  // Lệch phút ngẫu nhiên — đừng gửi đúng boong :00/:30 như máy
  if (!dry_run) await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 45000)));
  const client = serviceClient();
  const anthropic = await anthropicClient(client);
  // FR-158: token SỐNG (bot_tokens), không phải chuỗi chết trong Vault.
  const oaToken = await zaloToken(client);
  // FR-138: tone cấu hình được từ bảng bot_prompts (sửa ở dashboard, khỏi deploy)
  const { data: toneRow } = await client.from("bot_prompts")
    .select("content").eq("key", "tone_rules").maybeSingle();
  const TONE = toneRow?.content ?? TONE_RULES;
  const out: Record<string, unknown>[] = [];

  // ---- 0. Escalation (FR-140): khách hỏi căn không có chính chủ → báo CTV/admin.
  // Tin nội bộ, không cần model. Gửi OA được thì đánh sent; không có kênh thì
  // GIỮ pending — bridge acc clone sẽ kéo qua escalation-feed và tự ack.
  // FR-147: "cần người thật" quá 30 phút mà chưa ai gõ tay (human_touch_at cũ
  // hơn needs_human_at) → leo tiếp lên admin, đánh dấu human_escalated_at để
  // khỏi báo lặp. Người thật vào chat là chat-reply tự hạ cờ + huỷ nhắc.
  const { data: stuck } = await client.from("conversations")
    .select("id, buyer_id, needs_human_at, human_touch_at, human_escalated_at, buyers(name)")
    .eq("needs_human", true)
    .lte("needs_human_at", new Date(Date.now() - 30 * 60e3).toISOString())
    .is("human_escalated_at", null)
    .limit(10);
  for (const c of stuck ?? []) {
    if (c.human_touch_at && Date.parse(c.human_touch_at as string) >= Date.parse(c.needs_human_at as string)) continue;
    const who = (c.buyers as { name?: string | null } | null)?.name;
    if (!dry_run) {
      await client.from("reminders").insert({
        kind: "escalation", buyer_id: c.buyer_id, ctv_id: null,
        due_at: new Date().toISOString(),
        note: `⚠️ khách${who ? ` ${who}` : ""} cần người thật đã 30 phút mà CTV chưa vào. Anh/chị xử giúp`,
      });
      await client.from("conversations")
        .update({ human_escalated_at: new Date().toISOString() }).eq("id", c.id);
    }
    out.push({ kind: "escalate_admin", conversation: c.id });
  }

  const { data: escDue } = await client
    .from("reminders")
    .select("id, kind, note, ctv_id, seller_id, ctvs(name, zalo_user_id), sellers(name, zalo_user_id)")
    .eq("status", "pending").in("kind", ["escalation", "report"])
    .lte("due_at", new Date().toISOString())
    .limit(10);
  for (const r of escDue ?? []) {
    const ctv = r.ctvs as { name?: string | null; zalo_user_id?: string | null } | null;
    const seller = r.sellers as { name?: string | null; zalo_user_id?: string | null } | null;
    let target = seller?.zalo_user_id ?? ctv?.zalo_user_id ?? null;
    if (!target) {
      const { data: adm } = await client.from("admins")
        .select("zalo_user_id").not("zalo_user_id", "is", null).limit(1).maybeSingle();
      target = adm?.zalo_user_id ?? (await secretOf(client, "ZALO_ADMIN_ZALO_ID"));
    }
    const text = escalationText(r);
    let sent = "none";
    if (!dry_run && target && oaToken && !target.startsWith("TEST")) {
      sent = (await sendZalo(oaToken, target, text)) ? "zalo_oa" : "zalo_error";
      if (sent === "zalo_oa") {
        await client.from("reminders")
          .update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", r.id);
      }
    }
    out.push({ kind: r.kind, id: r.id, text, sent });
  }

  // ---- 1. Reminder tới hạn: lời hứa / nhắc lịch xem / follow-up căn (FR-32) ----
  const { data: due } = await client
    .from("reminders")
    .select("id, kind, note, buyer_id, seller_id, listing_id, buyers(name, zalo_user_id), sellers(name, zalo_user_id)")
    .eq("status", "pending").in("kind", ["promise", "viewing", "followup"])
    .lte("due_at", new Date().toISOString())
    .limit(5);

  for (const r of due ?? []) {
    const who = (r.buyers ?? r.sellers) as { name?: string | null; zalo_user_id?: string | null } | null;
    const zid = who?.zalo_user_id ?? null;
    const laTest = !!zid && zid.startsWith("TEST");

    // FR-163 — KHÔNG CÓ KÊNH THÌ KHÔNG ĐƯỢC GHI LÀ ĐÃ GỬI.
    //
    // Bản cũ để `sent` nguyên giá trị "none" khi người này không có Zalo ID,
    // rồi rơi thẳng xuống hai dòng cuối: ghi một dòng `messages` sender='bot'
    // và đóng reminder thành `sent`. Không tin nào từng rời khỏi máy chủ.
    // Ba thứ hỏng cùng lúc, và không thứ nào tự lộ:
    //   · sổ hội thoại có tin bot chưa hề tồn tại — CTV mở ra đọc, tưởng khách
    //     đã được nhắc rồi, nên không nhắc nữa;
    //   · lời nhắc đóng vĩnh viễn, không nhịp cron nào cứu;
    //   · vẫn tốn một lượt model để soạn câu không ai đọc.
    // Chặn TRƯỚC khi gọi model — vừa hết tin ảo vừa hết đốt tiền.
    if (!dry_run && !zid) {
      // Không có Zalo ID là hỏng CƠ CẤU, không phải trục trặc nhất thời: giữ
      // pending thì nhịp sau lại kéo đúng mấy dòng này lên, mà truy vấn có
      // `.limit(5)` — chúng chiếm chỗ vĩnh viễn của những lời nhắc gửi được.
      await client.from("reminders").update({ status: "cancelled" }).eq("id", r.id);
      out.push({ kind: r.kind, id: r.id, sent: "none", bo_qua: "người này chưa có Zalo ID" });
      continue;
    }
    if (!dry_run && !oaToken && !laTest) {
      // Chưa cấu hình OA là trục trặc TẠM: giữ pending cho nhịp sau, và cũng
      // không gọi model (soạn xong cũng không gửi được).
      out.push({ kind: r.kind, id: r.id, sent: "none", giu_pending: "chưa có token OA" });
      continue;
    }
    // Chưa biết tên thì gọi "anh/chị" — cấm model bịa tên (nó hay mượn tên trong ví dụ tone)
    const whoLabel = who?.name
      ? `Anh/chị ${who.name}`
      : "Khách (CHƯA biết tên — xưng hô 'anh/chị' chung, TUYỆT ĐỐI không bịa tên)";
    // FR-32: nạp chi tiết căn để "gửi thêm thông tin" có nội dung thật, không bịa
    let canInfo = "";
    if (r.kind === "followup" && r.listing_id) {
      const { data: l } = await client.from("listings")
        .select("code, ward, location_raw, price_raw, area_m2, bedrooms, listing_facts(question, answer)")
        .eq("id", r.listing_id).maybeSingle();
      if (l) {
        const facts = ((l.listing_facts ?? []) as Array<{ question: string; answer: string }>)
          .map((f) => `${f.question}: ${f.answer}`).join("; ");
        canInfo = `#${l.code} · ${l.location_raw ?? ""} ${l.ward ?? ""} · ${l.price_raw ?? ""} · ${l.area_m2 ?? "?"}m2${l.bedrooms ? ` · ${l.bedrooms}PN` : ""}${facts ? ` · đã xác minh từ chủ nhà: ${facts}` : ""}`;
      }
    }
    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 256,
      output_config: { effort: "low" },
      system: [{ type: "text", text: TONE, cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: r.kind === "viewing"
          ? `${whoLabel} có ${r.note} (sắp tới giờ). Soạn MỘT tin Zalo RẤT NGẮN nhắc lịch theo mẫu §6.8: "Em là Thái, có hẹn xem nhà với anh/chị lúc … Hẹn gặp anh/chị nha." Thân thiện, không markdown.`
          : r.kind === "followup"
          ? `${whoLabel} hỏi về căn này rồi im ~2-3 tiếng: ${canInfo || r.note}. ` +
            `Soạn MỘT tin Zalo NGẮN (1-2 câu) CHỦ ĐỘNG kể thêm MỘT chi tiết đáng giá về đúng căn đó (chỉ từ dữ liệu trên, không bịa; chưa xác minh thì không khẳng định). Không thúc ép, kết bằng câu hỏi nhẹ hoặc một câu khẳng định rồi chờ.`
          : `${whoLabel} có hứa: "${r.note}". Giờ đã tới hẹn. ` +
            `Soạn MỘT tin Zalo RẤT NGẮN (~20 từ) nhắc khéo — thân thiện, KHÔNG trách móc, cho đường lùi ("khi nào tiện anh/chị gửi em nha").`,
      }],
    });
    const text = resp.content.find((b) => b.type === "text")?.text?.trim();
    if (!text) continue;

    let sent = "none";
    if (!dry_run) {
      if (laTest) sent = "test"; // luồng kiểm thử: không bắn thật, vẫn đóng sổ
      else if (zid && oaToken) {
        sent = (await sendZalo(oaToken, zid, text)) ? "zalo_oa" : "zalo_error";
      }
      // Chỉ ghi sổ + đóng reminder khi tin THẬT SỰ đã rời khỏi đây. Mọi kết cục
      // khác đều giữ pending cho nhịp cron sau — đừng nuốt mất lời nhắc, và
      // tuyệt đối đừng ghi một dòng bot chưa từng gửi.
      if (sent !== "zalo_oa" && sent !== "test") {
        out.push({ kind: r.kind, id: r.id, text, sent, retry: true });
        continue;
      }
      if (r.buyer_id) {
        const { data: conv } = await client.from("conversations").select("id")
          .eq("buyer_id", r.buyer_id).order("started_at", { ascending: false }).limit(1).maybeSingle();
        if (conv) await client.from("messages").insert({ conversation_id: conv.id, sender: "bot", body: text });
      }
      await client.from("reminders")
        .update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", r.id);
    }
    out.push({ kind: r.kind, id: r.id, text, sent });
  }

  // ---- 2. Buyer im lặng 5-6 ngày ----
  const now = Date.now();
  const { data: quiet } = await client
    .from("buyers")
    .select("id, name, zalo_user_id, preferences, last_contact_at")
    .gte("last_contact_at", new Date(now - 7 * 864e5).toISOString())
    .lte("last_contact_at", new Date(now - 5 * 864e5).toISOString())
    .limit(20);

  let reengaged = 0;
  for (const b of quiet ?? []) {
    if (reengaged >= 5) break;
    // FR-163: cùng lý do với nhánh reminder ở trên — không có kênh tới người
    // này thì đừng gọi model, đừng ghi tin ảo vào sổ, và đừng ghi một dòng
    // `reengage` status='sent' cho một tin chưa bao giờ được gửi. Dòng ảo đó
    // còn tự bịt miệng mình 5 ngày, vì chính nó là thứ bộ đếm chống-spam ngay
    // bên dưới đi tìm.
    const bTest = !!b.zalo_user_id && b.zalo_user_id.startsWith("TEST");
    if (!dry_run && !(b.zalo_user_id && oaToken) && !bTest) continue;
    // chống spam: đã hỏi thăm trong 5 ngày qua thì thôi
    const { count } = await client.from("reminders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", b.id).eq("kind", "reengage")
      .gte("created_at", new Date(now - 5 * 864e5).toISOString());
    if ((count ?? 0) > 0) continue;

    const { data: conv } = await client.from("conversations").select("id")
      .eq("buyer_id", b.id).order("started_at", { ascending: false }).limit(1).maybeSingle();
    let lastBot: string[] = [];
    if (conv) {
      const { data: msgs } = await client.from("messages").select("body")
        .eq("conversation_id", conv.id).eq("sender", "bot")
        .order("created_at", { ascending: false }).limit(2);
      lastBot = (msgs ?? []).map((m) => m.body);
    }
    const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)];

    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 256,
      output_config: { effort: "low" },
      system: [{ type: "text", text: TONE, cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content:
          `Khách${b.name ? ` tên ${b.name}` : ""} là NGƯỜI MUA đang TÌM nhà (họ KHÔNG bán — đừng nhầm vai). Hồ sơ nhu cầu tìm mua: ${JSON.stringify(b.preferences ?? {})}. Im lặng ~5-6 ngày.\n` +
          `Hai tin gần nhất em đã gửi (TRÁNH lặp giọng/mẫu): ${JSON.stringify(lastBot)}.\n` +
          `Soạn MỘT tin Zalo NGẮN (1-2 câu) theo góc: ${angle}. Nhắc đúng nhu cầu cũ nếu có. Kết thúc bằng một câu hỏi nhẹ.`,
      }],
    });
    const text = resp.content.find((bk) => bk.type === "text")?.text?.trim();
    if (!text) continue;

    let sent = "none";
    if (!dry_run) {
      if (bTest) sent = "test";
      else if (b.zalo_user_id && oaToken) {
        sent = (await sendZalo(oaToken, b.zalo_user_id, text)) ? "zalo_oa" : "zalo_error";
      }
      if (sent !== "zalo_oa" && sent !== "test") {
        // Gửi hụt → không ghi vết "đã hỏi thăm", nhịp sau thử lại người này
        reengaged++;
        out.push({ kind: "reengage", buyer: b.id, angle, text, sent, retry: true });
        continue;
      }
      if (conv) await client.from("messages").insert({ conversation_id: conv.id, sender: "bot", body: text });
      await client.from("reminders").insert({
        kind: "reengage", buyer_id: b.id, due_at: new Date().toISOString(),
        note: angle, status: "sent", sent_at: new Date().toISOString(),
      });
    }
    reengaged++;
    out.push({ kind: "reengage", buyer: b.id, angle, text, sent });
  }

  return jsonResponse({ done: out.length, dry_run, results: out });
});
