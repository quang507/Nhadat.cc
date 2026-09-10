// ask-seller — FR-40…47 + FR-129 (hỏi nhỏ giọt): sinh câu hỏi bổ sung cho S.
// mode "batch" (mặc định cũ): gộp tối đa 3 câu một tin.
// mode "drip": hỏi ĐÚNG MỘT câu ưu tiên nhất — dùng cho trigger sau khi đăng
// tin và cron nhắc nhịp; nếu seller có zalo_user_id + có ZALO_OA_ACCESS_TOKEN
// thì gửi thẳng qua OA, không thì câu hỏi nằm ở info_requests cho CTV gửi tay.
// POST { listing_id, mode?: "batch"|"drip", dry_run?: bool }
import { z } from "npm:zod@4";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import {
  anthropicClient,
  doTien,
  ghiLoi,
  jsonResponse,
  MODEL,
  secretOf,
  sendZalo,
  serviceClient,
} from "../_shared/claude.ts";
import { congBiMat } from "../_shared/gate.ts";
import { dienTen, FACT_LABELS, SELLER_SCRIPT_RULES, tenTroLy, TONE_RULES } from "../_shared/prompts.ts";

const OutSchema = z.object({
  message: z.string().describe("Tin nhắn Zalo gửi người bán, tiếng Việt"),
  questions: z.array(
    z.object({
      fact_key: z.string(),
      question: z.string().describe("Câu hỏi ngắn gọn cho fact này"),
    }),
  ),
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "POST only" }, 405);

  // ── CỔNG (soát bảo mật 29/08/2026) ───────────────────────────────────────
  // verify_jwt=true KHÔNG phải là xác thực: nó chỉ đòi publishable key, mà khoá
  // đó nằm sẵn trong bundle JS của web. Có listing_id là người lạ bắt bot NHẮN
  // THẬT cho chủ nhà — đường quấy rối, và đốt tiền model. Cổng dùng chung
  // `_shared/gate.ts`.
  const db = serviceClient();
  const chan = await congBiMat(req, db, "ask-seller");
  if (chan) return chan;

  const { listing_id, mode = "batch", dry_run = false } = await req.json().catch(() => ({}));
  if (!listing_id) return jsonResponse({ error: "listing_id bắt buộc" }, 400);
  const drip = mode === "drip";

  const { data: listing, error: lErr } = await db
    .from("listings")
    .select(
      "id, code, property_type, district, ward, location_raw, price_raw, area_m2, description, seller_id, sellers(name, seller_type, zalo_user_id, ten_tro_ly)",
    )
    .eq("id", listing_id)
    .single();
  if (lErr || !listing) return jsonResponse({ error: "listing không tồn tại" }, 404);
  if (!listing.property_type) {
    return jsonResponse({
      error: "listing chưa có property_type - chưa xác định được checklist required_facts",
    }, 422);
  }

  const { data: missing, error: mErr } = await db
    .from("listing_missing_facts")
    .select("fact_key, priority, nhom")
    .eq("listing_id", listing_id)
    .order("priority");
  if (mErr) return jsonResponse({ error: mErr.message }, 500);

  // Không hỏi lại điều đang chờ trả lời (chống spam — INS-09). Một truy vấn
  // lấy cả hai thứ cần: câu đang chờ (status) và "đã từng hỏi căn này chưa"
  // (số dòng) — trước đây là hai lượt đi về (FR-171 e).
  const { data: daHoi } = await db
    .from("info_requests")
    .select("question, status")
    .eq("listing_id", listing_id);
  // FR-186 o (chat Gemini 21/06 lượt 1 "không hỏi lần thứ hai", chủ dự án 10/09):
  // câu chủ nhà đã NÉ (info_request expired) thì vòng hỏi bù KHÔNG hỏi lại.
  const daNeKeys = new Set(
    (daHoi ?? []).filter((r) => r.status === "expired").map((r) => r.question),
  );
  const pendingKeys = new Set(
    (daHoi ?? []).filter((r) => r.status === "pending").map((r) => r.question),
  );
  const isFirst = (daHoi ?? []).length === 0;

  // FR-144: chế độ drip là MỘT-CÂU-MỘT-LÚC — listing đang có bất kỳ câu pending
  // nào (vd chat-reply vừa hỏi ngay lúc nhận tin rao) thì nhịp này bỏ qua, kẻo
  // hai câu hỏi song song làm câu trả lời của chủ nhà bị ghi nhầm fact.
  if (drip && pendingKeys.size > 0) {
    return jsonResponse({
      message: null, asked: [], skipped_pending: [...pendingKeys],
      note: "drip: đang có câu chờ trả lời - không hỏi chồng",
    });
  }

  // Chủ dự án 09/09/2026 tối: hỏi bù là MỘT LẦN gom 2–3 thông tin còn thiếu,
  // ưu tiên thứ quan trọng (giá, diện tích, pháp lý, vị trí) hoặc ẢNH + SỔ —
  // không phải mỗi nhịp một câu lắt nhắt. Thứ tự: ảnh/sổ/giá/diện tích/vị trí
  // lên đầu, rồi cơ bản → chuyên môn → sau đăng theo priority.
  const QUAN_TRONG = ["hinh_anh", "phap_ly", "gia", "dien_tich", "dien_tich_dat", "dien_tich_tim_tuong", "vi_tri", "phuong"];
  const bac = (f: { fact_key: string; nhom?: string | null }) =>
    (QUAN_TRONG.includes(f.fact_key) ? 0 : 10) +
    (f.nhom === "co_ban" ? 0 : f.nhom === "chuyen_mon" ? 1 : f.nhom === "sau_dang" ? 2 : 3);
  const candidates = (missing ?? [])
    .filter((f) => !pendingKeys.has(f.fact_key) && !daNeKeys.has(f.fact_key))
    .sort((a, b) => bac(a) - bac(b) || (a.priority ?? 0) - (b.priority ?? 0));
  const toAsk = candidates.slice(0, 3);

  if (toAsk.length === 0) {
    return jsonResponse({
      message: null,
      asked: [],
      skipped_pending: [...pendingKeys],
      note: "Không còn fact nào cần hỏi (đủ thông tin hoặc đều đang chờ trả lời)",
    });
  }

  // Drip: câu đầu tiên của listing thì chào; các câu sau nối tiếp hội thoại
  // (`isFirst` tính ở trên, cùng truy vấn với pendingKeys).
  const factList = toAsk
    .map((f) => `- ${f.fact_key}: ${FACT_LABELS[f.fact_key] ?? f.fact_key}`)
    .join("\n");
  const seller = listing.sellers as
    | { name?: string; seller_type?: string; zalo_user_id?: string | null; ten_tro_ly?: string | null }
    | null;
  // FR-181: cùng một tên trợ lý với chat-reply — cột `ten_tro_ly` nếu đã có,
  // không thì băm từ Zalo ID (cùng hàm, cùng kết quả).
  const tenBot = seller?.ten_tro_ly ?? (seller?.zalo_user_id ? tenTroLy(seller.zalo_user_id) : "T•ai");

  const instruction = drip
    ? (isFirst
        ? `Soạn MỘT tin nhắn Zalo NGẮN (35–60 từ) gửi người bán ngay sau khi họ vừa đăng tin: cảm ơn, KHEN một điểm mạnh thật của tin rao (vị trí/hẻm/giá…), rồi hỏi GỌN trong một tin ${toAsk.length} thông tin dưới đây — mỗi thông tin một dòng ngắn, không thành bảng hỏi. Không hỏi gì khác.`
        : `Soạn MỘT tin nhắn Zalo NGẮN (35–60 từ) hỏi bù ${toAsk.length} thông tin dưới đây trong CÙNG MỘT tin (mỗi thông tin một dòng ngắn, xuống dòng), giọng nối tiếp cuộc trò chuyện đang có, kèm lý do vì-khách khi tự nhiên ("khách mua đang hỏi…"). Không chào lại từ đầu, không hỏi gì khác.`)
    : `Soạn MỘT tin nhắn Zalo gửi người bán để xin bổ sung thông tin cho tin rao: gộp hết vào một tin duy nhất, mỗi thông tin một câu hỏi rõ ràng, mở đầu chào đúng tone + khen một điểm mạnh của tin, nói rõ "có khách đang hỏi" để tạo động lực trả lời, kết thúc bằng lời cảm ơn + câu hỏi. Không hỏi gì ngoài danh sách.`;

  const anthropic = await anthropicClient(db);
  // FR-171 e: một tin ~30 từ + tối đa 3 câu hỏi ngắn — `low`/512 là đủ, như
  // nudge đang dùng cho việc tương đương. `medium`/1024 trước đây là trả thêm
  // tiền suy nghĩ cho một câu chào. 512 (không phải 256) vì đầu ra là JSON có
  // mảng questions; cắt giữa chuỗi là parse hỏng im (bài học ctv-report 26/08).
  const resp = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 512,
    output_config: {
      effort: "low",
      format: zodOutputFormat(OutSchema),
    },
    system: [{
      type: "text",
      text: dienTen(TONE_RULES, tenBot) + "\n\n" + SELLER_SCRIPT_RULES,
      cache_control: { type: "ephemeral" },
    }],
    messages: [{
      role: "user",
      content:
        `${instruction}\n` +
        `Người bán: ${seller?.name ?? "chưa rõ tên (gọi anh/chị)"} - loại: ${
          seller?.seller_type === "nmg" ? "nhà môi giới (hỏi gọn, chuyên nghiệp)" : "chính chủ (giọng gần gũi)"
        }\n` +
        `Tin rao: #${listing.code ?? listing.id} - ${listing.location_raw ?? ""} ${listing.ward ?? ""} ${listing.district ?? ""}, giá ${listing.price_raw ?? "?"}\n` +
        `Thông tin cần hỏi:\n${factList}`,
    }],
  });

  await doTien(db, resp.usage); // FR-171 e: đồng hồ tiền đếm cả câu hỏi chủ nhà
  if (resp.stop_reason === "refusal" || !resp.parsed_output) {
    return jsonResponse({ error: "Không sinh được tin nhắn", stop_reason: resp.stop_reason }, 502);
  }
  const out = resp.parsed_output;
  let sent_via: string = "none";
  // Khai ngoài khối `dry_run` vì câu trả lời cuối hàm đọc nó: `asked` phải là
  // những câu THẬT SỰ được mở, không phải những câu định mở.
  let daMo: string[] = toAsk.map((f) => f.fact_key);

  if (!dry_run) {
    const rows = toAsk.map((f) => ({
      listing_id,
      question: f.fact_key,
      status: "pending",
    }));
    // ĐUA: `pendingKeys` đọc ở đầu hàm, `insert` ở đây. Giữa hai mốc đó,
    // `chat-reply` (người bán vừa nhắn) hoặc một nhịp drip khác có thể đã mở
    // đúng câu hỏi này. Chính comment ở đầu hàm nói hậu quả: hai câu hỏi song
    // song làm câu trả lời của chủ nhà bị ghi nhầm fact.
    // `info_requests_mot_cau_cho_idx` nay chặn cú thứ hai. Ghi cả lô mà một
    // câu đụng thì CẢ LÔ trượt, nên thử lại từng dòng để những câu chưa ai hỏi
    // vẫn được mở — bỏ nguyên lô là mất câu hỏi, tức vòng hỏi đứng im.
    const { error: iErr } = await db.from("info_requests").insert(rows);
    if (iErr?.code === "23505") {
      daMo = [];
      for (const r of rows) {
        const { error: e1 } = await db.from("info_requests").insert(r);
        if (!e1) daMo.push(r.question);
        else if (e1.code !== "23505") await ghiLoi(db, "ask-seller info_request", e1.message);
      }
      if (daMo.length === 0) {
        // Mọi câu đều đã có người hỏi → KHÔNG gửi tin, kẻo chủ nhà nhận câu
        // hỏi trùng đúng cái mà cổng `drip` ở trên cố tránh.
        return jsonResponse({
          message: null, asked: [], skipped_pending: rows.map((r) => r.question),
          note: "đua: câu hỏi vừa được mở bởi lượt khác - không hỏi chồng",
        });
      }
    } else if (iErr) {
      return jsonResponse({ error: iErr.message, message: out.message }, 500);
    }

    // Gửi thẳng qua Zalo OA nếu có kênh (FR-129). Dùng `secretOf` + `sendZalo`
    // dùng chung thay vì fetch tay + `get_secret` trần (FR-171 g): token đặt ở
    // env thì `get_secret` (chỉ hỏi Vault) đọc ra null và câu hỏi không bao giờ
    // đi — hai hàm anh em đã tránh được bẫy đó từ lâu.
    if (seller?.zalo_user_id) {
      const token = await secretOf(db, "ZALO_OA_ACCESS_TOKEN");
      // FR-177 f (09/09/2026): kênh đang chạy là BRIDGE (Zalo cá nhân), không
      // có OA. Trước bản này câu hỏi drip chỉ mở info_requests rồi... im —
      // "sent_via: none", chủ nhà không bao giờ nhận được câu hỏi bù. Nay xếp
      // vào hàng đợi `reminders` kind escalation với seller_id + ghi chú "💬 …":
      // escalation-feed kéo, bridge gửi nguyên văn (tin_nhac.ts), rồi ack.
      if (!token) {
        const { error: rErr } = await db.from("reminders").insert({
          kind: "escalation", seller_id: listing.seller_id, listing_id,
          due_at: new Date().toISOString(), note: `💬 ${out.message}`,
        });
        if (rErr) await ghiLoi(db, "ask-seller reminders(bridge)", rErr.message);
        else {
          sent_via = "bridge_queue";
          const { data: sc, error: scErr } = await db
            .rpc("ensure_seller_conversation", {
              p_seller_id: listing.seller_id, p_channel: "zalo_personal",
            }).single();
          const scId = (sc as { c_id?: string } | null)?.c_id ?? null;
          if (scErr || !scId) {
            await ghiLoi(db, "ask-seller ensure_seller_conversation(bridge)",
              scErr?.message ?? "không trả về c_id");
          } else {
            const { error: logErr } = await db.from("messages")
              .insert({ conversation_id: scId, sender: "bot", body: out.message });
            if (logErr) await ghiLoi(db, "ask-seller messages bot(bridge)", logErr.message);
          }
        }
      }
      if (token) {
        const guiDuoc = await sendZalo(token, seller.zalo_user_id, out.message);
        sent_via = guiDuoc ? "zalo_oa" : "zalo_oa_error";
        // Câu hỏi ĐÃ GỬI ĐI thì phải vào sổ hội thoại người bán, không thì
        // hội thoại chỉ còn câu trả lời trơ trọi và CTV tiếp quản không có gì
        // để bám (FR-141/FR-152). Chỉ ghi khi Zalo nhận thật.
        if (guiDuoc && listing.seller_id) {
          const { data: sc, error: scErr } = await db
            .rpc("ensure_seller_conversation", {
              p_seller_id: listing.seller_id, p_channel: "zalo_oa",
            }).single();
          const scId = (sc as { c_id?: string } | null)?.c_id ?? null;
          if (scErr || !scId) {
            await ghiLoi(db, "ask-seller ensure_seller_conversation",
              scErr?.message ?? "không trả về c_id");
          } else {
            const { error: logErr } = await db.from("messages")
              .insert({ conversation_id: scId, sender: "bot", body: out.message });
            if (logErr) await ghiLoi(db, "ask-seller messages bot", logErr.message);
            // (`last_message_at` do trigger trên `messages` đẩy — 20260902d.)
          }
        }
      }
    }
  }

  return jsonResponse({
    message: out.message,
    asked: daMo,
    mode,
    is_first: isFirst,
    sent_via,
    dry_run,
  });
});
