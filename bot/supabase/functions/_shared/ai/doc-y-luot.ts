// Ý NGẮN CỦA LƯỢT (02/10/2026, SRS-5.1zf) — một lượt AI NHỎ, chạy SONG SONG với lượt bóc tách, đọc lời chủ nhà theo NGHĨA:
// gật / không đồng ý / gật và bảo đăng. Trước đây do từ khoá quyết (`laDongY`, `laBaoDang`, regex "đúng rồi|ok").
//
// Vì sao tách khỏi `boc-rao.ts`: khuôn structured output của lượt bóc tách đã sát giới hạn grammar của Anthropic — #414 thêm
// MỘT ô là mọi lượt trả 400 "The compiled grammar is too large", AI không chạy, bot rơi về luật. Ý về HỘI THOẠI (không phải dữ
// liệu căn nhà) đi đường này; các đợt bỏ luật sau (xưng hô, hoãn, lời hứa, yêu cầu meta…) thêm trường ở ĐÂY.
//
// Tầng này KHÔNG ghi DB (luật `bot/tests/ranh-gioi.mjs`). Model hỏng thì NÉM — nơi gọi ghi sổ và dùng luật làm lưới đỡ.
import { z } from "npm:zod@4";
import { dinhDangLong, docLong } from "./doc-long.ts";

export const DONG_Y = ["dong_y", "dong_y_dang", "khong_dong_y", "khong_noi"] as const;
const YLuot = z.object({
  dong_y: z.enum(DONG_Y).describe("dong_y = GẬT / đồng ý / xác nhận điều bot VỪA nói; dong_y_dang = gật VÀ bảo đăng tin; khong_dong_y = nói không đúng / không đồng ý; khong_noi = không gật cũng không chối (chỉ đưa thông tin, hỏi lại, nói chuyện khác)."),
  dong_y_trich: z.string().nullable().describe("Cụm COPY NGUYÊN VĂN trong tin chủ nhà thể hiện ý ở dong_y. khong_noi thì null."),
});
const FORMAT_Y_LUOT = dinhDangLong(YLuot);

const LUAT = `Ý NGẮN CỦA LƯỢT — bạn đọc câu BOT VỪA NÓI với chủ nhà (người bán bất động sản) và TIN chủ nhà vừa nhắn, cho biết tin đó
có GẬT với điều bot vừa nói không. Đọc theo NGHĨA, có viết tắt, không dấu, tiếng lóng, emoji:
- dong_y: "ừ", "ừa", "ok e", "oke", "đúng rồi", "chuẩn rồi", "phải", "được em", "vậy cũng được", "ổn áp", "chốt", "👍" — đồng ý với câu
  bot hỏi / gợi ý (phường, tên đường, nghĩa chữ viết tắt), với bản nháp tin, hoặc với lời hẹn của bot.
- dong_y_dang: gật VÀ bảo đăng tin: "ok đăng đi", "cứ đăng như này trước", "triển luôn em", "lên tin luôn".
- khong_dong_y: "không phải", "sai rồi", "không đúng", "chưa", "khoan đã".
- khong_noi: tin chỉ đưa thông tin căn nhà, hỏi lại bot, kể chuyện khác, hoặc không rõ.
Gật ở VẾ ĐẦU rồi nói thêm ("đúng rồi em, phường 2 quận 5"; "ok em, mà giá 9 tỷ 8") vẫn là dong_y — trích đúng cụm gật.
dong_y_trich phải chép NGUYÊN VĂN từ TIN chủ nhà, không lấy từ câu bot.`;

type ClientModel = {
  messages: {
    parse: (p: Record<string, unknown>) => Promise<{ parsed_output?: unknown; usage?: unknown }>;
  };
};
export type YLuotLLM = { la: typeof DONG_Y[number]; trich_dan: string | null; dang_di: boolean };

/** Hỏi model ý ngắn của lượt. `ket` null = model trả không đọc được (nơi gọi coi như AI không chạy). Model hỏng thì NÉM. */
export async function docYLuotBangModel(
  ai: ClientModel,
  model: string,
  tin: string,
  botVuaNoi: string | null,
): Promise<{ ket: YLuotLLM | null; usage: unknown }> {
  const r = await ai.messages.parse({
    model,
    max_tokens: 150,
    output_config: { effort: "low", format: FORMAT_Y_LUOT },
    system: [{ type: "text", text: LUAT, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: `${botVuaNoi?.trim() ? `Câu BOT vừa nói: "${botVuaNoi.trim().slice(0, 600)}"\n` : ""}Tin chủ nhà: "${(tin ?? "").slice(0, 1500)}"`,
    }],
  });
  const k = docLong(YLuot, r.parsed_output);
  const ket = k.success
    ? { la: k.data.dong_y === "dong_y_dang" ? "dong_y" : k.data.dong_y, trich_dan: k.data.dong_y_trich ?? null, dang_di: k.data.dong_y === "dong_y_dang" } as YLuotLLM
    : null;
  return { ket, usage: r.usage };
}
