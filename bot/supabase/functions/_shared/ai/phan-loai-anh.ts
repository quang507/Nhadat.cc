// phan-loai-anh.ts — FR-185 (09/09/2026): ảnh chủ nhà gửi qua chat là ảnh GÌ?
// Mặt tiền / trong nhà / hẻm / giấy tờ (sổ hồng, sổ đỏ, HĐMB) / bản vẽ / khác,
// và nếu là giấy tờ thì đọc ra vài con số để đối chiếu với lời chủ nhà (diện
// tích, địa chỉ thửa, số thửa, số tờ). Chat Gemini 21/06: "nhận biết hình đó là
// hình gì… đọc các photo giấy đỏ xem có đúng hay không".
//
// Tầng AI (bot/tests/ranh-gioi.mjs LUAT_AI): chỉ gọi model, KHÔNG đụng bảng.
// Cất ảnh vào kho và ghi listing_media là việc của `_shared/kho_anh.ts` +
// chat-reply. Không đọc tên chủ sở hữu ra khỏi sổ (CLAUDE.md §5 — PII).
import { z } from "npm:zod@4";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";

export const LOAI_ANH = ["mat_tien", "trong_nha", "hem", "giay_to", "ban_ve", "khac"] as const;
export type LoaiAnh = (typeof LOAI_ANH)[number];

export const AnhSchema = z.object({
  loai: z.enum(LOAI_ANH).describe(
    "mat_tien = mặt ngoài / mặt tiền nhà, cửa, ban công nhìn từ ngoài; trong_nha = phòng khách, bếp, phòng ngủ, WC, cầu thang; hem = hẻm/đường trước nhà; giay_to = sổ hồng, sổ đỏ, giấy chứng nhận, hợp đồng mua bán, CCCD, giấy tờ có chữ in; ban_ve = bản vẽ, sơ đồ, mặt bằng, quy hoạch; khac = không rõ hoặc không thuộc loại nào",
  ),
  mo_ta: z.string().describe("Một câu dưới 15 từ tả điều THẤY được; đoán thì mở bằng 'hình như'. Không suy diễn vật liệu/pháp lý."),
  giay_to: z.object({
    loai_giay: z.string().nullable().describe("'sổ hồng' / 'sổ đỏ' / 'hợp đồng mua bán' / 'giấy tờ khác'"),
    dien_tich_m2: z.number().nullable().describe("Diện tích ĐỌC ĐƯỢC trên giấy (m2), null nếu không thấy rõ"),
    dia_chi: z.string().nullable().describe("Địa chỉ thửa đất đọc được (đường, phường, quận), null nếu không rõ"),
    so_thua: z.string().nullable(),
    so_to: z.string().nullable(),
    ro_net: z.boolean().describe("true khi chữ trên giấy đọc được rõ"),
  }).nullable().describe("CHỈ điền khi loai = giay_to. TUYỆT ĐỐI không ghi tên người, số CCCD, ngày sinh."),
});
export type PhanLoaiAnh = z.infer<typeof AnhSchema>;

// Chuỗi này nằm trong system prompt để bộ e2e (mock model) nhận ra lượt phân
// loại ảnh và trả kịch bản ảnh thay vì kịch bản người mua. Đổi chữ thì đổi cả
// `bot/tests/e2e/run.mjs`.
export const DAU_HIEU_PHAN_LOAI_ANH = "PHÂN LOẠI ẢNH CHỦ NHÀ GỬI";
export const ANH_FORMAT = zodOutputFormat(AnhSchema);

type ModelLike = {
  messages: {
    parse: (p: unknown) => Promise<{ stop_reason?: string | null; parsed_output?: unknown; usage?: unknown }>;
  };
};

/**
 * Hỏi model một tấm ảnh là gì. Trả null khi model từ chối / trả rỗng — tầng gọi
 * quyết định cất ở đâu (không rõ thì cất RIÊNG TƯ, không phục vụ ai).
 */
export async function phanLoaiAnh(
  anthropic: ModelLike, model: string, imageUrl: string, boiCanh: string,
): Promise<{ kq: PhanLoaiAnh | null; usage: unknown }> {
  const resp = await anthropic.messages.parse({
    model,
    max_tokens: 400,
    output_config: { effort: "low", format: ANH_FORMAT },
    system: [{
      type: "text",
      text: `${DAU_HIEU_PHAN_LOAI_ANH}. Bạn là người soát ảnh của một văn phòng môi giới nhà đất Sài Gòn. ` +
        `Phân loại tấm ảnh chủ nhà vừa gửi và tả ngắn điều thấy được. Đoán thì nói "hình như". ` +
        `Ảnh giấy tờ: đọc diện tích, địa chỉ thửa, số thửa, số tờ nếu rõ; KHÔNG ghi tên người, CCCD, ngày sinh. ` +
        `Không suy diễn vật liệu, pháp lý hay tình trạng từ ảnh.`,
      cache_control: { type: "ephemeral" },
    }],
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "url", url: imageUrl } },
        { type: "text", text: `Ngữ cảnh tin rao: ${boiCanh || "(chưa có)"}. Tấm ảnh này là gì?` },
      ],
    }],
  });
  if (resp.stop_reason === "refusal" || !resp.parsed_output) return { kq: null, usage: resp.usage };
  const kq = resp.parsed_output as PhanLoaiAnh;
  if (!LOAI_ANH.includes(kq.loai)) return { kq: null, usage: resp.usage };
  return { kq, usage: resp.usage };
}

/** Diện tích trên sổ lệch với diện tích chủ nhà nói? Trả % lệch, null khi thiếu số. */
export function lechDienTich(soM2: number | null | undefined, noiM2: number | null | undefined): number | null {
  if (!soM2 || !noiM2 || soM2 <= 0 || noiM2 <= 0) return null;
  return Math.round(Math.abs(soM2 - noiM2) / noiM2 * 100);
}
