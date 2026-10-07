// FR-208 — MODEL ĐỀ XUẤT bóc tách tin nhắn người bán, KÈM TRÍCH DẪN (14/09/2026).
//
// Model chỉ được NÓI "trường X = giá trị Y, bằng chứng là cụm Z trong tin". Có đúng hay
// không là việc của `_shared/extraction/kiem-bang-chung.ts` (tiền định). Bước 1 chạy BÓNG:
// kết quả chỉ vào `boc_tach_bong` để đo, chưa ghi tin rao.
// Tầng này KHÔNG ghi DB (luật `bot/tests/ranh-gioi.mjs`).
import { z } from "npm:zod@4";
import { dinhDangLong, docLong } from "./doc-long.ts";
import { MOI_KHOA, type DeXuat } from "../extraction/kiem-bang-chung.ts";
import { viDuThanhChu } from "./vi-du-boc-rao.ts";
import { danhSachPhuongChoAi } from "../extraction/khop-phuong.ts";

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
// FR-226 (25/09/2026, chủ dự án: "khách trả lời nhỏ giọt về địa chỉ hoặc các trường khác thì để AI gộp lại hoặc thay thế
// hoặc sửa"): AI thấy giá trị ĐANG GHI của vài ô chữ, khách nói thêm / sửa một phần → trả TOÀN BỘ giá trị mới. Code kiểm
// mọi chữ và số của giá trị mới đều có trong giá trị cũ hoặc trong tin (`kiemCapNhat`) — không thêm được điều khách không nói.
export const KHOA_GOP = ["vi_tri", "ket_cau", "phap_ly", "do_rong_hem", "noi_that"] as const;
const CapNhat = z.object({
  khoa: z.enum(KHOA_GOP),
  gia_tri_moi: z.string().describe("TOÀN BỘ giá trị mới của ô sau khi gộp phần khách vừa nói vào giá trị đang ghi (hoặc sửa phần khách sửa)."),
  cach: z.enum(["gop", "thay"]).describe("gop = thêm chi tiết vào giá trị đang ghi; thay = khách sửa / thay giá trị đang ghi."),
});
// 01/10/2026 (chủ dự án: "xhr có thể người ta nhắn shr nhưng viết nhầm, có thể hỏi lại xác nhận"): chữ viết tắt / gõ sai mà
// AI không chắc nghĩa → không điền ô, mà đưa khả năng cao nhất vào đây để bot HỎI LẠI chủ nhà. Code chỉ dùng ở chế độ `ai`.
const XacNhan = z.object({
  khoa: z.enum(MOI_KHOA),
  gia_tri: z.string().describe("Nghĩa AI đoán là khả năng cao nhất, viết bằng từ chuẩn ('sổ hồng riêng')."),
  trich_dan: z.string().describe("Cụm khách gõ COPY NGUYÊN VĂN ('xhr')."),
});
// 01/10/2026 (bắn thử lx-hn-62; chủ dự án: "sửa từ cái gốc nguyên nhân"): khách HỎI LẠI bên mình. Trước đây "đây có phải câu
// hỏi không / hỏi về chuyện gì" do ba bộ từ khoá quyết (`laCauHoiTron`, `hoiVeTin`, `dapHoiNguocTienDinh`) — bộ từ khoá thì
// luôn thiếu cách nói mới ("bao lâu thì bán được em" → ghi làm thông tin) và bỏ dấu thì đụng chữ ("khu này" = "hồi nãy" →
// "giá khu này giờ sao" bị đáp giá rao). AI đọc mọi tin rồi, nên AI nói luôn: có hỏi không, hỏi gì, chủ đề gì.
export const CHU_DE_HOI = ["tin_cua_minh", "dich_vu", "thi_truong", "ve_bot", "nguon", "du_an", "khac"] as const;
const HoiLai = z.object({
  co_hoi: z.boolean().describe("Tin có câu chủ nhà HỎI bot / bên mình không — đọc theo NGHĨA, kể cả không dấu hỏi, gõ tắt, không dấu ('bao lâu thì bán được em', 'giá khu này giờ sao', 'khu này dễ bán hông em', 'ký hợp đồng gì không em', 'phi ben minh sao'). Chỉ trả lời câu bot hỏi, kể chuyện, chào, cảm ơn → false. Khách TỰ GIỚI THIỆU mình là ai ('anh là môi giới nha', 'chị là chủ nhà', 'bên anh là sàn') là KHẲNG ĐỊNH về chính khách, không phải câu hỏi → false (ghi vào `vai`)."),
  cau_hoi: z.string().nullable().describe("Câu hỏi đó COPY NGUYÊN VĂN từ TIN NHẮN CHỦ NHÀ — không bao giờ chép câu bot vừa hỏi. co_hoi = false thì null."),
  chu_de: z.enum(CHU_DE_HOI).nullable().describe("tin_cua_minh = hỏi về chính căn mình đã rao (giá / diện tích đã ghi, đăng chưa, có khách chưa); dich_vu = phí, hợp đồng, độc quyền, cách làm việc, bao lâu bán được, ai xem tin, có dẫn khách không; thi_truong = giá khu vực, khu này dễ bán không, nên rao giá nào; ve_bot = bot là ai, người hay máy, công ty nào; nguon = hỏi bot SAO BIẾT / LẤY ĐÂU RA một điều bot vừa nói ('sao em biết nhà 4-6 tầng', 'ai nói em vậy', 'em lấy đâu ra số đó') — KHÔNG phải ve_bot; du_an = hỏi bên mình có BIẾT / biết gì về một DỰ ÁN, khu, toà nhà, chung cư cụ thể ('em biết dự án ny'ah phú định không', 'và dự án vinhome grand park', 'khu X thế nào em') — không phải căn đang rao; khac = còn lại. co_hoi = false thì null."),
});
// 01/10/2026 (chủ dự án: "nó có nhận ra cảm xúc của khách để báo về admin ko" → "sửa cả 4 đi"): giọng chủ nhà — AI đọc theo
// NGHĨA cả câu (có ngữ cảnh), code kiểm trích dẫn rồi mới báo admin (`docCamXuc`).
export const MUC_CAM_XUC = ["binh_thuong", "buc", "nghi_ngo", "muon_dung"] as const;
const CamXuc = z.object({
  muc: z.enum(MUC_CAM_XUC).describe("binh_thuong ('ngộp ngân hàng', 'kẹt bank', 'cắt lỗ' là áp lực TIỀN của chủ nhà, không phải bực với bot); buc = bực, cáu, chê bot hỏi nhiều / hỏi hoài; nghi_ngo = nghi lừa đảo, không tin, sợ mất tiền / mất thông tin; muon_dung = bảo thôi, không rao nữa, đừng nhắn nữa. 'Bận', 'để mai' thôi chưa phải bực."),
  trich_dan: z.string().nullable().describe("Cụm COPY NGUYÊN VĂN từ TIN NHẮN CHỦ NHÀ thể hiện cảm xúc đó. binh_thuong thì null."),
});
// 01/10/2026 (chủ dự án: "câu hỏi riêng cho từng loại bds… code cứng quá nên giờ cần AI hiểu"): bảng câu theo loại (required_facts)
// vẫn là danh mục; AI đọc điều chủ nhà đã nói và chỉ ra câu KHÔNG áp dụng cho căn này, kèm trích dẫn (`docKhongCanHoi`).
// Đợt 2 chuyển luật sang AI (02/10/2026, chủ dự án: "lấy hết các luật bên kia qua cho AI"): ý định của tin và vai người rao
// trước đây do từ khoá quyết (`laNgungRao`, `laRaoLai`, hoãn, `tinHieuMoiGioi`) — "mấy bên môi giới hối chị… sợ lắm" từng báo
// admin đổi nhãn MÔI GIỚI. AI đọc theo nghĩa, code kiểm trích dẫn (`docYDinh`, `docVai`); từ khoá chỉ đỡ khi model chết.
export const Y_DINH = ["binh_thuong", "ban_roi", "ngung_rao", "rao_lai", "hoan", "du_roi"] as const;
const YDinh = z.object({
  loai: z.enum(Y_DINH).describe("binh_thuong; ban_roi = căn ĐÃ BÁN / đã cọc / đã chốt được; ngung_rao = thôi không bán / không cho thuê nữa, rút tin; rao_lai = bán / cho thuê LẠI căn đã gỡ, 'chưa bán đâu, vẫn bán'; hoan = bận, để sau / mai nói tiếp, chưa trả lời được lúc này; du_roi = chủ nhà bảo ĐỦ thông tin rồi / đăng luôn đi / không cần hỏi thêm (KHÔNG phải câu tả nhà có chữ 'hết rồi', 'xây kín hết rồi', 'đang cho thuê'). Nói về người KHÁC ('hàng xóm bán rồi') hay hỏi ('bán được chưa em') → binh_thuong."),
  trich_dan: z.string().nullable().describe("Cụm COPY NGUYÊN VĂN từ TIN NHẮN CHỦ NHÀ thể hiện ý định đó. binh_thuong thì null."),
});
export const VAI_NGUOI_RAO = ["khong_noi", "chinh_chu", "moi_gioi"] as const;
const Vai = z.object({
  la: z.enum(VAI_NGUOI_RAO).describe("Người nhắn TỰ NÓI mình là ai: chinh_chu = chủ nhà / nhà của mình / không phải môi giới; moi_gioi = tự nhận là môi giới, sale, bán giúp chủ, nhận ký gửi ('anh là môi giới nha', 'em bên sàn X', 'mình làm sale', 'hàng ký gửi của khách') — câu tự giới thiệu kết bằng 'nha/nhé/ạ' vẫn là tự nói vai. Nhắc tới môi giới KHÁC ('mấy bên môi giới hối chị'), hỏi về môi giới → khong_noi."),
  trich_dan: z.string().nullable().describe("Cụm COPY NGUYÊN VĂN người nhắn tự nói vai mình. khong_noi thì null."),
});
// 02/10/2026 (test tay chủ dự án, SRS-5.1ze): "Ừ anh đang muốn bán căn nhà…" → bot gọi "anh chị" suốt hội thoại: luật tự xưng
// (`tuXungTuCau`) là danh sách mẫu câu, câu mở bằng "Ừ" lọt. AI đọc theo nghĩa, code kiểm trích dẫn (`docTuXung`).
export const TU_XUNG_AI = ["anh", "chị", "chú", "cô", "bác", "ông", "bà", "dì", "cậu", "mợ", "thím", "dượng"] as const;
const TuXung = z.object({
  la: z.enum(TU_XUNG_AI).nullable().describe("Chữ người nhắn dùng để TỰ GỌI CHÍNH MÌNH trong tin ('Ừ anh đang muốn bán' → anh; 'nhà a 4 tầng' → anh; 'chị gửi ảnh nha' → chị; 'chú có căn nhà' → chú). Gọi người KHÁC ('anh hàng xóm', 'chị em nó', 'nhà của bà ngoại') không tính. Tin này không tự xưng nhưng một tin TRƯỚC của chủ nhà (khối 'Các tin CHỦ NHÀ đã nhắn TRƯỚC') có → vẫn đưa, trích từ tin đó. Không có đâu → null."),
  trich_dan: z.string().nullable().describe("Cụm COPY NGUYÊN VĂN có chữ tự xưng đó, từ tin này hoặc từ tin trước của chủ nhà. la = null thì null."),
});
// Đợt 3 chuyển luật sang AI (02/10/2026): câu hỏi KẾ trước đây do bảng ưu tiên + từ khoá quyết (`chonCauKe`, `re-nhanh`) — AI
// chọn trong danh sách "Câu bot còn định hỏi" như môi giới; code chỉ nhận khoá có trong danh sách hợp lệ của lượt (`docCauKe`).
const CauKe = z.object({
  khoa: z.string().nullable().describe("Khoá câu NÊN HỎI TIẾP, lấy ĐÚNG khoá trong danh sách 'Câu bot còn định hỏi'. Không có danh sách / không chắc → null."),
  ly_do: z.string().nullable().describe("Vì sao hỏi câu này tiếp (ngắn)."),
});
const KhongCanHoi = z.object({
  khoa: z.string().describe("Khoá câu trong danh sách 'Câu bot còn định hỏi' gửi kèm."),
  ly_do: z.string().describe("Vì sao câu đó không cần hỏi: không áp dụng, hoặc chủ nhà đã trả lời (ngắn)."),
  // 02/10/2026 (bắn lại thu-gapd, SRS-5.1ze): AI đọc đúng "được giá thì bán" = không gấp nhưng chỉ đưa vào đây, `truong` rỗng → không ghi.
  gia_tri: z.string().nullish().describe("Chủ nhà ĐÃ trả lời câu đó → giá trị đọc được, CÙNG cách ghi như truong (gấp / thương lượng: co hoặc khong). Câu không áp dụng thì null."),
  trich_dan: z.string().describe("Cụm COPY NGUYÊN VĂN từ lời CHỦ NHÀ (tin này hoặc ngữ cảnh) chứng minh."),
});
const DeXuatRao = z.object({
  // 02/10/2026 (đối chiếu AI ↔ code, SRS-5.1zb): "mở tin mới" từng do từ khoá quyết ("nữa", quận khác, loại khác) — "bán nhà này
  // 5 tỷ nữa là chốt" mở tin trùng, "bán vì chuyển qua quận 7" mở tin Quận 7.
  can_khac: z.boolean().describe("Có câu bot đang hỏi về một căn mà tin này RAO / tả một căn KHÁC (khác địa chỉ, khác loại, 'còn căn nữa') → true. Trả lời, bổ sung, sửa cho chính căn đang hỏi, nhắc nơi khác chỉ để so sánh / chỉ đường → false. Không có câu đang hỏi → false."),
  so_can: z.number().int().describe("Số căn / lô KHÁC NHAU chủ nhà rao trong tin này. Không rao căn nào (chỉ bổ sung, trả lời) thì 0."),
  truong: z.array(TruongBoc),
  // 17/09/2026 (chủ dự án): "AI có thể thêm trường kiến thức… các trường khách nói bổ sung sẽ ghi vào mô tả".
  kien_thuc: z.array(z.string()).describe("Ý KHÁC chủ nhà nói về căn nhà mà không thuộc khoá nào ở trên (gần chợ, khu an ninh, mới sơn sửa, có gác…): mỗi ý một cụm ngắn COPY NGUYÊN VĂN từ tin (≤ 12 chữ). Không có thì []."),
  tra_loi: TraLoiCau,
  cap_nhat: z.array(CapNhat).describe("Chỉ khi tin nói thêm / sửa MỘT PHẦN của thông tin ĐANG GHI (danh sách gửi kèm). Không có thì []."),
  xac_nhan: z.array(XacNhan).describe("Chữ viết tắt / gõ sai KHÔNG CHẮC nghĩa (\"xhr\" có thể là shr gõ nhầm): KHÔNG đưa vào truong, đưa khả năng cao nhất vào đây để hỏi lại. Tối đa 1. Không có thì []."),
  hoi_lai: HoiLai,
  cam_xuc: CamXuc,
  khong_can_hoi: z.array(KhongCanHoi).describe("Câu trong danh sách 'Câu bot còn định hỏi' KHÔNG cần hỏi nữa: không áp dụng cho căn này theo lời chủ nhà, HOẶC chủ nhà ĐÃ trả lời / đã nói ý đó (tin này hay các tin trước, kể cả nói vòng: '16 tỉ, rao khi nào được giá thì bán' là đã trả lời câu gấp; 'ở 10 năm nay' chưa trả lời câu nào). Đã trả lời mà đọc được giá trị thì VẪN đưa giá trị vào truong. Không có danh sách / không chắc thì []."),
  y_dinh: YDinh,
  vai: Vai,
  cau_ke: CauKe,
  tu_xung: TuXung,
});
// Đọc kết quả: `tra_loi` có thể thiếu (bản model cũ / mock e2e) — thiếu thì coi như AI không nói, không hỏng cả lượt.
const DeXuatRaoDoc = DeXuatRao.extend({ can_khac: z.boolean().nullish(), tra_loi: TraLoiCau.nullish(), cap_nhat: z.array(CapNhat).nullish(), xac_nhan: z.array(XacNhan).nullish(), hoi_lai: HoiLai.nullish(), cam_xuc: CamXuc.nullish(), khong_can_hoi: z.array(KhongCanHoi).nullish(), y_dinh: YDinh.nullish(), vai: Vai.nullish(), cau_ke: CauKe.nullish(), tu_xung: TuXung.nullish() });
export type CauKeLLM = z.infer<typeof CauKe>;
export type YDinhLLM = z.infer<typeof YDinh>;
export type VaiLLM = z.infer<typeof Vai>;
export type TuXungLLM = z.infer<typeof TuXung>;
export type CamXucLLM = z.infer<typeof CamXuc>;
export type KhongCanHoiLLM = z.infer<typeof KhongCanHoi>;
export type HoiLaiLLM = z.infer<typeof HoiLai>;
export type XacNhanLLM = z.infer<typeof XacNhan>;
export type CapNhatLLM = z.infer<typeof CapNhat>;
export type TraLoiCauLLM = z.infer<typeof TraLoiCau>;
export type DeXuatRaoLLM = z.infer<typeof DeXuatRaoDoc>;
const FORMAT_RAO = dinhDangLong(DeXuatRao, DeXuatRaoDoc);

const LUAT = `BÓC TÁCH TIN NHẮN NGƯỜI BÁN BẤT ĐỘNG SẢN — CHỈ ĐIỀU KHÁCH NÓI.
Bạn đọc MỘT tin nhắn của chủ nhà / môi giới (rao căn mới, hoặc trả lời câu bot vừa hỏi, hoặc sửa lời) và liệt kê từng thông tin CÓ TRONG TIN.
Tin có thể gồm vài dòng khách nhắn liên tiếp trước khi rao (địa chỉ nói trước, giá nói sau) — đọc cả đoạn như lời về cùng một căn.

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
  Tin RAO hay câu TẢ CĂN của người bán (kể cả KHÔNG có chữ bán / cho thuê: "nhà anh ở hẻm 137 Nguyễn Trãi", "chỗ anh 1 trệt 2 lầu")
  LUÔN đưa loai_bds khi có chữ chỉ loại, kể cả không dấu: "bán nhà", "nhà hẻm", "nhà mặt tiền", "nhà 1 trệt 2 lầu", "nhà anh ở",
  "ban nha hem" → nha_pho (trừ khi nói cấp 4 / biệt thự / chung cư / phòng trọ); trich_dan là cụm có chữ "nhà". Không có chữ chỉ loại thì không đưa.
  Nhà cấp 4 chỉ có MỘT trệt (có thể có gác lửng), KHÔNG có lầu: "nhà 4 lầu", "nhà 3 tầng", "1 trệt 2 lầu" → nha_pho (trừ khi nói biệt thự).
- gia (giá bán; tin cho thuê thì giá thuê), gia_m2, tien_coc, thu_nhap_thue (CHỈ tiền thuê căn BÁN đang thu). Giá trị tiền LUÔN kèm đơn vị như khách viết: "5 tỷ 2", "3 tỷ 150", "900 triệu", "95 triệu/m2" — không viết số trần "5.2".
- dien_tich (m²), ngang, dai, no_hau (m), do_rong_hem, do_rong_duong, cach_mat_tien (m): trong "truong" chỉ con số (hẻm xe hơi không có số mét thì không đưa vào truong — nhưng VẪN là câu trả lời câu hẻm ở "tra_loi").
- so_phong_ngu, so_wc; so_tang = TỔNG số tầng tính CẢ TRỆT, không tính lửng/sân thượng ("1 trệt 2 lầu" = 3, "trệt 3 lầu" = 4, "3 tấm" = 3, "3 tầng" = 3 — TẦNG đã gồm trệt, chỉ LẦU mới cộng 1); tang = căn hộ nằm tầng mấy. Tin có cụm kết cấu (trệt / lầu / lửng) thì ket_cau là ô chính, so_tang chỉ là số tính ra từ cụm đó — đưa cả hai được, code giữ ket_cau.
- quan: ghi đủ "Quận 5", "Quận Phú Nhuận", "Huyện Bình Chánh", "TP Thủ Đức". phuong, duong, ma_can. quan / phuong / duong là NƠI CĂN NHÀ
  NẰM — nơi GẦN đó, nơi đi tới, nơi chủ nhà ở / chuyển tới thì KHÔNG đưa ("ra Quận 1 có 5 phút", "gần chợ Bến Thành", "bán vì chuyển qua quận 7").
- phuong: ĐỌC THEO NGHĨA, không cần chữ "phường / xã" đứng trước — "nhà ở Vĩnh Lộc B", "bên Thảo Điền", "an hoi tay", gõ sai một hai chữ đều là nói phường. Trả tên phường MỚI ĐẦY ĐỦ đúng như DANH SÁCH PHƯỜNG gửi kèm tin nhắn (chỉ gồm các phường câu khách có thể đang nhắc; không có danh sách thì chỉ đưa phuong khi khách nói rõ "phường / xã X") ("Phường An Hội Tây", "Xã Tân Vĩnh Lộc"): khách nói tên CŨ thì đổi sang phường mới theo bảng tên cũ ("Vĩnh Lộc B" → "Xã Tân Vĩnh Lộc", "Thảo Điền" → "Phường An Khánh"); phường cũ bị chia (dấu *) sang nhiều phường mới mà câu không đủ để biết phần nào thì KHÔNG đưa phuong. KHÔNG cắt bớt chữ ("An Hội Tây" ≠ "An Hội"). trich_dan = cụm khách nói nguyên văn ("Vĩnh Lộc B"). Tên trùng tên quận cũ ("gò vấp", "phú nhuận") mà khách không nói "phường" thì là QUẬN. Phường đánh số ("phường 12", "p4") giữ số: "Phường 12".
- duong (ĐỊA CHỈ ĐẦY ĐỦ, có dấu, như khách nói; ô này hiện dưới tên "vi_tri" trong "Thông tin đang ghi" và cap_nhat — hai tên, MỘT ô): giữ nguyên số nhà, SỐ HẺM và ĐÚNG THỨ TỰ CHỮ khách gõ — KHÔNG đảo, KHÔNG sắp xếp lại
  ("hẻm 45 Nguyễn Trãi" giữ là "hẻm 45 Nguyễn Trãi", không thành "45 hẻm Nguyễn Trãi"; "hẻm 18/5 đường Cách Mạng Tháng 8", "12/3 Lê Văn Sỹ",
  "88 hẻm Tân Kỳ Tân Quý" là khi khách gõ đúng thứ tự đó). trich_dan của duong là CỤM ĐỊA CHỈ NGUYÊN VĂN trong tin — hệ thống ghi chính cụm
  đó vào tin, nên trích đủ số nhà + hẻm + tên đường, không trích thừa phường / quận. Quy ước TP.HCM: "137/28 đường số 59" là HẺM 137 của đường số 59, NHÀ SỐ 28 trong hẻm (số
  sau dấu "/" cuối là số nhà; "137/28/5" = nhà 5 trong hẻm 137/28) — ghi "137/28 đường số 59", không đảo số, không bỏ số. KHÔNG ghi BỀ
  RỘNG hẻm vào duong ("hẻm 6m", "4 mét" → do_rong_hem). Tên đường bằng số / mã thì ghi kèm chữ "đường": "đường 3/2", "đường 30/4",
  "đường D2", "đường số 7".
- ten_duong: CHỈ TÊN ĐƯỜNG, có dấu — không số nhà, không số hẻm, không chữ "hẻm / đường": "Nguyễn Trãi", "Cách Mạng Tháng 8", "3/2",
  "30/4", "D2", "số 7", "Tân Kỳ Tân Quý". Có duong thì LUÔN đưa kèm ten_duong (cùng trích dẫn với duong).
- SỐ HẺM khác BỀ RỘNG HẺM: số đứng sau "hẻm" mà KHÔNG có đơn vị là SỐ HẺM, thuộc duong ("hẻm 45", "hẻm 18/5", "hẻm 1135", "hẻm 284").
  Bề rộng LUÔN có "m" / "mét" / "rộng": "hẻm 4m", "hẻm 4 mét", "hẻm rộng 4", "hẻm 3m5", "hẻm 6m" → do_rong_hem (chỉ con số). "hẻm 4"
  trần (số nhỏ, không đơn vị, không "rộng") là mập mờ → không đưa do_rong_hem.
- du_an: tên dự án / khu dân cư / chung cư. Tên phường, tên khu vực (Thảo Điền, An Phú) KHÔNG phải dự án.
- huong: chỉ phương (Đông, Tây Nam…); "view sông" là view.
- phap_ly: giấy tờ (sổ hồng riêng, sổ chung, vi bằng, hoàn công; "chưa có sổ", "đang chờ sổ", "hợp đồng mua bán" cũng là câu trả lời pháp lý — ghi đúng chữ khách). "Thổ cư" không phải pháp lý.
- noi_that, ly_do_ban (lý do CẦN bán, không phải "gấp"), ket_cau (trệt/lầu/lửng/hầm), thoi_han_thue (CHỈ tin cho thuê; tin BÁN đang có người thuê thì hạn hợp đồng vào ô han_hop_dong_thue, KHÔNG vào kien_thuc), phi_quan_ly, view, hien_trang (tình trạng CĂN NHÀ: mới xây, cũ, cần sửa, bàn giao thô — còn "đang ở / đang cho thuê / để trống" là hien_trang_su_dung): chữ — giá trị là cụm ngắn NẰM TRONG trích dẫn.
- gap, thuong_luong: gia_tri CHỈ là "co" hoặc "khong" (không chép cụm khách nói vào gia_tri). Hoa hồng môi giới KHÔNG phải thương lượng.
  gap đọc theo NGHĨA cả câu, có phủ định, kể cả khi bot đang hỏi câu khác:
  khong = "được giá thì bán / thì thôi", "rao khi nào được giá", "giá tốt thì bán, không thì để đó", "không vội", "từ từ", "chưa cần tiền",
  "bán chơi", "ko gấp", "hong có gấp gì", "chưa cần bán gấp";
  co = "bán gấp", "cần tiền gấp", "kẹt tiền", "kẹt bank", "ngộp ngân hàng / ngộp bank", "cắt lỗ cũng bán", "cần ra hàng sớm", "ra nhanh trong tháng".
  Một tin có cả giá lẫn ý gấp ("16 tỉ em, rao khi nào được giá thì thôi") → đưa CẢ HAI trường, không chỉ giá.
- loai_duong_vao: mat_tien | hem_xe_tai | hem_xe_hoi | hem_xe_may | hem | khong_hem — đường trước nhà, đọc theo NGHĨA cả câu, kể
  cả phủ định: "hxh", "ô tô vào tận nhà" → hem_xe_hoi; "hxm", "xe hơi không vào được" → hem_xe_may; "mặt tiền", "mặt đường" →
  mat_tien; chỉ nói "trong hẻm" → hem; "không có hẻm", "nằm trong khu công nghiệp / nội khu" → khong_hem. "Gần / cách mặt
  tiền" KHÔNG phải mat_tien. Chủ CHỈ nói bề rộng hẻm (không nói xe nào vào) → theo bề rộng: dưới 3m → hem_xe_may; 3m đến dưới
  3,5m → hem; từ 3,5m → hem_xe_hoi; từ 6m → hem_xe_tai (trích dẫn là cụm bề rộng, vd "hẻm 4m"). Số hẻm ("hẻm 45") KHÔNG phải bề rộng.
- o_to_vao_nha (ô tô vào / đậu TRONG nhà), hoan_cong (đã hoàn công), thang_may, can_goc (căn góc, lô góc, hai mặt tiền):
  "co" | "khong" — đọc phủ định theo nghĩa ("chưa hoàn công", "không có thang máy" → khong). nam_xay: năm 4 chữ số.
- Ô chữ (cụm ngắn, có dấu, bỏ từ đệm "em / nha / ạ", không thêm ý khách không nói): quy_hoach (quy hoạch, lộ giới), the_chap
  (đang thế chấp), tranh_chap, tho_cu (thổ cư bao nhiêu / full thổ cư), len_tho_cu, xay_dung (được xây mấy tầng, giấy
  phép), so_phong (TỔNG số phòng cho thuê của CHDV / toà nhà / dãy trọ), dien_tich_san (TỔNG sàn xây dựng / sử dụng của NHÀ nhiều tầng; diện tích CĂN HỘ ghi dien_tich), chieu_cao
  (cao thông thủy), hem_thong (hẻm thông / cụt), duong_vao (đường nhựa, bê tông…), ngap_nuoc, tien_ich_gan (tiện ích gần,
  ĐÚNG chữ khách), tiem_nang (CHỈ khi khách nói thẳng), muc_dich, hinh_dang (vuông vức, nở hậu, tóp hậu), san_vuon, pccc,
  thoi_han_su_dung (lâu dài / 50 năm), han_hop_dong_thue (hợp đồng thuê ĐANG CHẠY của căn bán), ty_le_lap_day, phi_gui_xe,
  mat_do_xd, tang_cao_toi_da, tai_trong_san, toa_thap (toà / block), khu_compound, ha_tang, fit_out, duong_container (xe
  container vào được không), tram_bien_ap, xu_ly_nuoc_thai, nguon_nuoc, ranh_gioi, hinh_thuc_thue_dat (trả tiền một lần /
  hằng năm), hien_trang_su_dung (chủ ĐANG Ở / đang cho thuê / để trống — không phải hien_trang), truot_gia.
- kien_thuc: ý khác về CĂN NHÀ không có khoá nào ở trên (an ninh, đồ để lại, lịch sử…) — cụm ngắn CHÉP NGUYÊN VĂN; KHÔNG đặt nhãn diễn giải ("tiềm năng kinh doanh", "phù hợp đầu tư", "dòng tiền tốt", "khai thác thương mại") khi khách không nói đúng chữ đó; KHÔNG đưa lời chào, câu hỏi, chuyện riêng của chủ nhà, và không lặp ý đã có khoá.
Không có gì đáng bóc (chào, cảm ơn, hỏi lại) → truong = [], kien_thuc = [].

NGỮ CẢNH — tin nhắn có thể kèm vài lượt trao đổi NGAY TRƯỚC (bot nói gì, chủ nhà nói gì) và CÂU BOT VỪA HỎI đúng nguyên văn.
Dùng ngữ cảnh để HIỂU tin như người đang nói chuyện: "ừ", "đúng rồi", "cái đó", "như trên", "vậy đi" hiểu theo câu bot vừa nói.
MỌI trich_dan của truong / tra_loi / xac_nhan / cap_nhat / cam_xuc vẫn COPY từ TIN NHẮN CHỦ NHÀ — ngữ cảnh không phải nguồn giá trị.
- Câu bot vừa hỏi là câu CHỌN MỘT TRONG HAI ("cần ra hàng gấp hay được giá thì thôi", "sổ riêng hay sổ chung", "để ở hay cho thuê")
  mà khách chỉ "ừ / ok / dạ / đúng / được / có" → không biết chọn vế nào → tra_loi.co_tra_loi = false. Câu CÓ / KHÔNG ("có gấp
  không") thì "ừ" là có.

CẢM XÚC ("cam_xuc") — đọc giọng chủ nhà trong tin này, có ngữ cảnh: bực vì bị hỏi nhiều, nghi lừa đảo, bảo thôi không rao nữa.
Đọc theo NGHĨA cả câu; "bận", "để mai" chưa phải bực. Bình thường → binh_thuong, trich_dan null.

KHÔNG CẦN HỎI ("khong_can_hoi") — có danh sách "Câu bot còn định hỏi" thì xét theo điều chủ nhà ĐÃ NÓI: câu nào KHÔNG áp dụng cho
căn này (kho trong khu công nghiệp → không hỏi độ rộng hẻm; đất trống → không hỏi kết cấu; căn hộ chung cư → không hỏi ngang dài;
nhà nguyên căn đang ở → không hỏi phí quản lý). Mỗi câu kèm ly_do + trich_dan nguyên văn lời chủ nhà. Không chắc thì KHÔNG đưa.
Không bao giờ đưa giá, diện tích, vị trí, phường, pháp lý, loại BĐS.

Ý ĐỊNH ("y_dinh") — đọc theo NGHĨA cả câu, có ngữ cảnh: căn của chủ nhà đã bán / đã cọc (ban_roi), thôi không bán nữa (ngung_rao),
bán lại căn đã gỡ hoặc rút lời "bán rồi" (rao_lai), đang bận / để sau (hoan). Nhắc chuyện người khác, hỏi, kể → binh_thuong.
Chủ nhà BẢO ĐĂNG / lên tin / chốt — "ok đăng đi", "đăng luôn đi em", "lên tin giúp anh", "cứ đăng như vậy trước", "đủ rồi em, đăng đi" —
dù bot đang HỎI thông tin hay đang đưa bản nháp → du_roi (trich_dan là chính cụm đó), KHÔNG phải ban_roi, KHÔNG phải binh_thuong.
Câu TẢ căn nhà có chữ "hết rồi" / "rồi" ("xây kín hết rồi em", "sổ có rồi") → binh_thuong.

CÂU HỎI KẾ ("cau_ke") — có danh sách "Câu bot còn định hỏi" thì chọn MỘT câu nên hỏi tiếp, như môi giới giỏi: (1) thông tin cần
để lên tin mà còn thiếu (giá, diện tích, vị trí / phường, pháp lý) đi trước; (2) trong số còn lại, câu NỐI MẠCH điều chủ nhà vừa
nói (vừa nói sổ riêng → hoàn công; vừa nói đang cho thuê → hợp đồng thuê tới khi nào); (3) câu dễ trả lời. Không chọn câu chủ
nhà đã trả lời trong tin / ngữ cảnh, không chọn câu vừa đưa vào khong_can_hoi. Câu đánh dấu "(nhánh)" chỉ chọn khi đúng hoàn
cảnh căn này. Khoá phải đúng y chữ trong danh sách; không chắc → null.

VAI ("vai") — chỉ khi người nhắn TỰ NÓI mình là chủ nhà hay môi giới. Nhắc tới môi giới khác, kể chuyện môi giới, hỏi phí môi
giới → khong_noi.

KHÁCH HỎI LẠI ("hoi_lai") — đọc theo NGHĨA, như môi giới nghe khách: tin có ý HỎI bên mình (có hay không có dấu "?", gõ tắt,
không dấu) → co_hoi = true, cau_hoi = câu hỏi chép nguyên văn, chu_de theo nội dung câu hỏi. "giá khu này giờ sao" là hỏi
THỊ TRƯỜNG, không phải hỏi giá căn mình; "hồi nãy anh nói giá bao nhiêu" mới là hỏi tin của mình. Hỏi về một DỰ ÁN / khu
("em biết dự án ny'ah phú định không", câu nối "và dự án vinhome grand park") là chu_de du_an — tên dự án / phường trong câu
hỏi đó KHÔNG vào du_an_ten, phuong, quan (đó không phải nơi căn đang rao; khách có thể sắp rao căn khác ở đó). Câu hỏi KHÔNG BAO GIỜ
vào truong hay kien_thuc: "ký hợp đồng gì không em" là hỏi dịch vụ, không phải phap_ly; "khu này dễ bán hông em" là hỏi thị
trường, không phải kien_thuc.
- Mọi trường CHỮ (pháp lý, nội thất, hiện trạng, kết cấu, hướng, lý do bán, view, thời hạn thuê…) viết lại SẠCH: có dấu, đúng chính tả, viết hoa tên riêng, bỏ từ đệm ("nha", "nhé", "á", "ạ"), giữ đúng ý và đúng chữ cái của cụm trích — KHÔNG thêm ý, không đổi từ.
- Khách gõ KHÔNG DẤU thì TÊN RIÊNG (đường, phường, dự án, quận) viết lại CÓ DẤU đúng chính tả tên thật ("pham the hien" → "Phạm Thế Hiển", "thu duc" → "Thủ Đức"); cụm trích dẫn vẫn COPY nguyên văn không dấu. Không chắc tên thật thì giữ nguyên chữ khách gõ. KHÔNG đổi chữ cái, chỉ thêm dấu.
- "Hẻm xe hơi / xe tải / ba gác" không phải hien_trang. "bớt / giảm N", "bao phí" là mức giảm, không phải gia. Số có "m2" là dien_tich, không phải dai. Lời hứa ("để em xem lại rồi báo"), lời chào, câu hỏi → không vào kien_thuc.

TRẢ LỜI CÂU ĐANG HỎI ("tra_loi") — đọc NGUYÊN tin theo NGHĨA, như người môi giới đọc tin khách, KHÔNG bắt theo từ khoá:
- Tin trả lời được câu bot vừa hỏi → co_tra_loi = true; gia_tri = câu trả lời gọn, đủ ý, viết lại sạch có dấu (hỏi hẻm, khách "hxh" → "hẻm xe hơi"; "ô tô vô tận nhà" → "hẻm xe hơi vào tận nhà"; "hẻm 3m, xe hơi không vào" → "hẻm 3m, xe hơi không vào được"; hỏi pháp lý, "shr" → "sổ hồng riêng"; "chưa có sổ đang chờ" → "chưa có sổ, đang chờ ra sổ"; câu có/không thì viết đủ ý theo câu hỏi: hỏi gấp không, khách "ừ có" → "có, cần bán gấp", "thôi từ từ" → "không gấp"); trich_dan = cụm nguyên văn.
- Tin trả lời câu KHÁC, hỏi ngược, hẹn trả lời sau, nói chung chung không có câu trả lời → co_tra_loi = false, gia_tri = null, trich_dan = null. Không có câu đang hỏi → cũng false.
- Câu bot hỏi KÈM PHỎNG ĐOÁN ("Nhà anh ở đâu vậy, ở Hồ Chí Minh đúng không?", "nằm trong hẻm đúng không anh, hẻm rộng mấy mét?"): lời gật phần đoán ("đúng rồi e", "ừ hcm") KHÔNG phải giá trị, không nằm trong trich_dan. Hỏi địa chỉ mà khách chỉ nói quận / phường ("đúng rồi e. nhà a ở quận 5") → co_tra_loi = false (chưa có đường / hẻm / số nhà), quận vào ô quận.
- MỘT CỤM CHỈ TRẢ LỜI MỘT Ý: cụm đã là thông tin của ô khác (đứng tên, thế chấp, pháp lý, giá, diện tích…) thì KHÔNG phải câu trả lời câu đang hỏi. Chữ "không / có / rồi / chưa" nằm TRONG cụm của ý khác ("không thế chấp", "có sổ", "xây rồi") không trả lời câu có/không đang hỏi — đưa cụm đó vào truong của ô đúng, tra_loi.co_tra_loi = false.
- gia_tri không thêm điều khách không nói; MỌI con số trong gia_tri phải nằm trong CỤM TRÍCH (không đổi "trệt 2 lầu" thành "3 tầng", không đổi đơn vị tiền, không lấy số của ý khác — hỏi hẻm, khách "hxh, 5x12" → "hẻm xe hơi", KHÔNG "hẻm xe hơi 5m").

GỘP / SỬA THÔNG TIN ĐANG GHI ("cap_nhat") — khách hay trả lời nhỏ giọt, mỗi lượt một mẩu:
- Có danh sách "Thông tin đang ghi" gửi kèm, và tin nói thêm chi tiết cho một ô trong đó → cap_nhat: khoa, gia_tri_moi = TOÀN BỘ giá trị sau khi gộp (giữ phần cũ đúng, thêm phần mới), cach "gop". Ví dụ đang ghi vi_tri "Ngô Y Linh", khách "số 45 nha" → "45 Ngô Y Linh"; đang ghi ket_cau "trệt + 3 lầu", khách "có sân thượng nữa" → "trệt + 3 lầu + sân thượng".
- Tin SỬA một phần ("à nhầm, hẻm 45 chứ không phải 54", "không có sân thượng đâu") → gia_tri_moi là giá trị đã sửa, cach "thay".
- vi_tri (chính là ô duong ở trên) chỉ gồm số nhà / hẻm / tên đường / dự án — KHÔNG ghép phường, quận vào (có ô riêng).
- Mọi chữ, mọi con số trong gia_tri_moi phải có trong giá trị đang ghi hoặc trong tin (được thêm dấu cho tên riêng). Tin không đụng tới ô nào đang ghi → cap_nhat = []. Không đưa ô mà giá trị mới y hệt giá trị cũ.

VÍ DỤ MẪU (đáp án đúng — chỉ học CÁCH bóc, giá trị phải lấy từ tin của khách, không lấy từ ví dụ):

` + viDuThanhChu();

// Chế độ `ai` (01/10/2026, chủ dự án: "bóc thông số không biết từ đồng nghĩa hoặc viết gần giống"): máy thôi soát từ khoá
// (`datKiemNhe`), nên AI được CHUẨN HOÁ — đọc theo nghĩa, gõ sai, viết tắt, tiếng lóng nghề. Khối này nối sau LUAT, chỉ gửi
// khi công tắc là `ai` (khối riêng để phần LUAT vẫn cache được).
const LUAT_CHUAN_HOA = `CHẾ ĐỘ CHUẨN HOÁ (đè lên dòng "giữ đúng chữ cái của cụm trích" ở trên):
- Đọc theo NGHĨA như môi giới lâu năm: viết tắt, gõ sai một hai chữ, không dấu, tiếng lóng nghề đều phải hiểu ("xhr"/"shr"/"sổ hồg riêg" = sổ hồng riêng; "sổ chug"/"sổ chung" = sổ hồng chung; "hxh"/"hẻm ô tô"/"xe hơi vô tới nhà" = hẻm xe hơi; "hxm" = hẻm xe máy; "nhà ống"/"nhà phố liền kề" = nha_pho; "lô đất"/"nền" = dat; "c4"/"nhà cấp bốn" = nha_cap4; "full nt"/"đủ đồ" = full nội thất; "bớt lộc"/"có bớt"/"còn TL" = thuong_luong co; "ko gấp"/"từ từ bán" = gap khong).
- Giá trị trường CHỮ viết bằng TỪ CHUẨN của nghề (pháp lý: "sổ hồng riêng", "sổ hồng chung", "vi bằng", "hợp đồng mua bán", "giấy tay", "chưa có sổ", "đang chờ ra sổ", thêm "đã hoàn công"/"chưa hoàn công" nếu khách nói; nội thất: "full nội thất", "nội thất cơ bản", "nhà trống"; hướng: Đông | Tây | Nam | Bắc | Đông Nam | Đông Bắc | Tây Nam | Tây Bắc). trich_dan vẫn COPY NGUYÊN VĂN chữ khách gõ.
- Khách nói KHÔNG có / không biết (hỏi phường, khách "ko có phường", "không rõ") → KHÔNG đưa trường đó; tra_loi.co_tra_loi = false. TRỪ các ô có/không (gap, thuong_luong, o_to_vao_nha, hoan_cong, thang_may, can_goc, loai_duong_vao): "không gấp", "chưa hoàn công", "không có thang máy", "không có hẻm" là CÂU TRẢ LỜI → vẫn đưa ("khong" / "khong_hem"), và co_tra_loi = true nếu đó là câu đang hỏi.
- Tin KHÔNG trả lời câu đang hỏi nhưng có thông tin KHÁC (đang hỏi kết cấu, khách nhắn "50m2" hay "5 tỷ") → VẪN đưa thông tin đó vào truong (dien_tich, gia…), chỉ tra_loi.co_tra_loi = false. KHÔNG trả rỗng vì lạc câu hỏi.
- so_tang LUÔN tính cả trệt: "3 lầu" = 4, "trệt 2 lầu" = 3, "3 tấm" = 3, "3 tầng" = 3 (tầng đã gồm trệt).
- Mỗi khoá đúng loại của nó: "hxh"/"hẻm xe hơi" KHÔNG BAO GIỜ là phap_ly. Viết tắt CHUẨN của nghề ("shr", "sh", "hxh", "hxm", "pn", "wc", "c4", "full nt") là CHẮC nghĩa → đưa vào truong, KHÔNG vào xac_nhan — kể cả khi tin đó không trả lời câu đang hỏi. Chữ viết tắt / gõ sai KHÔNG CHẮC nghĩa ("xhr" — nhiều khả năng "shr" gõ nhầm) → KHÔNG đưa vào truong, đưa khả năng cao nhất vào xac_nhan (khoa phap_ly, gia_tri "sổ hồng riêng", trich_dan "xhr") để bot hỏi lại.
- Vẫn cấm bịa: không thêm con số, không thêm ý khách không nói, không suy quận từ tên đường.`;

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
  /** FR-226: giá trị ĐANG GHI của các ô chữ gộp được (`KHOA_GOP`) — chỉ ô có giá trị. */
  dangGhi: Partial<Record<typeof KHOA_GOP[number], string>> | null = null,
  /** Chế độ `ai`: thêm khối CHUẨN HOÁ (đồng nghĩa, gõ sai) sau LUAT. */
  chuanHoa = false,
  /**
   * 01/10/2026 (chủ dự án: "ra luật nó phải đọc thêm 1 2 câu hoặc cả ngữ cảnh phía trước"): vài lượt NGAY TRƯỚC ("BOT: …",
   * "CHỦ NHÀ: …") và câu bot còn định hỏi ("khoa: nội dung") — chỉ để AI HIỂU; trích dẫn vẫn phải nằm trong tin.
   */
  nguCanh: { hoiThoai?: string[]; cauConHoi?: string[]; tinChuNha?: string[] } | null = null,
): Promise<{ ket: DeXuatRaoLLM | null; truong: DeXuat[]; kienThuc: string[]; traLoi: TraLoiCauLLM | null; capNhat: CapNhatLLM[]; xacNhan: XacNhanLLM[]; hoiLai: HoiLaiLLM | null; camXuc: CamXucLLM | null; khongCanHoi: KhongCanHoiLLM[]; yDinh: YDinhLLM | null; vai: VaiLLM | null; tuXung: TuXungLLM | null; cauKe: CauKeLLM | null; canKhac: boolean | null; usage: unknown }> {
  // Danh sách phường LỌC theo câu khách, gửi trong phần tin nhắn (phần system giữ cố định để cache được).
  // 02/10/2026 (test Zalo: khách dán nguyên tin rao 700+ chữ có gạch đầu dòng): tin dài không được cắt — 1.200 chữ cũ cắt mất
  // phần pháp lý / kết cấu ở cuối tin rao dài. Trần 4.000 chỉ để chặn tin rác cực dài.
  const tin = text.slice(0, 4000);
  const dsPhuong = danhSachPhuongChoAi(tin);
  // "Bộ nhớ" (chủ dự án: "để AI có cache để đọc lại nguyên tin nhắn của khách để ko mất"): nguyên văn các tin chủ nhà nhắn
  // trước tin này, nơi gọi đã giới hạn ~6.000 chữ.
  const tinChuNha = (nguCanh?.tinChuNha ?? []).filter((x) => typeof x === "string" && x.trim()).slice(-30);
  const hoiThoai = (nguCanh?.hoiThoai ?? []).filter((x) => typeof x === "string" && x.trim()).slice(-4);
  const cauConHoi = (nguCanh?.cauConHoi ?? []).filter((x) => typeof x === "string" && x.trim()).slice(0, 20);
  const dg = Object.entries(dangGhi ?? {}).filter(([, v]) => typeof v === "string" && v.trim()).map(([k, v]) => `${k}: "${String(v).slice(0, 160)}"`);
  const r = await ai.messages.parse({
    model,
    // 02/10/2026: đợt 1–2 thêm ~40 khoá + ý định + vai — đầu ra dài hơn; 1300 có thể cắt cụt JSON câu rao dài.
    max_tokens: 2000,
    output_config: { effort: "low", format: FORMAT_RAO },
    system: [
      { type: "text", text: LUAT, cache_control: { type: "ephemeral" } },
      ...(chuanHoa ? [{ type: "text", text: LUAT_CHUAN_HOA, cache_control: { type: "ephemeral" } }] : []),
    ],
    messages: [{
      role: "user",
      content: `${tinChuNha.length ? `Các tin CHỦ NHÀ đã nhắn TRƯỚC tin này, NGUYÊN VĂN, cũ → mới (để nhớ chủ nhà đã nói gì — không trích từ đây):\n${tinChuNha.map((t) => `- ${t.replace(/\n+/g, " / ")}`).join("\n")}\n` : ""}${hoiThoai.length ? `Vài lượt NGAY TRƯỚC (chỉ để hiểu tin — không trích từ đây):\n${hoiThoai.join("\n")}\n` : ""}${cauConHoi.length ? `Câu bot còn định hỏi (khoá: nội dung):\n${cauConHoi.join("\n")}\n` : ""}${dg.length ? `Thông tin đang ghi của căn này (chỉ để GỘP / SỬA khi tin nhắc tới — không chép vào truong):\n${dg.join("\n")}\n` : ""}${cauDangHoi ? `Câu bot vừa hỏi chủ nhà: ${cauDangHoi}${cauHoiChu ? ` — "${cauHoiChu.slice(0, 300)}"` : ""}\n` : ""}Tin nhắn chủ nhà: "${tin}"${dsPhuong ? `\n\n${dsPhuong}` : ""}`,
    }],
  });
  const ket = docLong(DeXuatRaoDoc, r.parsed_output);
  // Câu AI nói "đã trả lời" kèm giá trị mà truong chưa có khoá đó → thành một đề xuất thường (code kiểm trích dẫn + giá trị như mọi ô).
  const truongDu = ket.success ? [...ket.data.truong.map((t) => ({ ...t })),
    ...(ket.data.khong_can_hoi ?? [])
      .filter((k) => typeof k.gia_tri === "string" && k.gia_tri.trim() && (MOI_KHOA as readonly string[]).includes(k.khoa) && !ket.data.truong.some((t) => t.khoa === k.khoa))
      .map((k) => ({ khoa: k.khoa, gia_tri: String(k.gia_tri).trim(), trich_dan: k.trich_dan, can: null }))] : [];
  return {
    ket: ket.success ? ket.data : null,
    truong: truongDu,
    kienThuc: ket.success ? ket.data.kien_thuc.filter((k) => typeof k === "string") : [],
    traLoi: ket.success ? ket.data.tra_loi ?? null : null,
    capNhat: ket.success ? ket.data.cap_nhat ?? [] : [],
    xacNhan: ket.success ? ket.data.xac_nhan ?? [] : [],
    hoiLai: ket.success ? ket.data.hoi_lai ?? null : null,
    camXuc: ket.success ? ket.data.cam_xuc ?? null : null,
    khongCanHoi: ket.success ? ket.data.khong_can_hoi ?? [] : [],
    yDinh: ket.success ? ket.data.y_dinh ?? null : null,
    vai: ket.success ? ket.data.vai ?? null : null,
    tuXung: ket.success ? ket.data.tu_xung ?? null : null,
    cauKe: ket.success ? ket.data.cau_ke ?? null : null,
    canKhac: ket.success ? ket.data.can_khac ?? null : null,
    usage: r.usage,
  };
}
