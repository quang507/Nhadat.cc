// FR-208 — MODEL ĐỀ XUẤT bóc tách tin nhắn người bán, KÈM TRÍCH DẪN (14/09/2026).
//
// Model chỉ được NÓI "trường X = giá trị Y, bằng chứng là cụm Z trong tin". Có đúng hay
// không là việc của `_shared/extraction/kiem-bang-chung.ts` (tiền định). Bước 1 chạy BÓNG:
// kết quả chỉ vào `boc_tach_bong` để đo, chưa ghi tin rao.
// Tầng này KHÔNG ghi DB (luật `bot/tests/ranh-gioi.mjs`).
import { z } from "npm:zod@4";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { MOI_KHOA, type DeXuat } from "../extraction/kiem-bang-chung.ts";
import { viDuThanhChu } from "./vi-du-boc-rao.ts";

const TruongBoc = z.object({
  khoa: z.enum(MOI_KHOA),
  gia_tri: z.string().describe("Giá trị như khách nói. Số thì chỉ số + đơn vị ('32 tỷ', '62.5', '2.5'). Loại/enum theo danh sách trong câu lệnh."),
  trich_dan: z.string().describe("Cụm chữ COPY NGUYÊN VĂN từ tin nhắn khách chứng minh giá trị — không sửa, không thêm, không ghép hai chỗ xa nhau."),
  can: z.number().int().nullable().describe("Tin rao NHIỀU căn: căn số mấy (1, 2…). Một căn thì null."),
});
// FR-224 (25/09/2026, chủ dự án: "đừng bắt theo từ nữa, bắt theo nguyên cả câu của khách để AI đọc lại"): AI đọc NGUYÊN
// tin và trả lời thẳng câu bot đang hỏi — không phải điền ô theo từ khoá. Code kiểm trích dẫn + con số (`kiemTraLoiCau`).
const TraLoiCau = z.object({
  co_tra_loi: z.boolean().describe("Tin có TRẢ LỜI câu bot vừa hỏi không — đọc theo NGHĨA cả câu, không theo từ khoá. Không có câu đang hỏi, khách nói chuyện khác, hỏi lại, hẹn trả lời sau → false."),
  gia_tri: z.string().nullable().describe("Câu trả lời VIẾT GỌN, ĐỦ Ý, có dấu, bỏ từ đệm, đúng ý khách, không thêm điều khách không nói. co_tra_loi = false thì null."),
  trich_dan: z.string().nullable().describe("Cụm COPY NGUYÊN VĂN từ tin chứa câu trả lời. co_tra_loi = false thì null."),
});
const DeXuatRao = z.object({
  so_can: z.number().int().describe("Số căn / lô KHÁC NHAU chủ nhà rao trong tin này. Không rao căn nào (chỉ bổ sung, trả lời) thì 0."),
  truong: z.array(TruongBoc),
  // 17/09/2026 (chủ dự án): "AI có thể thêm trường kiến thức… các trường khách nói bổ sung sẽ ghi vào mô tả".
  kien_thuc: z.array(z.string()).describe("Ý KHÁC chủ nhà nói về căn nhà mà không thuộc khoá nào ở trên (gần chợ, khu an ninh, mới sơn sửa, có gác…): mỗi ý một cụm ngắn COPY NGUYÊN VĂN từ tin (≤ 12 chữ). Không có thì []."),
  tra_loi: TraLoiCau,
});
// Đọc kết quả: `tra_loi` có thể thiếu (bản model cũ / mock e2e) — thiếu thì coi như AI không nói, không hỏng cả lượt.
const DeXuatRaoDoc = DeXuatRao.extend({ tra_loi: TraLoiCau.nullish() });
export type TraLoiCauLLM = z.infer<typeof TraLoiCau>;
export type DeXuatRaoLLM = z.infer<typeof DeXuatRaoDoc>;
const FORMAT_RAO = zodOutputFormat(DeXuatRao);

const LUAT = `BÓC TÁCH TIN NHẮN NGƯỜI BÁN BẤT ĐỘNG SẢN — CHỈ ĐIỀU KHÁCH NÓI.
Bạn đọc MỘT tin nhắn của chủ nhà / môi giới (rao căn mới, hoặc trả lời câu bot vừa hỏi, hoặc sửa lời) và liệt kê từng thông tin CÓ TRONG TIN.

LUẬT CỨNG (code kiểm từng trường, sai là bị bỏ):
1. Mỗi trường phải có "trich_dan" là cụm chữ COPY NGUYÊN VĂN trong tin. Không có cụm nào nói thẳng → KHÔNG đưa trường đó.
2. Không suy luận, không đoán, không lấy kiến thức ngoài: không tự điền quận từ tên đường/dự án, không tự đổi "3 tấm" thành số tầng khác, không tự tính diện tích nếu khách không nói diện tích hoặc ngang×dài.
3. Giá trị phải đọc ra được từ chính cụm trích: tiền "32 tỷ" thì cụm phải có "32 tỷ".
4. Tiền cọc, phí sang nhượng, hoa hồng, tiền thuê ĐANG THU của căn bán KHÔNG phải "gia". Tiền thuê đang thu → "thu_nhap_thue". Cọc → "tien_coc".
5. Sửa lời ("à nhầm, 6 tỷ 5 nha", "là đất trống chứ không phải nhà") → chỉ đưa giá trị MỚI, trích đúng cụm giá trị mới.
6. Tin rao nhiều căn → điền "can" cho từng trường.

KHOÁ:
- loai_giao_dich: "ban" | "cho_thue". "Sang nhượng mặt bằng / quán" là cho_thue; "sang nhượng căn hộ / nhà" là ban. Tin không nói bán hay thuê thì KHÔNG đưa.
- loai_bds: chung_cu | nha_pho | nha_cap4 | dat | biet_thu | phong_tro | mat_bang | toa_nha | dat_nong_nghiep | dat_kinh_doanh | kho_xuong. "Đất nền KDC" là dat.
- gia (giá bán; tin cho thuê thì giá thuê), gia_m2, tien_coc, thu_nhap_thue (CHỈ tiền thuê căn BÁN đang thu). Giá trị tiền LUÔN kèm đơn vị như khách viết: "5 tỷ 2", "3 tỷ 150", "900 triệu", "95 triệu/m2" — không viết số trần "5.2".
- dien_tich (m²), ngang, dai, no_hau (m), do_rong_hem, do_rong_duong, cach_mat_tien (m): trong "truong" chỉ con số (hẻm xe hơi không có số mét thì không đưa vào truong — nhưng VẪN là câu trả lời câu hẻm ở "tra_loi").
- so_phong_ngu, so_wc; so_tang = TỔNG số tầng tính CẢ TRỆT, không tính lửng/sân thượng ("1 trệt 2 lầu" = 3, "trệt 3 lầu" = 4, "3 tấm" = 3); tang = căn hộ nằm tầng mấy.
- quan: ghi đủ "Quận 5", "Quận Phú Nhuận", "Huyện Bình Chánh", "TP Thủ Đức". phuong, duong, ma_can.
- du_an: tên dự án / khu dân cư / chung cư. Tên phường, tên khu vực (Thảo Điền, An Phú) KHÔNG phải dự án.
- huong: chỉ phương (Đông, Tây Nam…); "view sông" là view.
- phap_ly: giấy tờ (sổ hồng riêng, sổ chung, vi bằng, hoàn công; "chưa có sổ", "đang chờ sổ", "hợp đồng mua bán" cũng là câu trả lời pháp lý — ghi đúng chữ khách). "Thổ cư" không phải pháp lý.
- noi_that, ly_do_ban (lý do CẦN bán, không phải "gấp"), ket_cau (trệt/lầu/lửng/hầm), thoi_han_thue (CHỈ tin cho thuê; tin bán có hợp đồng thuê thì hạn hợp đồng vào kien_thuc), phi_quan_ly, view, hien_trang: chữ — giá trị là cụm ngắn NẰM TRONG trích dẫn.
- gap, thuong_luong: "co" | "khong". Hoa hồng môi giới KHÔNG phải thương lượng.
- kien_thuc: ý khác về CĂN NHÀ không có khoá (tiện ích gần, an ninh, tình trạng, đồ để lại, lịch sử…) — cụm ngắn CHÉP NGUYÊN VĂN; KHÔNG đặt nhãn diễn giải ("tiềm năng kinh doanh", "phù hợp đầu tư", "dòng tiền tốt", "khai thác thương mại") khi khách không nói đúng chữ đó; KHÔNG đưa lời chào, câu hỏi, chuyện riêng của chủ nhà, và không lặp ý đã có khoá.
Không có gì đáng bóc (chào, cảm ơn, hỏi lại) → truong = [], kien_thuc = [].
- Mọi trường CHỮ (pháp lý, nội thất, hiện trạng, kết cấu, hướng, lý do bán, view, thời hạn thuê…) viết lại SẠCH: có dấu, đúng chính tả, viết hoa tên riêng, bỏ từ đệm ("nha", "nhé", "á", "ạ"), giữ đúng ý và đúng chữ cái của cụm trích — KHÔNG thêm ý, không đổi từ.
- Khách gõ KHÔNG DẤU thì TÊN RIÊNG (đường, phường, dự án, quận) viết lại CÓ DẤU đúng chính tả tên thật ("pham the hien" → "Phạm Thế Hiển", "thu duc" → "Thủ Đức"); cụm trích dẫn vẫn COPY nguyên văn không dấu. Không chắc tên thật thì giữ nguyên chữ khách gõ. KHÔNG đổi chữ cái, chỉ thêm dấu.
- "Hẻm xe hơi / xe tải / ba gác" không phải hien_trang. "bớt / giảm N", "bao phí" là mức giảm, không phải gia. Số có "m2" là dien_tich, không phải dai. Lời hứa ("để em xem lại rồi báo"), lời chào, câu hỏi → không vào kien_thuc.

TRẢ LỜI CÂU ĐANG HỎI ("tra_loi") — đọc NGUYÊN tin theo NGHĨA, như người môi giới đọc tin khách, KHÔNG bắt theo từ khoá:
- Tin trả lời được câu bot vừa hỏi → co_tra_loi = true; gia_tri = câu trả lời gọn, đủ ý, viết lại sạch có dấu (hỏi hẻm, khách "hxh" → "hẻm xe hơi"; "ô tô vô tận nhà" → "hẻm xe hơi vào tận nhà"; "hẻm 3m, xe hơi không vào" → "hẻm 3m, xe hơi không vào được"; hỏi pháp lý, "shr" → "sổ hồng riêng"; "chưa có sổ đang chờ" → "chưa có sổ, đang chờ ra sổ"; câu có/không thì viết đủ ý theo câu hỏi: hỏi gấp không, khách "ừ có" → "có, cần bán gấp", "thôi từ từ" → "không gấp"); trich_dan = cụm nguyên văn.
- Tin trả lời câu KHÁC, hỏi ngược, hẹn trả lời sau, nói chung chung không có câu trả lời → co_tra_loi = false, gia_tri = null, trich_dan = null. Không có câu đang hỏi → cũng false.
- gia_tri không thêm điều khách không nói; MỌI con số trong gia_tri phải có trong tin (không đổi "trệt 2 lầu" thành "3 tầng", không đổi đơn vị tiền).

VÍ DỤ MẪU (đáp án đúng — chỉ học CÁCH bóc, giá trị phải lấy từ tin của khách, không lấy từ ví dụ):

` + viDuThanhChu();

type ClientModel = {
  messages: {
    parse: (p: Record<string, unknown>) => Promise<{ parsed_output?: unknown; usage?: unknown }>;
  };
};

/**
 * Hỏi model bóc tin người bán. `cauDangHoi` = khoá câu bot vừa hỏi (để "5 tỷ 8" biết là
 * trả lời giá) — KHÔNG đưa dữ liệu tin rao cũ vào, kẻo model chép từ ngữ cảnh thay vì
 * từ tin khách. Model hỏng thì NÉM — nơi gọi ghi sổ (FR-152 d), không nuốt ở đây.
 */
export async function bocRaoBangModel(
  ai: ClientModel,
  model: string,
  text: string,
  cauDangHoi: string | null = null,
  cauHoiChu: string | null = null,
): Promise<{ ket: DeXuatRaoLLM | null; truong: DeXuat[]; kienThuc: string[]; traLoi: TraLoiCauLLM | null; usage: unknown }> {
  const r = await ai.messages.parse({
    model,
    max_tokens: 1100,
    output_config: { effort: "low", format: FORMAT_RAO },
    system: [{ type: "text", text: LUAT, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: `${cauDangHoi ? `Câu bot vừa hỏi chủ nhà: ${cauDangHoi}${cauHoiChu ? ` — "${cauHoiChu.slice(0, 300)}"` : ""}\n` : ""}Tin nhắn chủ nhà: "${text.slice(0, 1200)}"`,
    }],
  });
  const ket = DeXuatRaoDoc.safeParse(r.parsed_output);
  return {
    ket: ket.success ? ket.data : null,
    truong: ket.success ? ket.data.truong.map((t) => ({ ...t })) : [],
    kienThuc: ket.success ? ket.data.kien_thuc.filter((k) => typeof k === "string") : [],
    traLoi: ket.success ? ket.data.tra_loi ?? null : null,
    usage: r.usage,
  };
}
