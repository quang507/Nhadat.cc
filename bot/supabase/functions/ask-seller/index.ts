// ask-seller — FR-40…47 + INS-06: đọc listing_missing_facts, sinh MỘT tin nhắn
// hỏi S các thông tin còn thiếu (ưu tiên cao trước, tối đa 3 câu), ghi info_requests.
// POST { "listing_id": "<uuid>", "dry_run": true|false }
// Trả: { message, asked: [fact_key], skipped_pending: [fact_key] }
import { z } from "npm:zod@4";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import {
  anthropicClient,
  jsonResponse,
  MODEL,
  serviceClient,
} from "../_shared/claude.ts";
import { FACT_LABELS, TONE_RULES } from "../_shared/prompts.ts";

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
  const { listing_id, dry_run = false } = await req.json().catch(() => ({}));
  if (!listing_id) return jsonResponse({ error: "listing_id bắt buộc" }, 400);

  const db = serviceClient();

  const { data: listing, error: lErr } = await db
    .from("listings")
    .select(
      "id, code, property_type, district, ward, location_raw, price_raw, area_m2, description, seller_id, sellers(name, seller_type)",
    )
    .eq("id", listing_id)
    .single();
  if (lErr || !listing) return jsonResponse({ error: "listing không tồn tại" }, 404);
  if (!listing.property_type) {
    return jsonResponse({
      error: "listing chưa có property_type — chưa xác định được checklist required_facts",
    }, 422);
  }

  // Fact còn thiếu (view đối chiếu required_facts ↔ listing_facts)
  const { data: missing, error: mErr } = await db
    .from("listing_missing_facts")
    .select("fact_key, priority")
    .eq("listing_id", listing_id)
    .order("priority");
  if (mErr) return jsonResponse({ error: mErr.message }, 500);

  // Không hỏi lại điều đang chờ S trả lời (idempotency — không spam S, INS-09)
  const { data: pending } = await db
    .from("info_requests")
    .select("question")
    .eq("listing_id", listing_id)
    .eq("status", "pending");
  const pendingKeys = new Set((pending ?? []).map((r) => r.question));
  const toAsk = (missing ?? []).filter((f) => !pendingKeys.has(f.fact_key)).slice(0, 3);

  if (toAsk.length === 0) {
    return jsonResponse({
      message: null,
      asked: [],
      skipped_pending: [...pendingKeys],
      note: "Không còn fact nào cần hỏi (đủ thông tin hoặc đều đang chờ trả lời)",
    });
  }

  const factList = toAsk
    .map((f) => `- ${f.fact_key}: ${FACT_LABELS[f.fact_key] ?? f.fact_key}`)
    .join("\n");
  const sellerName = (listing.sellers as { name?: string } | null)?.name ?? null;
  const sellerType = (listing.sellers as { seller_type?: string } | null)?.seller_type;

  const anthropic = await anthropicClient(db);
  const resp = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 2048,
    output_config: {
      effort: "medium",
      format: zodOutputFormat(OutSchema),
    },
    system: [{ type: "text", text: TONE_RULES, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content:
        `Soạn MỘT tin nhắn Zalo gửi người bán để xin bổ sung thông tin cho tin rao.\n` +
        `Người bán: ${sellerName ?? "chưa rõ tên (gọi anh/chị)"} — loại: ${
          sellerType === "nmg" ? "nhà môi giới (được phép hỏi gọn, chuyên nghiệp)" : "chính chủ (giải thích ngắn vì sao cần, giọng gần gũi)"
        }\n` +
        `Tin rao: #${listing.code ?? listing.id} — ${listing.location_raw ?? ""} ${listing.ward ?? ""} ${listing.district ?? ""}, giá ${listing.price_raw ?? "?"}\n` +
        `Các thông tin cần hỏi (đã có người mua quan tâm hỏi tới):\n${factList}\n\n` +
        `Yêu cầu: gộp hết vào một tin duy nhất, mỗi thông tin một câu hỏi rõ ràng, mở đầu chào đúng tone, nói rõ "có khách đang hỏi" để tạo động lực trả lời, kết thúc bằng lời cảm ơn + câu hỏi. Không hỏi gì ngoài danh sách trên.`,
    }],
  });

  if (resp.stop_reason === "refusal" || !resp.parsed_output) {
    return jsonResponse({ error: "Không sinh được tin nhắn", stop_reason: resp.stop_reason }, 502);
  }
  const out = resp.parsed_output;

  if (!dry_run) {
    const rows = out.questions.map((q) => ({
      listing_id,
      question: q.fact_key,
      status: "pending",
    }));
    const { error: iErr } = await db.from("info_requests").insert(rows);
    if (iErr) return jsonResponse({ error: iErr.message, message: out.message }, 500);
  }

  return jsonResponse({
    message: out.message,
    asked: out.questions.map((q) => q.fact_key),
    skipped_pending: [...pendingKeys],
    dry_run,
  });
});
