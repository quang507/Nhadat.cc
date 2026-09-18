// FR-208 — MODEL ĐỀ XUẤT bóc tách tin nhắn người bán, KÈM TRÍCH DẪN (14/09/2026).
//
// Model chỉ được NÓI "trường X = giá trị Y, bằng chứng là cụm Z trong tin". Có đúng hay
// không là việc của `_shared/extraction/kiem-bang-chung.ts` (tiền định). Bước 1 chạy BÓNG:
// kết quả chỉ vào `boc_tach_bong` để đo, chưa ghi tin rao.
// Tầng này KHÔNG ghi DB (luật `bot/tests/ranh-gioi.mjs`).
import { z } from "npm:zod@4";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { MOI_KHOA, type DeXuat } from "../extraction/kiem-bang-chung.ts";

const TruongBoc = z.object({
  khoa: z.enum(MOI_KHOA),
  gia_tri: z.string().describe("Giá trị như khách nói. Số thì chỉ số + đơn vị ('32 tỷ', '62.5', '2.5'). Loại/enum theo danh sách trong câu lệnh."),
  trich_dan: z.string().describe("Cụm chữ COPY NGUYÊN VĂN từ tin nhắn khách chứng minh giá trị — không sửa, không thêm, không ghép hai chỗ xa nhau."),
  can: z.number().int().nullable().describe("Tin rao NHIỀU căn: căn số mấy (1, 2…). Một căn thì null."),
});
const DeXuatRao = z.object({
  so_can: z.number().int().describe("Số căn / lô KHÁC NHAU chủ nhà rao trong tin này. Không rao căn nào (chỉ bổ sung, trả lời) thì 0."),
  truong: z.array(TruongBoc),
  // 17/09/2026 (chủ dự án): "AI có thể thêm trường kiến thức… các trường khách nói bổ sung sẽ ghi vào mô tả".
  kien_thuc: z.array(z.string()).describe("Ý KHÁC chủ nhà nói về căn nhà mà không thuộc khoá nào ở trên (gần chợ, khu an ninh, mới sơn sửa, có gác…): mỗi ý một cụm ngắn COPY NGUYÊN VĂN từ tin (≤ 12 chữ). Không có thì []."),
});
export type DeXuatRaoLLM = z.infer<typeof DeXuatRao>;
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
- dien_tich (m²), ngang, dai, no_hau (m), do_rong_hem, do_rong_duong, cach_mat_tien (m): chỉ con số. "Hẻm xe hơi", "hẻm ba gác" KHÔNG phải độ rộng.
- so_phong_ngu, so_wc; so_tang = TỔNG số tầng tính CẢ TRỆT, không tính lửng/sân thượng ("1 trệt 2 lầu" = 3, "trệt 3 lầu" = 4, "3 tấm" = 3); tang = căn hộ nằm tầng mấy.
- quan: ghi đủ "Quận 5", "Quận Phú Nhuận", "Huyện Bình Chánh", "TP Thủ Đức". phuong, duong, ma_can.
- du_an: tên dự án / khu dân cư / chung cư. Tên phường, tên khu vực (Thảo Điền, An Phú) KHÔNG phải dự án.
- huong: chỉ phương (Đông, Tây Nam…); "view sông" là view.
- phap_ly: giấy tờ (sổ hồng riêng, sổ chung, vi bằng, hoàn công). "Thổ cư" không phải pháp lý.
- noi_that, ly_do_ban (lý do CẦN bán, không phải "gấp"), ket_cau (trệt/lầu/lửng/hầm), thoi_han_thue, phi_quan_ly, view, hien_trang: chữ — giá trị là cụm ngắn NẰM TRONG trích dẫn.
- gap, thuong_luong: "co" | "khong". Hoa hồng môi giới KHÔNG phải thương lượng.
- kien_thuc: ý khác về CĂN NHÀ không có khoá (tiện ích gần, an ninh, tình trạng, đồ để lại, lịch sử…) — cụm ngắn nguyên văn; KHÔNG đưa lời chào, câu hỏi, chuyện riêng của chủ nhà, và không lặp ý đã có khoá.
Không có gì đáng bóc (chào, cảm ơn, hỏi lại) → truong = [], kien_thuc = [].`;

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
): Promise<{ ket: DeXuatRaoLLM | null; truong: DeXuat[]; kienThuc: string[]; usage: unknown }> {
  const r = await ai.messages.parse({
    model,
    max_tokens: 900,
    output_config: { effort: "low", format: FORMAT_RAO },
    system: [{ type: "text", text: LUAT, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: `${cauDangHoi ? `Câu bot vừa hỏi chủ nhà: ${cauDangHoi}\n` : ""}Tin nhắn chủ nhà: "${text.slice(0, 1200)}"`,
    }],
  });
  const ket = DeXuatRao.safeParse(r.parsed_output);
  return {
    ket: ket.success ? ket.data : null,
    truong: ket.success ? ket.data.truong.map((t) => ({ ...t })) : [],
    kienThuc: ket.success ? ket.data.kien_thuc.filter((k) => typeof k === "string") : [],
    usage: r.usage,
  };
}
