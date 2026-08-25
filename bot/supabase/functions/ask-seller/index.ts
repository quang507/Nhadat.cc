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
  jsonResponse,
  MODEL,
  serviceClient,
} from "../_shared/claude.ts";
import { FACT_LABELS, SELLER_SCRIPT_RULES, TONE_RULES } from "../_shared/prompts.ts";

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
  const { listing_id, mode = "batch", dry_run = false } = await req.json().catch(() => ({}));
  if (!listing_id) return jsonResponse({ error: "listing_id bắt buộc" }, 400);
  const drip = mode === "drip";

  const db = serviceClient();

  const { data: listing, error: lErr } = await db
    .from("listings")
    .select(
      "id, code, property_type, district, ward, location_raw, price_raw, area_m2, description, seller_id, sellers(name, seller_type, zalo_user_id)",
    )
    .eq("id", listing_id)
    .single();
  if (lErr || !listing) return jsonResponse({ error: "listing không tồn tại" }, 404);
  if (!listing.property_type) {
    return jsonResponse({
      error: "listing chưa có property_type — chưa xác định được checklist required_facts",
    }, 422);
  }

  const { data: missing, error: mErr } = await db
    .from("listing_missing_facts")
    .select("fact_key, priority")
    .eq("listing_id", listing_id)
    .order("priority");
  if (mErr) return jsonResponse({ error: mErr.message }, 500);

  // Không hỏi lại điều đang chờ trả lời (chống spam — INS-09)
  const { data: pending } = await db
    .from("info_requests")
    .select("question")
    .eq("listing_id", listing_id)
    .eq("status", "pending");
  const pendingKeys = new Set((pending ?? []).map((r) => r.question));
  const candidates = (missing ?? []).filter((f) => !pendingKeys.has(f.fact_key));
  const toAsk = candidates.slice(0, drip ? 1 : 3);

  if (toAsk.length === 0) {
    return jsonResponse({
      message: null,
      asked: [],
      skipped_pending: [...pendingKeys],
      note: "Không còn fact nào cần hỏi (đủ thông tin hoặc đều đang chờ trả lời)",
    });
  }

  // Drip: câu đầu tiên của listing thì chào; các câu sau nối tiếp hội thoại
  const { count: askedBefore } = await db
    .from("info_requests")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listing_id);
  const isFirst = (askedBefore ?? 0) === 0;

  const factList = toAsk
    .map((f) => `- ${f.fact_key}: ${FACT_LABELS[f.fact_key] ?? f.fact_key}`)
    .join("\n");
  const seller = listing.sellers as
    | { name?: string; seller_type?: string; zalo_user_id?: string | null }
    | null;

  const instruction = drip
    ? (isFirst
        ? `Soạn MỘT tin nhắn Zalo NGẮN (~30 từ) gửi người bán ngay sau khi họ vừa đăng tin: cảm ơn, KHEN một điểm mạnh thật của tin rao (vị trí/hẻm/giá…), rồi hỏi ĐÚNG MỘT câu về thông tin dưới đây. Không hỏi gì khác.`
        : `Soạn MỘT tin nhắn Zalo RẤT NGẮN (1-2 câu, ~30 từ) hỏi tiếp ĐÚNG MỘT thông tin dưới đây, giọng nối tiếp cuộc trò chuyện đang có, kèm lý do vì-khách khi tự nhiên ("khách mua đang hỏi…"). Không chào lại từ đầu, không hỏi gì khác.`)
    : `Soạn MỘT tin nhắn Zalo gửi người bán để xin bổ sung thông tin cho tin rao: gộp hết vào một tin duy nhất, mỗi thông tin một câu hỏi rõ ràng, mở đầu chào đúng tone + khen một điểm mạnh của tin, nói rõ "có khách đang hỏi" để tạo động lực trả lời, kết thúc bằng lời cảm ơn + câu hỏi. Không hỏi gì ngoài danh sách.`;

  const anthropic = await anthropicClient(db);
  const resp = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    output_config: {
      effort: "medium",
      format: zodOutputFormat(OutSchema),
    },
    system: [{
      type: "text",
      text: TONE_RULES + "\n\n" + SELLER_SCRIPT_RULES,
      cache_control: { type: "ephemeral" },
    }],
    messages: [{
      role: "user",
      content:
        `${instruction}\n` +
        `Người bán: ${seller?.name ?? "chưa rõ tên (gọi anh/chị)"} — loại: ${
          seller?.seller_type === "nmg" ? "nhà môi giới (hỏi gọn, chuyên nghiệp)" : "chính chủ (giọng gần gũi)"
        }\n` +
        `Tin rao: #${listing.code ?? listing.id} — ${listing.location_raw ?? ""} ${listing.ward ?? ""} ${listing.district ?? ""}, giá ${listing.price_raw ?? "?"}\n` +
        `Thông tin cần hỏi:\n${factList}`,
    }],
  });

  if (resp.stop_reason === "refusal" || !resp.parsed_output) {
    return jsonResponse({ error: "Không sinh được tin nhắn", stop_reason: resp.stop_reason }, 502);
  }
  const out = resp.parsed_output;
  let sent_via: string = "none";

  if (!dry_run) {
    const rows = toAsk.map((f) => ({
      listing_id,
      question: f.fact_key,
      status: "pending",
    }));
    const { error: iErr } = await db.from("info_requests").insert(rows);
    if (iErr) return jsonResponse({ error: iErr.message, message: out.message }, 500);

    // Gửi thẳng qua Zalo OA nếu có kênh (FR-129)
    if (seller?.zalo_user_id) {
      const { data: token } = await db.rpc("get_secret", {
        secret_name: "ZALO_OA_ACCESS_TOKEN",
      });
      if (token) {
        const send = await fetch("https://openapi.zalo.me/v3.0/oa/message/cs", {
          method: "POST",
          headers: { "Content-Type": "application/json", access_token: token as string },
          body: JSON.stringify({
            recipient: { user_id: seller.zalo_user_id },
            message: { text: out.message },
          }),
        });
        const sr = await send.json().catch(() => ({}));
        sent_via = sr?.error === 0 ? "zalo_oa" : `zalo_oa_error:${sr?.error}`;
      }
    }
  }

  return jsonResponse({
    message: out.message,
    asked: toAsk.map((f) => f.fact_key),
    mode,
    is_first: isFirst,
    sent_via,
    dry_run,
  });
});
