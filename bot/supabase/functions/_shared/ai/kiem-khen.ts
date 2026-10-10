// kiem-khen.ts — AI SOÁT LỜI NHẬN XÉT của bot với lời chủ nhà (01/10/2026).
//
// Bắn thử lx-tt-08: chủ nhà "ban nha 4x15 tret 2 lau 3pn hxh q10 gia 9ty" → bot "Nhà phố hẻm sâu, kết cấu 4x15 thì dễ bán
// lắm" — "hẻm sâu" chủ nhà không nói. Lưới cũ (`boKhenKhongCanCu`, `boMenhDeKhenSai`) là DANH SÁCH cặp cụm khen ↔ cụm bằng
// chứng viết tay: cụm khen mới ("hẻm sâu", "khu yên tĩnh"…) lọt cho tới khi có người thêm dòng. Chủ dự án 01/10: lỗi lớp
// từ khoá thì đưa quyết định sang AI, code kiểm trích dẫn. Ở đây AI liệt kê từng câu NHẬN XÉT kèm căn cứ chép nguyên văn từ
// lời chủ nhà; code (`nhanXetKhongCanCu`, van-tra-loi.ts) kiểm căn cứ có thật rồi mới giữ câu. Danh sách cũ vẫn chạy làm
// lưới đỡ khi AI hỏng.
// SRS-5.1zzzzj (bắn production 09/10/2026: "Dạ vâng, nhà hẻm xe hơi đường Phạm Văn Chiêu là khách chuộng lắm anh."): luật cũ cho qua
// lời khen "khách chuộng / dễ bán" khi gắn với một đặc điểm có thật — mà điều đó là đoán NGƯỜI MUA, bot không có số liệu. Nay lời nói
// về người mua / khả năng bán luôn là đánh giá thị trường (bỏ); câu lệnh giọng (TONE_RULES, SELLER_FEWSHOT) dạy cùng một điều — bài
// `bot/tests/luat-khong-mau-thuan.mjs` đỏ khi ví dụ trong câu lệnh lại dạy câu mà lượt soát này bỏ.
// Tầng này KHÔNG ghi DB (luật `bot/tests/ranh-gioi.mjs`). Model hỏng thì NÉM — nơi gọi ghi sổ (FR-152 d).
import { z } from "npm:zod@4";
import { dinhDangLong, docLong } from "./doc-long.ts";

const NhanXet = z.object({
  cau: z.string().describe("Câu hoặc vế NHẬN XÉT trong lời bot, COPY NGUYÊN VĂN (không sửa một chữ)."),
  khang_dinh: z.string().describe("Điều câu đó khẳng định về căn nhà / khu vực / khả năng bán (ngắn)."),
  can_cu: z.string().nullable().describe("Cụm COPY NGUYÊN VĂN trong LỜI CHỦ NHÀ hoặc THÔNG TIN ĐÃ GHI nói ĐÚNG điều đó. Không có thì null."),
  // SRS-5.1zzzzb: chỉ lượt soát lời gửi NGƯỜI MUA dùng ô này (nhánh bán luôn false).
  noi_co_hang: z.boolean().nullish().describe("true khi câu nói bên em CÓ / còn / đang có căn, đã tìm thấy căn, hay đang lọc / tìm căn cho khách (\"dạ có anh\", \"em đang lọc căn 2 lầu cho anh\", \"em tìm thấy mấy căn\"). Không thì false."),
  // SRS-5.1zzzzk: câu nói TRẠNG THÁI TIN — chủ là lưới trạng thái ở đường ra (đối chiếu DB), không phải lưới nhận xét.
  noi_trang_thai_tin: z.boolean().nullish().describe("true khi câu KHẲNG ĐỊNH tin / bài của chủ nhà đã đăng, đang rao, đã lên web / kệ / sóng, đã duyệt, đang có khách xem tin (\"em vừa đăng tin rồi ạ\", \"tin mình lên sóng rồi\", \"bài đang chạy rồi anh\"). Lời hứa có điều kiện (\"có giá là em đăng liền\") và câu hỏi → false."),
  danh_gia_thi_truong: z.boolean().describe("true khi câu ĐÁNH GIÁ giá trị / thị trường / khả năng bán của KHU VỰC hay MỨC GIÁ, không gắn với một đặc điểm của căn (\"đất vàng\", \"khu đó bán được lắm\", \"giá khu này đang lên\")."),
});
const KetSoat = z.object({ nhan_xet: z.array(NhanXet) });
export type NhanXetLLM = z.infer<typeof NhanXet>;
const FORMAT = dinhDangLong(KetSoat);

const LUAT = `SOÁT LỜI BOT GỬI CHỦ NHÀ — bot chỉ được nói về căn nhà những điều chủ nhà đã nói.
Đọc lời bot, liệt kê MỌI câu / vế KHẲNG ĐỊNH đặc điểm căn nhà hoặc khu vực, hay khen dựa trên một đặc điểm (hẻm sâu, ô tô vào tận
nhà, gần chợ, khu yên tĩnh, xuyên thoáng, nở hậu, kết cấu chắc, "… thì dễ bán lắm", "khách chuộng …").
- KHÔNG liệt kê: câu hỏi, lời chào, cảm ơn, ghi nhận chung ("dạ em ghi rồi ạ"), lời hứa của bot.
- LIỆT KÊ cả câu nói TRẠNG THÁI TIN ("em vừa đăng tin rồi ạ", "tin mình lên sóng rồi", "bài đang chạy") với noi_trang_thai_tin = true,
  can_cu = null — code đối chiếu trạng thái thật của tin.
- can_cu: cụm chép NGUYÊN VĂN từ LỜI CHỦ NHÀ hoặc THÔNG TIN ĐÃ GHI nói ĐÚNG điều được khẳng định — gần giống thì không tính
  ("hxh" là hẻm xe hơi, KHÔNG phải "hẻm sâu"; "4x15" không phải "nở hậu"). Không có thì null.
- danh_gia_thi_truong = true khi câu đánh giá KHU VỰC / THỊ TRƯỜNG / MỨC GIÁ ("khu Hà Huy Giáp đất vàng", "khu đó bán được lắm", "giá
  khu này đang lên", "quận 7 đang sốt") — bot không có số liệu thị trường nên câu đó luôn bị bỏ; tên khu chủ nhà nói KHÔNG phải căn
  cứ cho lời đánh giá về khu.
- danh_gia_thi_truong = true CẢ khi câu nói về NGƯỜI MUA hay KHẢ NĂNG BÁN của căn, dù gắn với một đặc điểm có thật ("hẻm xe hơi là
  khách chuộng lắm", "nở hậu lại sổ riêng, căn này dễ bán lắm", "mặt tiền thì bán nhanh", "đắt khách", "thanh khoản cao", "nhiều
  người tìm"): bot không có số liệu người mua — đặc điểm thật chỉ là căn cứ cho chính đặc điểm đó, không cho lời đoán thị trường.
- Khen chỉ nói đặc điểm có thật và lợi ích trực tiếp của nó ("ô tô tới tận nhà, đi lại tiện lắm", "sổ riêng thì giấy tờ gọn") là
  false — căn cứ là cụm chủ nhà nói về đặc điểm đó.`;

// SRS-5.1zzzza (bắn production 09/10/2026): người MUA "cần mua nhà quận 5 tầm 7 tỷ, hẻm xe hơi" → trợ lý "Hẻm xe hơi tới cửa là
// khách chuộng lắm, vị trí tốt lắm" — lời khen dành cho người BÁN về căn của họ, nói với người mua chưa có căn nào trong tay. Cùng
// lượt AI soát, đổi đối tượng: AI chỉ LIỆT KÊ câu nhận xét (đọc theo nghĩa); nơi gọi quyết (không căn nào trong tay → bỏ hết).
const LUAT_MUA = `SOÁT LỜI BOT GỬI NGƯỜI MUA / THUÊ — bot CHƯA đưa căn nào cho khách xem; điều khách nói là TIÊU CHÍ TÌM, chưa phải một căn.
Đọc lời bot, liệt kê MỌI câu / vế NHẬN XÉT hay KHEN về nhà, đặc điểm nhà, tiêu chí khách đặt, khu vực, mức giá hay thị trường
("hẻm xe hơi tới cửa là khách chuộng lắm", "vị trí tốt lắm", "mặt tiền đắt khách", "khu này giá đang lên", "tầm giá đó dễ mua").
- Liệt kê CẢ câu nói có hàng / đang có căn / đã tìm thấy / đang lọc căn cho khách ("dạ có anh", "dạ còn chị", "em đang lọc căn 2 lầu
  cho anh", "em tìm thấy mấy căn hợp tầm giá") với noi_co_hang = true — bot chưa có căn nào nên câu đó sai.
- KHÔNG liệt kê: câu hỏi, lời chào, ghi nhận chung ("dạ em ghi nhận rồi anh"), câu nói thật là chưa có căn.
- can_cu: luôn null (người mua chưa có căn nào để làm căn cứ).
- danh_gia_thi_truong = true khi câu đánh giá KHU VỰC / THỊ TRƯỜNG / MỨC GIÁ.`;

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
  doiTuong: "chu_nha" | "nguoi_mua" = "chu_nha",
): Promise<{ nhanXet: NhanXetLLM[]; usage: unknown }> {
  const r = await ai.messages.parse({
    model,
    max_tokens: 500,
    output_config: { effort: "low", format: FORMAT },
    system: [{ type: "text", text: doiTuong === "nguoi_mua" ? LUAT_MUA : LUAT, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: `${doiTuong === "nguoi_mua" ? "LỜI KHÁCH MUA" : "LỜI CHỦ NHÀ"}:\n${loiChuNha.slice(-1500)}\n${daGhi ? `THÔNG TIN ĐÃ GHI:\n${daGhi.slice(0, 600)}\n` : ""}LỜI BOT:\n${loiBot.slice(0, 800)}`,
    }],
  });
  const k = docLong(KetSoat, r.parsed_output);
  return { nhanXet: k.success ? k.data.nhan_xet : [], usage: r.usage };
}
