// Ý NGẮN CỦA LƯỢT (02/10/2026, SRS-5.1zf) — một lượt AI NHỎ, chạy SONG SONG với lượt bóc tách, đọc lời chủ nhà theo NGHĨA:
// gật / không đồng ý / gật và bảo đăng. Trước đây do từ khoá quyết (`laDongY`, `laBaoDang`, regex "đúng rồi|ok").
//
// Vì sao tách khỏi `boc-rao.ts`: khuôn structured output của lượt bóc tách đã sát giới hạn grammar của Anthropic — #414 thêm
// MỘT ô là mọi lượt trả 400 "The compiled grammar is too large", AI không chạy, bot rơi về luật. Ý về HỘI THOẠI (không phải dữ
// liệu căn nhà) đi đường này; các đợt bỏ luật sau (xưng hô, hoãn, lời hứa, yêu cầu meta…) thêm trường ở ĐÂY.
//
// Tầng này KHÔNG ghi DB (luật `bot/tests/ranh-gioi.mjs`). Model hỏng thì NÉM — nơi gọi ghi sổ và dùng luật làm lưới đỡ.
import { z } from "npm:zod@4";
import { dinhDangLong } from "./doc-long.ts";

export const DONG_Y = ["dong_y", "dong_y_dang", "khong_dong_y", "khong_noi"] as const;
// Đợt 3 (02/10/2026, SRS-5.1zg): YÊU CẦU của chủ nhà — hỏi về chính tin của mình / hỏi bao lâu bán / xin số khách / xin xoá
// dữ liệu / xin bỏ một ô ghi nhầm. Trước đây do `hoiVeTin`, `laXinSoKhach`, `laXinXoaDuLieu`, `laXinBoTruong` (từ khoá) quyết.
export const YEU_CAU = [
  "hoi_khach", "hoi_gia", "hoi_dien_tich", "hoi_dia_chi", "hoi_tang", "hoi_huong", "hoi_phap_ly", "hoi_trang_thai", "hoi_ban_chua",
  "hoi_noi_dang", "hoi_bao_lau_ban", "xin_so_khach", "xin_xoa_du_lieu", "xin_bo_o", "khong",
] as const;
export const O_BO = ["do_rong_hem", "gia", "phuong", "dien_tich", "so_phong_ngu", "ket_cau", "phap_ly", "huong", "vi_tri"] as const;
/** SRS-5.1zzl (05/10/2026, demo AOND thao tác phá dữ liệu chờ xác nhận): ngưng rao NHIỀU căn / chỉ giữ vài căn. */
export const KIEU_NHL = ["chi_giu", "an_het"] as const;
const YLuot = z.object({
  dong_y: z.enum(DONG_Y).describe("dong_y = GẬT / đồng ý / xác nhận điều bot VỪA nói; dong_y_dang = gật VÀ bảo đăng tin; khong_dong_y = nói không đúng / không đồng ý; khong_noi = không gật cũng không chối (chỉ đưa thông tin, hỏi lại, nói chuyện khác)."),
  dong_y_trich: z.string().nullable().describe("Cụm COPY NGUYÊN VĂN trong tin chủ nhà thể hiện ý ở dong_y. khong_noi thì null."),
  yeu_cau: z.enum(YEU_CAU).describe("Chủ nhà đang HỎI / XIN gì (xem LUẬT YÊU CẦU). Không thì khong."),
  yeu_cau_trich: z.string().nullable().describe("Cụm COPY NGUYÊN VĂN trong tin chủ nhà thể hiện yêu cầu. khong thì null."),
  yeu_cau_o: z.enum(O_BO).nullable().describe("CHỈ khi yeu_cau = xin_bo_o: ô chủ nhà xin bỏ (hẻm, giá, phường, diện tích, phòng ngủ, số tầng, pháp lý, hướng, địa chỉ). Không rõ ô nào thì null."),
  // 03/10/2026 (bộ đo X04, SRS-5.1zt): "em bán căn hộ q7 3 tỷ để mua nhà Bình Thạnh 6 tỷ" — câu vừa bán vừa mua chỉ vào nhánh bán,
  // khuôn bóc tách tin bán không có chỗ cho nhu cầu mua nên vế mua rơi. Vế mua là ý của NGƯỜI, đi lượt nhỏ này.
  mua_kem: z.object({
    khu_vuc: z.string().nullable().describe("Khu vực chủ nhà muốn MUA, chép như khách viết (\"Bình Thạnh\", \"q7\"). Không nói thì null."),
    ngan_sach: z.string().nullable().describe("Số tiền định MUA, chép như khách viết (\"6 tỷ\"). KHÔNG lấy giá căn đang bán. Không nói thì null."),
    loai: z.string().nullable().describe("Loại muốn mua, chép như khách viết (\"nhà\", \"căn hộ\", \"đất\"). Không nói thì null."),
    trich_dan: z.string().describe("Cụm COPY NGUYÊN VĂN trong tin chủ nhà nói về việc MUA."),
  }).nullable().describe("Chủ nhà NÓI MÌNH MUỐN MUA / TÌM MUA / ĐỔI SANG một bất động sản khác (ngoài căn đang rao). Không có thì null."),
  ngung_hang_loat: z.object({
    kieu: z.enum(KIEU_NHL).describe("chi_giu = chỉ giữ một / vài căn, ngưng rao các căn còn lại; an_het = ngưng rao / gỡ / ẩn TẤT CẢ căn."),
    giu: z.array(z.string()).describe("Cụm chỉ căn GIỮ LẠI, chép như khách viết ('căn Trần Hưng Đạo', 'căn 2', 'căn hẻm 4m'). an_het thì rỗng."),
    trich_dan: z.string().describe("Cụm COPY NGUYÊN VĂN trong tin thể hiện ý ngưng nhiều căn."),
  }).nullable().describe("Chủ nhà muốn ngưng rao / gỡ / ẩn NHIỀU căn một lúc, hoặc chỉ giữ một vài căn ('chỉ giữ căn A, ẩn hết còn lại', 'gỡ hết đi', 'ngưng rao hết trừ căn X'). Ngưng MỘT căn cụ thể, hỏi han, hay nói chuyện khác → null."),
  // SRS-5.1zzzn → 5.1zzzu (08/10/2026): bản đọc lại tin không dấu — từng nằm ở khuôn bóc tách, làm khuôn đó vượt giới hạn
  // grammar (15 trường cấp một, DC-13) → mọi lượt bóc tách 400. Đọc lại tin là việc của HỘI THOẠI (cần câu bot vừa nói), ở đây.
  doc_lai: z.string().nullable().describe("Tin chủ nhà NGẮN (dưới 200 chữ) gõ KHÔNG DẤU / viết tắt / sai chính tả → viết lại CÓ DẤU, đúng nghĩa theo câu bot vừa nói, chỉ thêm dấu và viết đủ chữ tắt, KHÔNG thêm ý, KHÔNG đổi số ('anh dung ten' → 'anh đứng tên'; 'dc e' → 'được em'). Tin đã có dấu đầy đủ, hoặc tin dài → null."),
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
dong_y_trich phải chép NGUYÊN VĂN từ TIN chủ nhà, không lấy từ câu bot.

LUẬT YÊU CẦU (yeu_cau) — chủ nhà HỎI về CHÍNH TIN của mình (thứ đã nói / đã ghi) hoặc XIN bot làm gì:
- hoi_khach: hỏi có khách nào hỏi / quan tâm / xem căn chưa ("có ai hỏi chưa em", "nay có mống nào ko").
- hoi_gia / hoi_dien_tich / hoi_dia_chi / hoi_tang / hoi_huong / hoi_phap_ly: hỏi LẠI con số / chi tiết của tin mình đã nói
  ("hồi nãy anh nói giá bao nhiêu nhỉ", "tin ghi mấy m2 vậy em"). Hỏi giá KHU VỰC / thị trường, hỏi dự án khác → khong.
- hoi_trang_thai: hỏi tin đã đăng / lên kệ / lên web chưa ("tin lên chưa em", "đăng được chưa").
- hoi_ban_chua: hỏi căn đã bán / chốt được chưa.
- hoi_noi_dang: hỏi tin đăng Ở ĐÂU (web nào, kênh nào).
- hoi_bao_lau_ban: hỏi bao lâu thì bán được / mất mấy tháng / có bán nhanh không.
- xin_so_khach: xin số điện thoại / Zalo / liên hệ của NGƯỜI MUA để tự gọi.
- xin_xoa_du_lieu: xin xoá tin / căn / hồ sơ / dữ liệu / tài khoản khỏi hệ thống (không phải ngưng rao vì bán rồi).
- xin_bo_o: xin bỏ / xoá MỘT chi tiết đã ghi nhầm mà KHÔNG đưa giá trị mới ("xoá cái hẻm 4m ghi nhầm đi"). Có giá trị mới
  ("bỏ hẻm 4m, hẻm đúng là 3m5") là lời sửa → khong.
- khong: tin đưa THÔNG TIN căn nhà (kể cả kèm hỏi "giá 4 tỷ 3 được không?"), gật, chào, hỏi về PHÍ / cách bên em làm việc, kể
  chuyện khác.
yeu_cau_trich phải chép NGUYÊN VĂN từ TIN chủ nhà.

LUẬT NGƯNG NHIỀU CĂN (ngung_hang_loat) — chủ nhà muốn ngưng rao / gỡ / ẩn NHIỀU căn trong một câu: "gỡ hết đi", "ngưng rao hết",
"chỉ giữ căn Trần Hưng Đạo, ẩn hết còn lại", "ngưng hết trừ căn 2" → kieu an_het hoặc chi_giu, giu là các cụm chỉ căn giữ lại.
Ngưng MỘT căn ("ngưng căn Nguyễn Trãi"), "bán rồi", hỏi "gỡ tin kiểu gì" → null.

LUẬT MUA KÈM (mua_kem) — chủ nhà nói CHÍNH MÌNH muốn mua / tìm mua / đổi sang căn khác ("bán căn này để mua nhà Bình Thạnh tầm 6
tỷ", "bán xong anh tính mua căn hộ q2"): khu_vuc, ngan_sach, loai chép NGUYÊN chữ khách trong phần nói về MUA, trich_dan là phần
đó. Giá / khu của căn đang BÁN không bao giờ vào mua_kem. Khách MUA HỘ người khác, kể chuyện đã mua trước đây ("anh mua căn này
năm 2019"), hỏi khách mua của tin mình → null.

ĐỌC LẠI (doc_lai) — tin NGẮN gõ không dấu / viết tắt → viết lại có dấu theo nghĩa câu bot vừa nói: "anh dung ten" (bot hỏi ai đứng
tên sổ) → "anh đứng tên"; "dc e" → "được em". Chữ không dấu đọc được HAI nghĩa mà câu bot không phân định → viết nghĩa
khớp với ô dong_y bạn vừa chọn. Chỉ thêm dấu, viết đủ chữ tắt; không thêm ý, không đổi số.
Tin đã có dấu, hoặc dài → null.`;

type ClientModel = {
  messages: {
    parse: (p: Record<string, unknown>) => Promise<{ parsed_output?: unknown; usage?: unknown }>;
  };
};
export type YLuotLLM = {
  /** undefined = model không trả ô gật (nơi gọi dùng luật làm lưới đỡ). */
  dongY?: { la: typeof DONG_Y[number]; trich_dan: string | null; dang_di: boolean };
  /** undefined = model không trả ô yêu cầu. */
  yeuCau?: { loai: typeof YEU_CAU[number]; trich_dan: string | null; o: typeof O_BO[number] | null };
  /** null = model nói không có vế mua; undefined = model không trả ô này. */
  muaKem?: { khu_vuc: string | null; ngan_sach: string | null; loai: string | null; trich_dan: string } | null;
  /** SRS-5.1zzl: null = model nói không có ý ngưng nhiều căn; undefined = model không trả ô này. */
  ngungHangLoat?: { kieu: typeof KIEU_NHL[number]; giu: string[]; trich_dan: string } | null;
  /** SRS-5.1zzzu: tin không dấu viết lại có dấu (nơi gọi kiểm `docLaiHopLe`). null / undefined = không có. */
  docLai?: string | null;
};

/** Hỏi model ý ngắn của lượt. `ket` null = model trả không đọc được (nơi gọi coi như AI không chạy). Model hỏng thì NÉM. */
export async function docYLuotBangModel(
  ai: ClientModel,
  model: string,
  tin: string,
  botVuaNoi: string | null,
): Promise<{ ket: YLuotLLM | null; usage: unknown }> {
  const r = await ai.messages.parse({
    model,
    max_tokens: 500,
    output_config: { effort: "low", format: FORMAT_Y_LUOT },
    system: [{ type: "text", text: LUAT, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: `${botVuaNoi?.trim() ? `Câu BOT vừa nói: "${botVuaNoi.trim().slice(0, 600)}"\n` : ""}Tin chủ nhà: "${(tin ?? "").slice(0, 1500)}"`,
    }],
  });
  // Mỗi ô đọc RIÊNG: ô này hỏng không kéo ô kia (ô hỏng = undefined = luật đỡ đúng việc đó).
  const o = (r.parsed_output && typeof r.parsed_output === "object" ? r.parsed_output : {}) as Record<string, unknown>;
  const str = (x: unknown) => typeof x === "string" && x.trim() ? x : null;
  const dy = (DONG_Y as readonly unknown[]).includes(o.dong_y) ? o.dong_y as typeof DONG_Y[number] : undefined;
  const yc = (YEU_CAU as readonly unknown[]).includes(o.yeu_cau) ? o.yeu_cau as typeof YEU_CAU[number] : undefined;
  const ket: YLuotLLM = {
    ...(dy ? { dongY: { la: dy === "dong_y_dang" ? "dong_y" : dy, trich_dan: str(o.dong_y_trich), dang_di: dy === "dong_y_dang" } } : {}),
    ...(yc ? { yeuCau: { loai: yc, trich_dan: str(o.yeu_cau_trich), o: (O_BO as readonly unknown[]).includes(o.yeu_cau_o) ? o.yeu_cau_o as typeof O_BO[number] : null } } : {}),
    ...("mua_kem" in o ? { muaKem: docMuaKemTho(o.mua_kem) } : {}),
    ...("ngung_hang_loat" in o ? { ngungHangLoat: docNHLTho(o.ngung_hang_loat) } : {}),
    ...(str(o.doc_lai) ? { docLai: str(o.doc_lai) } : {}),
  };
  return { ket: dy || yc || "ngung_hang_loat" in o ? ket : null, usage: r.usage };
}

function docNHLTho(x: unknown): YLuotLLM["ngungHangLoat"] {
  if (!x || typeof x !== "object") return null;
  const m = x as Record<string, unknown>;
  if (!(KIEU_NHL as readonly unknown[]).includes(m.kieu)) return null;
  const td = typeof m.trich_dan === "string" && m.trich_dan.trim() ? m.trich_dan.trim() : null;
  if (!td) return null;
  const giu = Array.isArray(m.giu) ? m.giu.filter((g): g is string => typeof g === "string" && g.trim().length > 0).map((g) => g.trim()) : [];
  return { kieu: m.kieu as typeof KIEU_NHL[number], giu, trich_dan: td };
}

function docMuaKemTho(x: unknown): YLuotLLM["muaKem"] {
  if (!x || typeof x !== "object") return null;
  const m = x as Record<string, unknown>;
  const str = (v: unknown) => typeof v === "string" && v.trim() ? v.trim() : null;
  const td = str(m.trich_dan);
  return td ? { khu_vuc: str(m.khu_vuc), ngan_sach: str(m.ngan_sach), loai: str(m.loai), trich_dan: td } : null;
}
