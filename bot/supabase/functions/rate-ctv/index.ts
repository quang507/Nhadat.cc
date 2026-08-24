// rate-ctv — FR-102: chấm chất lượng CSKH của CTV/bot từ log hội thoại,
// ghi vào ratings (rated_by='ai_qa'). Idempotent theo (conversation_id, target=ctv, ai_qa).
// POST { "conversation_id": "<uuid>" }  hoặc  { "conversation_id": "...", "transcript": [{sender, body}] }
// Trả: { rating_id, stars, details, comment }
import { z } from "npm:zod@4";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import {
  anthropicClient,
  jsonResponse,
  MODEL,
  serviceClient,
} from "../_shared/claude.ts";
import { RATE_CTV_RUBRIC } from "../_shared/prompts.ts";

const OutSchema = z.object({
  le_phep: z.number().int().min(1).max(5),
  dung_luat_hoi: z.number().int().min(1).max(5),
  hieu_bds: z.number().int().min(1).max(5),
  cham_khach: z.number().int().min(1).max(5),
  stars: z.number().int().min(1).max(5).describe("Điểm tổng 1-5"),
  vi_pham_nghiem_trong: z.boolean(),
  comment: z.string().describe("1-2 câu tiếng Việt, nêu lỗi/điểm tốt cụ thể"),
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "POST only" }, 405);
  const body = await req.json().catch(() => ({}));
  const { conversation_id } = body;
  if (!conversation_id) return jsonResponse({ error: "conversation_id bắt buộc" }, 400);

  const db = serviceClient();

  const { data: conv, error: cErr } = await db
    .from("conversations")
    .select("id, buyer_id, ctv_id")
    .eq("id", conversation_id)
    .single();
  if (cErr || !conv) return jsonResponse({ error: "conversation không tồn tại" }, 404);

  // Đã chấm rồi thì trả kết quả cũ (không chấm đôi)
  const { data: existed } = await db
    .from("ratings")
    .select("id, stars, details, comment")
    .eq("conversation_id", conversation_id)
    .eq("target", "ctv")
    .eq("rated_by", "ai_qa")
    .maybeSingle();
  if (existed) return jsonResponse({ rating_id: existed.id, ...existed, cached: true });

  // Transcript: từ body (test/backfill) hoặc từ bảng messages
  let transcript: { sender: string; body: string }[] = body.transcript ?? [];
  if (transcript.length === 0) {
    const { data: msgs, error: mErr } = await db
      .from("messages")
      .select("sender, body")
      .eq("conversation_id", conversation_id)
      .order("created_at");
    if (mErr) return jsonResponse({ error: mErr.message }, 500);
    transcript = msgs ?? [];
  }
  if (transcript.length < 2) {
    return jsonResponse({ error: "Hội thoại quá ngắn để chấm (<2 tin)" }, 422);
  }

  const SENDER_LABEL: Record<string, string> = {
    buyer: "KHÁCH",
    seller: "NGƯỜI BÁN",
    bot: "CTV/BOT",
    ctv: "CTV/BOT",
    system: "HỆ THỐNG",
  };
  const rendered = transcript
    .map((m) => `${SENDER_LABEL[m.sender] ?? m.sender}: ${m.body}`)
    .join("\n");

  const anthropic = await anthropicClient(db);
  const resp = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 2048,
    output_config: {
      effort: "medium",
      format: zodOutputFormat(OutSchema),
    },
    system: [{ type: "text", text: RATE_CTV_RUBRIC, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: `Hội thoại cần chấm (chấm phần CTV/BOT, không chấm khách):\n\n${rendered}`,
    }],
  });

  if (resp.stop_reason === "refusal" || !resp.parsed_output) {
    return jsonResponse({ error: "Không chấm được", stop_reason: resp.stop_reason }, 502);
  }
  const out = resp.parsed_output;

  const { data: inserted, error: iErr } = await db
    .from("ratings")
    .insert({
      buyer_id: conv.buyer_id,
      target: "ctv",
      ctv_id: conv.ctv_id,
      conversation_id,
      stars: out.stars,
      comment: out.comment,
      rated_by: "ai_qa",
      details: {
        le_phep: out.le_phep,
        dung_luat_hoi: out.dung_luat_hoi,
        hieu_bds: out.hieu_bds,
        cham_khach: out.cham_khach,
        vi_pham_nghiem_trong: out.vi_pham_nghiem_trong,
        model: MODEL,
      },
    })
    .select("id")
    .single();
  if (iErr) return jsonResponse({ error: iErr.message, scored: out }, 500);

  return jsonResponse({
    rating_id: inserted.id,
    stars: out.stars,
    details: out,
    comment: out.comment,
  });
});
