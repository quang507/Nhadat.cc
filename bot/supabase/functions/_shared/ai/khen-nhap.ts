// khen-nhap.ts — AI VIẾT MỘT CÂU KHEN dưới bản nháp tin rao (13/10/2026, SRS-5.1zzzzzl).
//
// Chủ dự án (test Zalo 13/10): "Tin nháp phải có khen nữa" — chọn "AI viết, có soát". Bản nháp do code dựng từ cột + fact (không
// model), nên câu khen là lượt model riêng, đọc ĐÚNG bản tin vừa dựng. Code kiểm (`khenHopLe`): mọi cụm lời khen dựa vào phải chép
// nguyên văn từ bản tin, không con số nào ngoài bản tin, không câu hỏi (extraction/khen-hop-le.ts — chạy được offline); rồi lượt soát nhận xét chung (`soatNhanXet`, kiem-khen.ts) đọc
// lại — soát bỏ bất kỳ vế nào thì bỏ cả câu khen. Model hỏng / không qua kiểm → bản nháp không có câu khen (không câu mẫu thay thế).
// Tầng này KHÔNG ghi DB (luật `bot/tests/ranh-gioi.mjs`). Model hỏng thì NÉM — nơi gọi ghi sổ (FR-152 d).
import { z } from "npm:zod@4";
import { dinhDangLong, docLong } from "./doc-long.ts";

const KhenNhap = z.object({
  khen: z.string().nullable().describe("MỘT câu khen, ≤ 30 chữ, không câu hỏi. Không viết được câu đúng luật → null."),
  dua_tren: z.array(z.string()).describe("Các cụm COPY NGUYÊN VĂN từ BẢN TIN mà câu khen nhắc tới (mỗi điểm mạnh một cụm)."),
});
const FORMAT = dinhDangLong(KhenNhap);

export const LUAT_KHEN = `VIẾT CÂU KHEN BẢN NHÁP — em là trợ lý môi giới vừa soạn xong bản tin rao cho chủ nhà. Viết MỘT câu khen ngắn, ấm áp
gửi chủ nhà, đặt ngay dưới bản tin.
- Khen CÁCH CHỦ NHÀ GIỚI THIỆU căn (rõ ràng, chi tiết, đầy đủ) và NHẮC LẠI 2–3 điểm mạnh chủ nhà đã nêu, dùng ĐÚNG CHỮ trong bản tin
  ("ô tô tận cửa", "mặt tiền 6m", "gần trường mầm non, chợ"). Ví dụ: "Căn mình ô tô tận cửa, mặt tiền 6m lại gần trường, chợ, anh
  giới thiệu chi tiết quá ạ."
- KHÔNG gắn thêm lợi ích hay tính chất bản tin không có ("đi lại tiện", "kết cấu chắc", "rộng rãi", "yên tĩnh").
- KHÔNG đoán người mua, khả năng bán, giá, thị trường ("dễ bán", "khách chuộng", "giá tốt", "đáng tiền", "đắt khách").
- KHÔNG chấm căn tốt / xấu / vừa, KHÔNG con số nào ngoài bản tin, KHÔNG hỏi, KHÔNG hứa, KHÔNG tiếng Anh, không gạch ngang dài.
- Gọi chủ nhà đúng cách gọi được đưa; em xưng "em".
- dua_tren: mỗi điểm mạnh câu khen nhắc tới là một cụm chép NGUYÊN VĂN từ bản tin.
Bản tin không có điểm mạnh nào để nhắc → khen = null.`;

type ClientModel = {
  messages: { parse: (p: Record<string, unknown>) => Promise<{ parsed_output?: unknown; usage?: unknown }> };
};

/** Hỏi model câu khen. Kết quả THÔ — đưa qua `khenHopLe`. Model hỏng thì NÉM. */
export async function vietKhenNhapBangModel(
  ai: ClientModel, model: string, banTin: string, cachGoi: string,
): Promise<{ khen: string | null; duaTren: string[]; usage: unknown }> {
  const r = await ai.messages.parse({
    model,
    max_tokens: 200,
    output_config: { effort: "low", format: FORMAT },
    system: [{ type: "text", text: LUAT_KHEN, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Cách gọi chủ nhà: "${cachGoi}"\nBẢN TIN:\n${banTin.slice(0, 2500)}` }],
  });
  const k = docLong(KhenNhap, r.parsed_output);
  return { khen: k.success ? k.data.khen : null, duaTren: k.success ? k.data.dua_tren : [], usage: r.usage };
}
