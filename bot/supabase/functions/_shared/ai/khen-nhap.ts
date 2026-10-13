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
  // SRS-5.1zzzzzr (chủ dự án 13/10/2026: "Tiêu đề nên hoa văn tí"): AI viết tiêu đề, code kiểm số + chữ cấm (`tieuDeHopLe`), không qua thì giữ tiêu đề máy.
  tieu_de: z.string().nullable().optional().describe("MỘT tiêu đề rao hấp dẫn ≤ 90 ký tự: mở bằng \"Chỉ <giá>\" đúng giá trong bản tin, rồi 1–2 điểm mạnh có trong bản tin bằng lời mời gọi vừa phải, kết bằng khu vực (\"Chỉ 3,9 tỷ sở hữu ngay nhà cấp 4 hẻm xe hơi, sân rộng tại Đông Thạnh, Hóc Môn\"). Không con số ngoài bản tin, không nói thị trường / sinh lời / dễ bán, không hứa, không tiếng Anh, không chấm than. Không viết được → null."),
  dua_tren: z.array(z.string()).describe("Các cụm COPY NGUYÊN VĂN từ BẢN TIN mà câu khen nhắc tới (mỗi điểm mạnh một cụm)."),
  // SRS-5.1zzzzzn: xếp ý thêm vào dòng "Quy mô" theo NGHĨA (không dò từ khoá) — cùng lượt model này, không thêm lượt gọi.
  // SRS-5.1zzzzzo ("tiện ích phải gom vào đúng tiện ích"): ý thêm nói về xung quanh căn → dòng 🏫 Tiện ích. Cùng lượt model.
  tien_ich: z.array(z.string()).optional().describe("Trong danh sách Ý THÊM: các ý nói về TIỆN ÍCH / XUNG QUANH căn (gần chợ, trường, bệnh viện, công viên, siêu thị, khu dân cư, cách đường lớn bao xa, an ninh khu). Chép NGUYÊN VĂN từng ý như trong danh sách. Ý về bên trong căn, tình trạng, pháp lý → không đưa. Không có → []."),
  quy_mo: z.array(z.string()).optional().describe("Trong danh sách Ý THÊM: các ý nói về QUY MÔ / KHÔNG GIAN của căn (phòng, bếp, phòng khách, sân, sân thượng, ban công, gara, kho, độ rộng không gian bên trong). Chép NGUYÊN VĂN từng ý như trong danh sách. Ý về vị trí, tiện ích quanh nhà, tình trạng, pháp lý → không đưa. Không có → []."),
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
- quy_mo: xếp riêng (không liên quan câu khen) — trong danh sách Ý THÊM, ý nào nói về quy mô / không gian bên trong căn (bếp, phòng khách, sân rộng,
  sân thượng…) thì chép nguyên văn vào quy_mo; ý về vị trí, tiện ích quanh nhà, tình trạng nhà thì không.
- tien_ich: xếp riêng — ý nào nói về xung quanh căn (gần chợ / trường / công viên, khu dân cư, cách đường lớn…) thì chép nguyên văn vào tien_ich.
  Một ý chỉ vào MỘT trong hai danh sách.
- tieu_de: viết lại dòng tiêu đề (dòng 2 của bản tin, mở bằng "Chỉ <giá>") cho hấp dẫn hơn một chút — cùng giá, cùng điểm mạnh, cùng khu
  vực có trong bản tin; thêm lời mời gọi vừa phải ("sở hữu ngay", "nhà xinh", "ngay"), KHÔNG thêm điểm mạnh / con số / nhận định mới.
Bản tin không có điểm mạnh nào để nhắc → khen = null.`;

type ClientModel = {
  messages: { parse: (p: Record<string, unknown>) => Promise<{ parsed_output?: unknown; usage?: unknown }> };
};

/** Hỏi model câu khen. Kết quả THÔ — đưa qua `khenHopLe`. Model hỏng thì NÉM. */
export async function vietKhenNhapBangModel(
  ai: ClientModel, model: string, banTin: string, cachGoi: string, yThem: string[] = [],
): Promise<{ khen: string | null; duaTren: string[]; quyMo: string[]; tienIch: string[]; tieuDe: string | null; usage: unknown }> {
  const r = await ai.messages.parse({
    model,
    max_tokens: 300,
    output_config: { effort: "low", format: FORMAT },
    system: [{ type: "text", text: LUAT_KHEN, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Cách gọi chủ nhà: "${cachGoi}"\nBẢN TIN:\n${banTin.slice(0, 2500)}\nÝ THÊM:\n${yThem.length ? yThem.map((y) => `- ${y}`).join("\n") : "(không có)"}` }],
  });
  const k = docLong(KhenNhap, r.parsed_output);
  return { khen: k.success ? k.data.khen : null, duaTren: k.success ? k.data.dua_tren : [], quyMo: k.success ? k.data.quy_mo ?? [] : [], tienIch: k.success ? k.data.tien_ich ?? [] : [], tieuDe: k.success ? k.data.tieu_de ?? null : null, usage: r.usage };
}
