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
- loai_giao_dich: "ban" | "cho_thue"
- loai_bds: chung_cu | nha_pho | nha_cap4 | dat | biet_thu | phong_tro | mat_bang | toa_nha | dat_nong_nghiep | dat_kinh_doanh | kho_xuong
- gia (giá bán, hoặc giá thuê/tháng nếu cho thuê), gia_m2 (giá mỗi m²), tien_coc, thu_nhap_thue
- dien_tich (m²), ngang, dai, no_hau (m), do_rong_hem, do_rong_duong, cach_mat_tien (m)
- so_phong_ngu, so_wc, so_tang (tổng số tầng của nhà), tang (căn hộ nằm tầng mấy)
- quan, phuong, duong, du_an, ma_can
- phap_ly, huong, noi_that, ly_do_ban, ket_cau, thoi_han_thue, phi_quan_ly, view, hien_trang (chữ: giá trị là cụm ngắn NẰM TRONG trích dẫn)
- gap, thuong_luong: "co" | "khong"
Không có gì đáng bóc (chào, cảm ơn, hỏi lại) → truong = [].`;

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
): Promise<{ ket: DeXuatRaoLLM | null; truong: DeXuat[]; usage: unknown }> {
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
    usage: r.usage,
  };
}
