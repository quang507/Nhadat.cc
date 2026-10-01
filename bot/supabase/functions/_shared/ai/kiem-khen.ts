// kiem-khen.ts — AI SOÁT LỜI NHẬN XÉT của bot với lời chủ nhà (01/10/2026).
//
// Bắn thử lx-tt-08: chủ nhà "ban nha 4x15 tret 2 lau 3pn hxh q10 gia 9ty" → bot "Nhà phố hẻm sâu, kết cấu 4x15 thì dễ bán
// lắm" — "hẻm sâu" chủ nhà không nói. Lưới cũ (`boKhenKhongCanCu`, `boMenhDeKhenSai`) là DANH SÁCH cặp cụm khen ↔ cụm bằng
// chứng viết tay: cụm khen mới ("hẻm sâu", "khu yên tĩnh"…) lọt cho tới khi có người thêm dòng. Chủ dự án 01/10: lỗi lớp
// từ khoá thì đưa quyết định sang AI, code kiểm trích dẫn. Ở đây AI liệt kê từng câu NHẬN XÉT kèm căn cứ chép nguyên văn từ
// lời chủ nhà; code (`nhanXetKhongCanCu`, van-tra-loi.ts) kiểm căn cứ có thật rồi mới giữ câu. Danh sách cũ vẫn chạy làm
// lưới đỡ khi AI hỏng.
// Tầng này KHÔNG ghi DB (luật `bot/tests/ranh-gioi.mjs`). Model hỏng thì NÉM — nơi gọi ghi sổ (FR-152 d).
import { z } from "npm:zod@4";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";

const NhanXet = z.object({
  cau: z.string().describe("Câu hoặc vế NHẬN XÉT trong lời bot, COPY NGUYÊN VĂN (không sửa một chữ)."),
  khang_dinh: z.string().describe("Điều câu đó khẳng định về căn nhà / khu vực / khả năng bán (ngắn)."),
  can_cu: z.string().nullable().describe("Cụm COPY NGUYÊN VĂN trong LỜI CHỦ NHÀ hoặc THÔNG TIN ĐÃ GHI nói ĐÚNG điều đó. Không có thì null."),
});
const KetSoat = z.object({ nhan_xet: z.array(NhanXet) });
export type NhanXetLLM = z.infer<typeof NhanXet>;
const FORMAT = zodOutputFormat(KetSoat);

const LUAT = `SOÁT LỜI BOT GỬI CHỦ NHÀ — bot chỉ được nói về căn nhà những điều chủ nhà đã nói.
Đọc lời bot, liệt kê MỌI câu / vế KHẲNG ĐỊNH đặc điểm căn nhà hoặc khu vực, hay khen dựa trên một đặc điểm (hẻm sâu, ô tô vào tận
nhà, gần chợ, khu yên tĩnh, xuyên thoáng, nở hậu, kết cấu chắc, "… thì dễ bán lắm", "khách chuộng …").
- KHÔNG liệt kê: câu hỏi, lời chào, cảm ơn, ghi nhận chung ("dạ em ghi rồi ạ"), lời hứa của bot.
- can_cu: cụm chép NGUYÊN VĂN từ LỜI CHỦ NHÀ hoặc THÔNG TIN ĐÃ GHI nói ĐÚNG điều được khẳng định — gần giống thì không tính
  ("hxh" là hẻm xe hơi, KHÔNG phải "hẻm sâu"; "4x15" không phải "nở hậu"). Không có thì null.
- Khen chung ("dễ bán lắm", "khách chuộng") gắn với một đặc điểm: căn cứ là căn cứ của đặc điểm đó.`;

type ClientModel = {
  messages: {
    parse: (p: Record<string, unknown>) => Promise<{ parsed_output?: unknown; usage?: unknown }>;
  };
};

/** AI liệt kê câu nhận xét trong `loiBot` kèm căn cứ. Kết quả THÔ — đưa qua `nhanXetKhongCanCu` (van-tra-loi.ts). */
export async function soatNhanXetBangModel(
  ai: ClientModel,
  model: string,
  loiBot: string,
  loiChuNha: string,
  daGhi = "",
): Promise<{ nhanXet: NhanXetLLM[]; usage: unknown }> {
  const r = await ai.messages.parse({
    model,
    max_tokens: 500,
    output_config: { effort: "low", format: FORMAT },
    system: [{ type: "text", text: LUAT, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: `LỜI CHỦ NHÀ:\n${loiChuNha.slice(-1500)}\n${daGhi ? `THÔNG TIN ĐÃ GHI:\n${daGhi.slice(0, 600)}\n` : ""}LỜI BOT:\n${loiBot.slice(0, 800)}`,
    }],
  });
  const k = KetSoat.safeParse(r.parsed_output);
  return { nhanXet: k.success ? k.data.nhan_xet : [], usage: r.usage };
}
