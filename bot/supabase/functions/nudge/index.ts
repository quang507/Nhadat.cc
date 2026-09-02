// nudge — FR-133: hai loại "cú hích" chạy theo cron nudge-tick (30 phút):
// 1. promise: người ta hứa "chiều gửi ảnh/thông tin" → tới hẹn nhắc khéo MỘT tin.
// 2. reengage: buyer im lặng 5-6 ngày → hỏi thăm ngắn, kịch bản đa dạng (góc
//    ngẫu nhiên + tránh lặp 2 tin bot gần nhất), trước mốc Zalo xoá 7 ngày (INS-03).
// POST {} (cron) | { dry_run?: bool } — trả về tóm tắt việc đã làm.
import {
  anthropicClient,
  doTien,
  escalationText,
  ghiLoi,
  jsonResponse,
  MODEL,
  secretOf,
  sendZalo,
  serviceClient,
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

  // ── CỔNG (soát bảo mật 29/08/2026) ───────────────────────────────────────
  // Hàm này chạy verify_jwt=false và TRƯỚC bản này KHÔNG kiểm gì hết. Đo thật:
  // POST tay, KHÔNG kèm một cái khoá nào, trả về 200 kèm nguyên danh sách lời
  // nhắc đang chờ (có cả text leo thang nội bộ). Với `dry_run` mặc định là
  // FALSE, người lạ gọi phát nữa là bot NHẮN THẬT cho khách, đốt tiền model và
  // lật trạng thái `reminders`. Cùng cái cổng mà chat-reply / media-cleanup /
  // inbound-sweep đã dùng — cron mang `x-bridge-secret` (xem `nudge_tick`).
  const cong = serviceClient();
  const bimat = await secretOf(cong, "BRIDGE_SECRET");
  // Cổng fail-open là chủ ý (gắn cổng trước khi có bí mật thì cron không gãy),
  // nhưng KHÔNG được im: một lần đọc hụt Vault là hàm này thành công khai mà
  // chẳng ai hay. Ghi sổ để /admin thấy — im lặng mới là cái nguy.
  if (!bimat) {
    await ghiLoi(cong, "nudge CONG MO",
      "Không đọc được BRIDGE_SECRET (env lẫn Vault) — cổng đang MỞ, ai cũng gọi được.");
  }
  const laDichVu = req.headers.get("authorization") ===
    `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (bimat && !laDichVu && req.headers.get("x-bridge-secret") !== bimat) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  // FR-166: dấu tay của lượt chạy này, ghi vào `reminders.locked_by` để nhìn
  // ra ai đang giữ việc khi có hai worker chạy chồng nhau.
  const workerId = `nudge-${crypto.randomUUID().slice(0, 8)}`;
  const { dry_run = false, force = false } = await req.json().catch(() => ({}));
  // Giờ giấc con người (docs/06 §6.8): chỉ chủ động nhắn trong 8h-21h giờ VN;
  // ngoài cửa sổ thì để nhịp cron sau xử — reminder vẫn pending, không mất.
  const vnHour = (new Date(Date.now() + 7 * 3600e3)).getUTCHours();
  if (!force && (vnHour < 8 || vnHour >= 21)) {
    return jsonResponse({ done: 0, skipped: "quiet_hours", vn_hour: vnHour });
  }
  // Lệch phút để không gửi đúng boong :00/:30 như máy — nay nằm ở LỊCH CRON
  // (`7,37 1-13 * * *`, migration 20260902c), không ngủ trong lambda nữa: đoạn
  // ngủ ngẫu nhiên tới 45 s cộng vài lượt model là vượt trần 55 s của
  // `nudge_tick`, pg_net ghi timeout và `bot_health_tick` ghi lỗi giả (FR-171 d).
  const client = serviceClient();
  // FR-166: MỌI đường báo hỏng đi qua đây. `bao_hong_nhac` đẩy `next_retry_at`
  // và lật sang `dead` khi quá 5 lượt — tức nó GHI ĐÈ lời nhắc THẬT. Trước bản
  // này ba chỗ gọi thẳng nó nằm ngoài mọi guard `!dry_run`, nên một lượt chạy
  // thử với key model hỏng (`!anthropic`) quét đúng 5 dòng pending có thật rồi
  // đẩy hết sang thư chết — lượt "chỉ xem, không đụng" mà xoá được lời hứa với
  // khách. `dry_run` đã cố ý KHÔNG giành việc (không tăng `attempts`) ở hai chỗ
  // claim bên dưới; cổng này giữ nốt nửa còn lại của cùng lời hứa đó.
  const baoHongNhac = async (id: string, detail: string) => {
    if (dry_run) return;
    await client.rpc("bao_hong_nhac", { p_id: id, p_detail: detail });
  };
  // FR-166: khối leo thang KHÔNG cần model. Để `anthropicClient` ném thẳng ra
  // ngoài là một cái key hỏng kéo sập cả lượt chạy, kể cả phần chẳng liên quan
  // tới AI. Cùng lưới đã dựng cho chat-reply ở OPEN-30.
  let anthropic: Awaited<ReturnType<typeof anthropicClient>> | null = null;
  try {
    anthropic = await anthropicClient(client);
  } catch (e) {
    await ghiLoi(client, "nudge anthropicClient", e);
  }
  const oaToken = await secretOf(client, "ZALO_OA_ACCESS_TOKEN");
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

  // FR-166 bất biến 13 — GIÀNH VIỆC TRƯỚC, GỬI SAU.
  // Trước bản này khối này SELECT thẳng status='pending' rồi gửi rồi mới đánh
  // 'sent'. Hai lượt chạy chồng nhau (cron gối nhau, hoặc gọi tay lúc cron
  // đang chạy) cùng thấy một dòng pending và CÙNG GỬI — khách nhận hai tin y
  // hệt. `nhan_viec_nhac` lật cờ thuê atomic bằng `for update skip locked`,
  // nên chỉ một lượt cầm được việc.
  // `dry_run` KHÔNG được giành việc: giành là tăng `attempts`, mà năm lượt chạy
  // thử là đủ đẩy lời nhắc THẬT vào thư chết dù chưa gửi đi đâu cả. Chạy thử
  // thì chỉ nhìn, đọc thẳng bảng.
  const escClaimRes = dry_run
    ? await client.from("reminders").select("id")
      .eq("status", "pending").in("kind", ["escalation", "report"])
      .lte("due_at", new Date().toISOString()).limit(10)
    : await client.rpc("nhan_viec_nhac", {
      p_kinds: ["escalation", "report"], p_limit: 10, p_worker: workerId,
    });
  const { data: escClaim, error: escErr } = escClaimRes;
  if (escErr) await ghiLoi(client, "nudge nhan_viec_nhac(esc)", escErr.message);
  const escIds = (escClaim ?? []).map((r: { id: string }) => r.id);
  // Giành xong mới lấy kèm quan hệ — RPC trả cột trần, không kèm join được.
  const { data: escDue } = escIds.length
    ? await client.from("reminders")
      .select("id, kind, note, ctv_id, seller_id, ctvs(name, zalo_user_id), sellers(name, zalo_user_id)")
      .in("id", escIds)
    : { data: [] as never[] };
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
    if (!dry_run) {
      if (target && oaToken && !target.startsWith("TEST")) {
        sent = (await sendZalo(oaToken, target, text)) ? "zalo_oa" : "zalo_error";
        if (sent === "zalo_oa") {
          await client.from("reminders")
            .update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", r.id);
        } else {
          // FR-166 bất biến 6/7: nhả hợp đồng thuê + hẹn giờ lùi dần; quá 5 lần
          // thì cho vào thư chết thay vì đập lại OA mỗi 30 phút đến hết đời.
          await baoHongNhac(r.id, "gửi OA hụt");
        }
      } else {
        // Thiếu đích hoặc thiếu token OA: việc này KHÔNG phải của đường OA, nó
        // nằm chờ bridge kéo qua `escalation-feed`. Trả lại nguyên vẹn — giữ
        // hợp đồng thuê là khoá vô ích, còn để `attempts` tăng mỗi nửa tiếng là
        // biến bộ đếm thành lời nói dối (FR-166: chưa thử thì không tính là đã
        // thử). Lỗi này lộ ra khi soi DB sau lượt cron thật đầu tiên.
        // `p_worker` BẮT BUỘC truyền: nhả mà không kiểm ai đang giữ thì một
        // worker treo quá hạn có thể xoá khoá của worker đang chạy, mở đường
        // cho worker thứ ba giành cùng dòng (H2, migration 20260829f).
        await client.rpc("nha_viec_nhac", { p_id: r.id, p_worker: workerId });
      }
    }
    out.push({ kind: r.kind, id: r.id, text, sent });
  }

  // Con mắt bù cho chỗ `nha_viec_nhac` cố ý không có trần thử lại: dòng
  // escalation/report nào nằm chờ quá 24h nghĩa là bridge không tới lấy, và vì
  // mỗi nhịp lại nhả ra nên `attempts` luôn về 0 — không có gì tự lộ. Hàm DB tự
  // ghi `bot_errors` khi đếm > 0 (van của `log_loi` chặn spam).
  if (!dry_run) {
    const { error: treoErr } = await client.rpc("bo_dem_nhac_treo", { p_gio: 24 });
    if (treoErr) await ghiLoi(client, "nudge bo_dem_nhac_treo", treoErr.message);
  }

  // ---- 1. Reminder tới hạn: lời hứa / nhắc lịch xem / follow-up căn (FR-32) ----
  const dueClaimRes = dry_run
    ? await client.from("reminders").select("id")
      .eq("status", "pending").in("kind", ["promise", "viewing", "followup"])
      .lte("due_at", new Date().toISOString()).limit(5)
    : await client.rpc("nhan_viec_nhac", {
      p_kinds: ["promise", "viewing", "followup"], p_limit: 5, p_worker: workerId,
    });
  const { data: dueClaim, error: dueErr } = dueClaimRes;
  if (dueErr) await ghiLoi(client, "nudge nhan_viec_nhac(due)", dueErr.message);
  const dueIds = (dueClaim ?? []).map((r: { id: string }) => r.id);
  const { data: due } = dueIds.length
    ? await client.from("reminders")
      .select("id, kind, note, buyer_id, seller_id, listing_id, buyers(name, zalo_user_id), sellers(name, zalo_user_id)")
      .in("id", dueIds)
    : { data: [] as never[] };

  for (const r of due ?? []) {
    const who = (r.buyers ?? r.sellers) as { name?: string | null; zalo_user_id?: string | null } | null;
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
    // FR-166: model 500 / hết giờ là chuyện thường. Không bọc thì exception
    // thoát khỏi CẢ vòng lặp — những lời nhắc còn lại mất lượt, mà chúng đã bị
    // giành (locked_at) nên treo 5 phút mới ai đụng lại được.
    if (!anthropic) {
      await baoHongNhac(r.id, "khong co client model");
      continue;
    }
    let resp;
    try {
      resp = await anthropic.messages.create({
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
    } catch (e) {
      await ghiLoi(client, "nudge model(nhac)", e);
      await baoHongNhac(r.id, `model: ${String(e).slice(0, 120)}`);
      continue;
    }
    await doTien(client, resp.usage); // FR-171 e: đồng hồ tiền đếm cả lượt nhắc
    const text = resp.content.find((b) => b.type === "text")?.text?.trim();
    if (!text) {
      await baoHongNhac(r.id, "model tra rong");
      continue;
    }

    let sent = "none";
    if (!dry_run) {
      if (who?.zalo_user_id && oaToken && !who.zalo_user_id.startsWith("TEST")) {
        sent = (await sendZalo(oaToken, who.zalo_user_id, text)) ? "zalo_oa" : "zalo_error";
      }
      if (sent === "zalo_error") {
        // Gửi lỗi → GIỮ pending cho nhịp cron sau thử lại, đừng nuốt mất lời nhắc.
        // FR-166: nhả hợp đồng thuê + hẹn giờ theo luật lùi dần. Không nhả thì
        // dòng này bị khoá 5 phút vô ích; không hẹn giờ thì cứ 30 phút lại đập
        // vào OA đúng cái đang hỏng, và không bao giờ dừng.
        await baoHongNhac(r.id, "gửi OA hụt");
        out.push({ kind: r.kind, id: r.id, text, sent, retry: true });
        continue;
      }
      // Tin bot CHỦ ĐỘNG gửi cũng là một dòng trong sổ — cả phía mua lẫn phía
      // bán. Trước bản này chỉ ghi khi có buyer_id, nên hội thoại người bán
      // hiện ra toàn câu trả lời mà không có câu hỏi nào: CTV tiếp quản không
      // biết chủ nhà đang trả lời cái gì (FR-141/FR-152).
      let convLog: string | null = null;
      if (r.buyer_id) {
        const { data: conv } = await client.from("conversations").select("id")
          .eq("buyer_id", r.buyer_id).order("started_at", { ascending: false }).limit(1).maybeSingle();
        convLog = conv?.id ?? null;
      } else if (r.seller_id) {
        const { data: sc, error: scErr } = await client
          .rpc("ensure_seller_conversation", { p_seller_id: r.seller_id, p_channel: "zalo_oa" })
          .single();
        convLog = (sc as { c_id?: string } | null)?.c_id ?? null;
        if (scErr || !convLog) {
          await ghiLoi(client, "nudge ensure_seller_conversation", scErr?.message ?? "không trả về c_id");
        }
      }
      if (convLog) {
        const { error: logErr } = await client.from("messages")
          .insert({ conversation_id: convLog, sender: "bot", body: text });
        if (logErr) await ghiLoi(client, "nudge messages bot", logErr.message);
        await client.from("conversations")
          .update({ last_message_at: new Date().toISOString() }).eq("id", convLog);
      }
      await client.from("reminders")
        .update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", r.id);
    }
    out.push({ kind: r.kind, id: r.id, text, sent });
  }

  // ---- 2. Buyer im lặng 5-6 ngày ----
  // FR-166: DỌN DÒNG GIỮ CHỖ MỒ CÔI trước đã.
  // Đường bình thường đóng dòng giữ chỗ trong vài giây: gửi xong → `sent`,
  // gửi hụt → `cancelled`, model ném hoặc trả rỗng → xoá. Còn `pending` quá 15
  // phút chỉ có một nghĩa: instance bị thu hồi giữa lúc gọi model, không ai
  // đóng dòng đó nữa. Mà `reminders_mot_reengage_cho_idx` chỉ cho MỘT dòng
  // reengage pending mỗi khách, nên dòng mồ côi KHOÁ CỨNG đúng khách ấy —
  // không bao giờ được hỏi thăm lần nữa, không một dòng lỗi nào, và chẳng ai
  // biết cho tới lúc soi tay. `nudge` là nơi DUY NHẤT ghi `kind='reengage'`
  // (đã soát 29/08) nên quét ở đây là đủ, khỏi thêm cron riêng.
  if (!dry_run) {
    const { data: donRows, error: donErr } = await client.from("reminders")
      .update({ status: "cancelled", last_error: "mo coi — instance chet giua chung" })
      .eq("kind", "reengage").eq("status", "pending")
      .lt("created_at", new Date(Date.now() - 15 * 60e3).toISOString())
      .select("id");
    if (donErr) await ghiLoi(client, "nudge don reengage mo coi", donErr.message);
    else if (donRows?.length) {
      out.push({ kind: "don_reengage_mo_coi", so: donRows.length });
    }
  }

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

    // FR-166 bất biến 13 — GIỮ CHỖ TRƯỚC, GỬI SAU.
    // Trước bản này: ĐẾM xem đã hỏi thăm chưa → gửi → mới ghi vết. Hai lượt
    // chạy chồng nhau cùng đếm ra 0 và CÙNG GỬI. Nay chèn dòng `pending`
    // TRƯỚC, index duy nhất khiến bên thua nhận 23505 rồi nhường.
    if (!anthropic) continue;
    let giuCho: string | null = null;
    if (!dry_run) {
      const { data: cho, error: choErr } = await client.from("reminders").insert({
        kind: "reengage", buyer_id: b.id, due_at: new Date().toISOString(),
        note: angle, status: "pending",
      }).select("id").single();
      if (choErr) {
        // 23505 = thua cuộc đua với lượt chạy song song. ĐÚNG như thiết kế:
        // index duy nhất là trọng tài, bên thua nhường, không ồn ào.
        // Mọi mã khác (hết quyền, sai ràng buộc, mất kết nối) là hỏng THẬT và
        // phải vào sổ — `continue` trần nuốt sạch cả hai loại như nhau, đúng
        // kiểu hỏng im lặng FR-152 d cấm.
        if (choErr.code !== "23505") {
          await ghiLoi(client, "nudge giu cho reengage", choErr.message);
        }
        continue;
      }
      giuCho = cho?.id ?? null;
    }

    let resp;
    try {
      resp = await anthropic.messages.create({
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
    } catch (e) {
      await ghiLoi(client, "nudge model(reengage)", e);
      if (giuCho) await client.from("reminders").delete().eq("id", giuCho);
      continue;
    }
    await doTien(client, resp.usage);
    const text = resp.content.find((bk) => bk.type === "text")?.text?.trim();
    if (!text) {
      if (giuCho) await client.from("reminders").delete().eq("id", giuCho);
      continue;
    }

    let sent = "none";
    if (!dry_run) {
      if (b.zalo_user_id && oaToken && !b.zalo_user_id.startsWith("TEST")) {
        sent = (await sendZalo(oaToken, b.zalo_user_id, text)) ? "zalo_oa" : "zalo_error";
      }
      if (sent === "zalo_error") {
        // ĐÓNG chỗ giữ lại, đừng để nó nằm `pending` mãi. Index duy nhất
        // `reminders_mot_reengage_cho_idx` chỉ cho MỘT dòng reengage pending
        // mỗi khách, nên một dòng pending không ai xử lý là khoá cứng: khách
        // đó không bao giờ được hỏi thăm nữa. `cancelled` nhả khoá mà vẫn để
        // lại vết (khác `delete`), và cổng chống-spam 5 ngày đếm theo
        // `created_at` bất kể trạng thái nên vẫn giữ đúng nhịp không làm phiền.
        // Cố ý KHÔNG hẹn lùi dần ở đây: dòng reengage không nằm trong bộ
        // `nhan_viec_nhac` nào cả, hẹn giờ cho nó là hẹn cho người không tới.
        if (giuCho) {
          await client.from("reminders")
            .update({ status: "cancelled", last_error: "gửi OA hụt" }).eq("id", giuCho);
        }
        reengaged++;
        out.push({ kind: "reengage", buyer: b.id, angle, text, sent, retry: true });
        continue;
      }
      if (conv) await client.from("messages").insert({ conversation_id: conv.id, sender: "bot", body: text });
      if (giuCho) {
        await client.from("reminders")
          .update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", giuCho);
      }
    }
    reengaged++;
    out.push({ kind: "reengage", buyer: b.id, angle, text, sent });
  }

  return jsonResponse({ done: out.length, dry_run, results: out });
});
