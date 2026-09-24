// khop-cau-tra-loi.ts — câu chủ nhà vừa nhắn CÓ PHẢI câu trả lời cho câu hỏi
// đang treo không? (FR-176)
//
// VÌ SAO. Lượt rao 07/09/2026 (tin #BDS-Q5-0174): bot hỏi pháp lý, chủ nhà
// nhắn "Kêu chị nha" → ghi thành ĐÁP ÁN pháp lý; hỏi hướng, chủ nhắn "16m nha"
// → cột `direction` thành chữ "16m nha"; hỏi diện tích đất, chủ nhắn "Ngang 5"
// → câu hỏi diện tích ĐÓNG mà `area_m2` vẫn trống. Ba câu hỏi đóng bằng ba câu
// không phải câu trả lời, và bot không bao giờ hỏi lại — tin lên kệ với pháp
// lý rỗng, hướng là rác. Trước bản này khối drip lấy NGUYÊN câu chat làm đáp
// án, không kiểm gì; chỉ `loai_bds` có đường "không đọc ra thì hỏi lại".
//
// Đây là tầng bóc tách TIỀN ĐỊNH (bot/tests/ranh-gioi.mjs): không model, không
// RPC, chạy và kiểm được mà không tốn một đồng. Nó chỉ trả lời "khớp / không
// khớp / thuộc loại gì", còn NÓI GÌ với chủ nhà là việc của tầng trên.
//
// Luật chung: thà HỎI LẠI một câu thừa còn hơn ĐÓNG một câu hỏi bằng rác —
// câu hỏi đóng sai không bao giờ tự lộ, câu hỏi thừa thì chủ nhà thấy ngay.

// Luật tiền MỘT NGUỒN (tầng bốn, 11/09): trước đây file này chép tay
// `(ty|ti|toi|trieu|tr)` ở năm chỗ, không chỗ nào biết "toi" + số là TỚI —
// nên "5 tới 6 tỷ" ghi giá "5 tới 6" (mục D1 review 10/09).
import { TIEN_KD, CO_TIEN_KD, TIEN_T_KEP } from "./luat-tien.ts";
import { TRUOC_LA_SAN, TRUOC_LA_THUE } from "./boc-cau-rao.ts";

export type LoaiCau =
  | "khop"      // đúng là câu trả lời cho câu đang hỏi → ghi fact, đóng câu hỏi
  | "xung_ho"   // dặn cách gọi ("kêu chị nha") → nhớ, KHÔNG ghi fact, hỏi lại
  | "ack"       // tiểu từ / ừ / ok / để coi → không ghi, hỏi lại nhẹ
  | "hoi"       // chủ nhà HỎI ngược ("phí sao em?") → trả lời rồi hỏi lại
  | "hoan"      // bận / để hỏi vợ / hỏi hoài → KHÔNG ghi, KHÔNG hỏi thêm, câu vẫn treo
  | "lech";     // có nội dung nhưng không khớp câu hỏi → không ghi, hỏi rõ

/**
 * Cách gọi khách (FR-176). 16/09/2026 (Zalo thật): khách nhắn "Chào cháu chú có căn
 * nhà này cần giao bán" mà bot đáp "Dạ em…" — xưng "chú" là NAM LỚN TUỔI, bot phải
 * gọi "chú" và tự xưng "cháu". Ba từ mới: chú / cô / bác (bác không rõ nam hay nữ).
 * 23/09/2026 (Zalo thật): "chào cháu, ông bán nhà Trần Bình Trọng Q5 7 tỷ" mà bot đáp "Dạ cháu chào mình ạ!"
 * — thêm ông / bà (người già hơn chú cô), cùng họ hàng hay gặp: dì, cậu, mợ, thím, dượng. Tất cả xưng cháu.
 */
export type XungHo = "anh" | "chị" | "chú" | "cô" | "bác" | "ông" | "bà" | "dì" | "cậu" | "mợ" | "thím" | "dượng";
export const XUNG_HO_LON_TUOI: ReadonlySet<string> = new Set(["chú", "cô", "bác", "ông", "bà", "dì", "cậu", "mợ", "thím", "dượng"]);
export const XUNG_HO_HOP_LE: ReadonlySet<string> = new Set(["anh", "chị", ...XUNG_HO_LON_TUOI]);
/** Bot tự xưng gì khi gọi khách là `xh`: em ↔ anh/chị, cháu ↔ chú/cô/bác/ông/bà/dì/cậu/mợ/thím/dượng. */
export const tuXungBot = (xh: string | null | undefined): "em" | "cháu" =>
  xh && XUNG_HO_LON_TUOI.has(xh) ? "cháu" : "em";
/** Giới tính + nhóm tuổi suy từ cách gọi (ghi `sellers.gioi_tinh`, `sellers.nhom_tuoi`). */
export function suyTuXungHo(xh: XungHo): { gioi_tinh: "nam" | "nu" | null; nhom_tuoi: "tre" | "lon_tuoi" } {
  const nam = ["anh", "chú", "ông", "cậu", "dượng"].includes(xh);
  const nu = ["chị", "cô", "bà", "dì", "mợ", "thím"].includes(xh);
  return { gioi_tinh: nam ? "nam" : nu ? "nu" : null, nhom_tuoi: XUNG_HO_LON_TUOI.has(xh) ? "lon_tuoi" : "tre" };
}

export type KetQuaKhop = {
  loai: LoaiCau;
  /** Cách xưng hô chủ nhà dặn, chỉ có khi loai = "xung_ho". */
  xungHo?: XungHo;
  /**
   * Câu không khớp câu đang hỏi nhưng khớp RÕ một fact khác → ghi vào đó
   * (FR-177 e: hỏi một đường, trả lời một nẻo thì VẪN ghi). Không nhận ra
   * fact nào thì tầng trên ghi nguyên văn vào fact `bo_sung`.
   */
  chuyenSang?: { question: string; answer: string };
  /**
   * 15/09/2026 (Zalo thật): câu vừa TRẢ LỜI vừa HỎI NGƯỢC ("Nhà 5 tầng, có thang máy
   * thì phải, bạn có biết xung quanh khu này có tiện ích gì không") → phần hỏi tách ra
   * đây để tầng trên trả lời TRƯỚC câu kế; phần trả lời ở `dapAn` (ghi fact bằng nó,
   * không ghi cả câu).
   */
  hoiNguoc?: string;
  dapAn?: string;
};

const boDau = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase();

// ── Xưng hô ───────────────────────────────────────────────────────────────────
// "kêu chị nha", "gọi anh đi", "chị chứ không phải anh", "em là chị", "xưng chị
// nha em", "đừng gọi anh". Bắt CẢ câu chỉ có ý này; câu dài có kèm dữ liệu
// ("chị nha, sổ hồng riêng") thì phần dữ liệu vẫn được xét ở dưới.
const XUNG_HO_RE =
  /\b(?:keu|goi|xung|dung (?:keu|goi))\s*(?:la\s*|toi la\s*|minh la\s*)?(anh|chi|co|chu|bac)\b|\b(?:toi|minh|tui|em)\s*la\s*(anh|chi)\b(?!\s*(?:chu|chinh|cua))|\b(anh|chi)\s*(?:chu|ma|nha|nhe)\s*(?:khong phai|ko phai|k phai)\s*(?:anh|chi)\b|^\s*(chi|anh)\s*(?:nha|nhe|nhen|day|a)?\s*[.!]?\s*$|^\s*(chi|anh)\s*(?:nha|nhe|nhen|oi)\s*[,.;!]/;

const DOI_XUNG_HO: Record<string, XungHo> = { anh: "anh", chi: "chị", co: "cô", chu: "chú", bac: "bác" };
const XUNG_HO_LON_TRO = /^\s*(?:dạ\s*)?(chú|cô|bác|ông|bà|dì|cậu|mợ|thím|dượng)\s*(?:nha|nhé|nhen|đây|ạ|nè)?\s*[.!]?\s*$/u;
// ông/bà/dì/cậu/mợ/thím/dượng chỉ bắt trên chữ CÒN DẤU: bỏ dấu thì "ba" là số ba / ba = cha, "ong" là "ống",
// "di" là "đi", "cau" là "câu"; "gọi ông chủ", "kêu bà ngoại" là người thứ ba.
const GOI_ONG_BA_RE =
  /(?<![\p{L}])(?:kêu|gọi|xưng)\s+(?:là\s+)?(ông|bà|dì|cậu|mợ|thím|dượng)(?![\p{L}])(?!\s+(?:chủ|ấy|ta|kia|đó|này|bà|ông|ngoại|nội|thợ|cò|môi giới|xe|bảo vệ|hàng xóm))/u;
export function batXungHo(text: string): XungHo | null {
  // 22/09/2026: "cô" / "chú nha" trơ trọi (CÒN DẤU — bỏ dấu thì "cô" trùng "có") là câu trả lời cho
  // "cháu gọi chú hay cô cho tiện ạ?".
  const mLon = XUNG_HO_LON_TRO.exec(text.trim().toLowerCase());
  if (mLon) return mLon[1] as XungHo;
  const mOngBa = GOI_ONG_BA_RE.exec(text.toLowerCase());
  if (mOngBa) return mOngBa[1] as XungHo;
  const kd = boDau(text);
  const m = XUNG_HO_RE.exec(kd);
  if (!m) return null;
  const tu = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5];
  // 16/09/2026: "kêu cô/chú/bác" từng bị ép về anh/chị (cột chỉ có hai giá trị).
  return DOI_XUNG_HO[tu] ?? "anh";
}

// ── Khách TỰ XƯNG (11/09/2026, lượt bắn 42 ca) ───────────────────────────────
// 34/52 câu bot viết "anh/chị" dù khách đã tự xưng: "anh bận", "để anh hỏi vợ",
// "e oi a can ban nha", "chị Lan đây em". Người thật nghe một lần là gọi đúng.
// Lời DẶN tường minh ("kêu chị nha", `batXungHo`) vẫn thắng; hàm này chỉ dùng
// khi chưa biết gọi sao.
const TU_XUNG: RegExp[] = [
  /^\s*(?:e|em)\s*(?:oi)?\s*[,.]?\s*(a|anh|c|chi)\s+(?:can|muon|co|dang|ban|hoi|nho|gui)\b/,
  /^\s*(anh|chi)\s+[a-z]+\s+(?:day|nay)\b/,
  /^\s*(anh|chi|a|c)\s+(?:can|muon|co|dang|khong|ko|chua|hoi|tinh|de|o|moi|vua|gui|ban|nho|thay|nghi|cung)\b/,
  /\b(?:nha|can|so|dat|lo|sdt|so dien thoai|so dt|vo|chong)\s+(?:cua\s+)?(anh|chi)\b(?!\s+(?:ay|nay|kia|hang xom))/,
  /\bde\s+(anh|chi)\s+(?:hoi|tinh|coi|xem|nghi|ban|suy nghi)\b/,
  /\b(anh|chi)\s+(?:ban|dang ban|met|khong ranh|chua ranh|dang lai xe|dang hop)\b/,
  // 22/09/2026 (bắn thật): "hồi nãy anh nói giá bao nhiêu nhỉ" — tự xưng khi nhắc lại lời mình.
  /\b(?:hoi nay|luc nay|khi nay|ban nay|nay)\s+(anh|chi)\s+(?:noi|bao|ke|nhan|gui|co noi)\b/,
  // 13/09/2026 (bàn giao 11/09 lỗi a): tự xưng GIỮA câu, sau lời chào hay dấu
  // phẩy — "chào em, anh cần bán nhà", "dạ em, chị gửi ảnh nha". Các mẫu trên
  // neo đầu câu nên trượt. Chỉ nhận chữ đủ "anh/chi" ở đây — "a"/"c" giữa câu
  // quá dễ là tiểu từ "à".
  /(?:[,.;!?]|\b(?:chao|da|vang|alo|ok|oke|ua|thi)\s+em(?:\s+oi)?)\s*(anh|chi)\s+(?:can|muon|co|dang|tinh|dinh|hoi|gui|ban|nho|o|moi|vua|de|thay|nghi)\b/,
];
// 16/09/2026 (Zalo thật): "Chào cháu chú có căn nhà này cần giao bán" — khách tự xưng
// CHÚ / CÔ / BÁC. Chỉ bắt trên chữ CÒN DẤU: bỏ dấu thì "cô" trùng "có", "chú" trùng
// "chủ" ("chủ cần bán" là môi giới nói về chủ nhà), "bác" trùng "bạc". "cô giáo",
// "bác sĩ", "chú ấy / cô này" là người thứ ba, không phải người đang nhắn.
const TU_XUNG_LON: RegExp[] = [
  // 22/09/2026 (chủ dự án: "người ta chào là cô chào cháu nó vẫn đáp anh chị"): lời CHÀO cũng là tự xưng —
  // "cô chào cháu", "chú chào cháu nha", "chào cháu, cô đây". Bản trước chỉ bắt chú/cô/bác + động từ có/cần/bán.
  /(?<![\p{L}])(chú|cô|bác|ông|bà|dì|cậu|mợ|thím|dượng)\s+chào\s+(?:cháu|con|em)(?![\p{L}])/u,
  /(?<![\p{L}])chào\s+(?:cháu|con)\s*[,.!]?\s*(chú|cô|bác|ông|bà|dì|cậu|mợ|thím|dượng)(?:\s+(?:đây|nè|nha|ạ|ơi))?\s*[,.!]?\s*$/u,
  // `\b` chỉ biết chữ ASCII ("có" + khoảng trắng không phải ranh từ) → dùng (?<![\p{L}]) / (?![\p{L}\d]).
  /(?:^|[,.;!?]\s*|(?<![\p{L}])chào\s+(?:cháu|con|em)\s*,?\s*|(?<![\p{L}])(?:dạ|vâng|alo|ok|ừ|thì)\s+(?:cháu|em)(?:\s+ơi)?\s*,?\s*)(chú|cô|bác|ông|bà|dì|cậu|mợ|thím|dượng)\s+(?:có|cần|muốn|đang|bán|hỏi|nhờ|gửi|tính|định|ở|mới|vừa|để|thấy|nghĩ|đây|không|chưa|rao)(?![\p{L}\d])/u,
  // Mẫu sở hữu KHÔNG nhận ông/bà/họ hàng: "nhà ông bà để lại", "nhà bà ngoại", "nhà dì tôi" là người thứ ba.
  /(?<![\p{L}])(?:nhà|căn|sổ|đất|lô|sđt|số điện thoại|số đt|vợ|chồng)\s+(?:của\s+)?(chú|cô|bác)(?![\p{L}\d])(?!\s+(?:ấy|này|kia|đó|hàng xóm|giáo|sĩ))/u,
  /(?<![\p{L}])để\s+(chú|cô|bác|ông|bà|dì|cậu|mợ|thím|dượng)\s+(?:hỏi|tính|coi|xem|nghĩ|bàn|suy nghĩ)(?![\p{L}\d])/u,
  /(?<![\p{L}])(chú|cô|bác|ông|bà|dì|cậu|mợ|thím|dượng)\s+(?:bận|đang bận|mệt|không rảnh|chưa rảnh)(?![\p{L}\d])/u,
];
export function tuXungTuCau(text: string): XungHo | null {
  const cd = text.trim().toLowerCase();
  for (const re of TU_XUNG_LON) {
    const m = re.exec(cd);
    if (m) return m[1] as XungHo;
  }
  const kd = boDau(text.trim());
  for (const re of TU_XUNG) {
    const m = re.exec(kd);
    if (m) return m[1] === "chi" || m[1] === "c" ? "chị" : "anh";
  }
  // 15/09/2026 (bắn thật A3/A5): "để mình hỏi vợ đã", "ok vợ mình chốt 4 tỷ" → người
  // nói là chồng, gọi "anh"; bot từng đổi sang "chị" ở lượt sau. "vợ chồng mình" thì thôi.
  if (!/\bvo chong\b/.test(kd)) {
    if (/\b(?:vo|ba xa)\s+(?:cua\s+)?(?:minh|toi|tui|em|t)\b|\bhoi\s+(?:y\s+)?(?:vo|ba xa)\b/.test(kd)) return "anh";
    if (/\b(?:chong|ong xa)\s+(?:cua\s+)?(?:minh|toi|tui|em|t)\b|\bhoi\s+(?:y\s+)?(?:chong|ong xa)\b/.test(kd)) return "chị";
  }
  return null;
}

// ── Bận / hoãn / khó chịu (11/09/2026, lượt bắn 42 ca) ──────────────────────
// "hỏi gì hỏi lắm vậy em, anh bận" từng được ghi vào ô PHƯỜNG; "để anh hỏi vợ
// đã em" vào thông tin bổ sung, rồi bot hỏi tiếp đúng câu cũ (38 từ). Đây không
// phải câu trả lời mà là lời xin dừng: không ghi gì, không hỏi thêm, câu hỏi
// vẫn treo cho lượt sau. "bận" chỉ phân biệt được với "bán" khi còn dấu.
const HOAN_CD = /(?<![\p{L}])(?:bận|mệt)(?![\p{L}])|hỏi (?:gì )?(?:hoài|lắm|nhiều|mãi)/iu;
const HOAN_KD =
  /\b(?:de (?:anh|chi|em|toi|tui|minh|a|c) (?:hoi|tinh|suy nghi|coi lai|xem lai|nghi|ban bac)|(?:hoi|ban|noi)\s+(?:y\s+|voi\s+|lai\s+)?(?:vo|chong|ba|me|con|gia dinh|anh em)|tinh sau|de sau|luc khac|khi khac|noi sau|bua khac|hom khac|chua ranh|khong ranh|ko ranh|dang lai xe|dang hop|hoi hoai|hoi (?:lai )?sau|thoi de do)\b/;
export function laHoanLai(text: string): boolean {
  const goc = text.trim();
  if (!goc || /\d/.test(goc)) return false; // có số là có dữ liệu — xét như câu trả lời
  return HOAN_CD.test(goc) || HOAN_KD.test(boDau(goc));
}

// ── Phủ định trong lời sửa (11/09/2026, lượt bắn 42 ca) ───────────────────────
// "sai rồi em, phường 9 chứ không phải phường 4" → ô phường vẫn Phường 4, vị
// trí thành "sai rồi em, chứ không phải phường 4", mà bot báo "đã cập nhật
// Phường 9". Vế sau "không phải" là cái SAI — không được bóc ra làm dữ liệu.
// Che bằng khoảng trắng CÙNG ĐỘ DÀI để chỉ số khớp trên câu gốc vẫn đúng.
const PHU_DINH =
  /(?:,\s*)?(?:(?:chứ|chu)\s+)?(?:không|khong|ko|chẳng|chang)\s+(?:phải|phai)(?:\s+(?:là|la))?\s+[^,.;!?\n]*?(?=\s+(?:mà|ma)\s|[,.;!?\n]|$)/giu;
export function vungPhuDinh(text: string): Array<[number, number]> {
  return Array.from(text.matchAll(PHU_DINH), (m) => [m.index!, m.index! + m[0].length] as [number, number])
    .filter(([i, j]) => j > i);
}
export function cheoPhuDinh(text: string): string {
  return text.replace(PHU_DINH, (s) => " ".repeat(s.length));
}

// ── Câu trả lời kèm LỜI DẶN (11/09/2026, Zalo thật, dự án ehome 3) ────────────
// Đang hỏi địa chỉ, chủ nhà nhắn "Bạn phải ghi dự án chung cư ehome 3 chứ ở hồ
// ngọc lãm" → cả câu vào ô vị trí, rồi thành location_raw và street. Câu có lời
// dặn/sửa thì chỉ giữ CỤM địa chỉ ("hồ ngọc lãm"). Câu trả lời phường có số thì
// ghi gọn "Phường N" thay vì cả câu "Đường hồ ngọc lãm quận 8 phường 6".
const LENH_DAN = /\b(?:ban phai|em phai|phai ghi|ghi lai|ghi giup|ghi la|sua lai|sua thanh|chu khong phai|khong phai|nham roi|sai roi)\b/;
/**
 * Câu là LỜI SỬA ("à sửa lại, dài 16 chứ không phải 15") → bỏ vế phủ định và chữ lệnh, còn lại
 * phần dữ liệu; đọc ngang/dài nếu có. 20/09/2026 (bắn thật mau-y-D): nguyên câu từng vào ô bổ
 * sung và in ra bản nháp "📝 Thêm: à sửa lại, dài 16 chứ không phải 15" dù cột dài đã đổi.
 */
export function gonLoiSua(text: string): { laSua: boolean; con: string; ngang: string | null; dai: string | null } {
  const kd = boDau(text);
  const laSua = LENH_DAN.test(kd) || /^\s*(?:a|à|ờ|ừ)\s*,?\s*(?:sua|sửa|nham|nhầm|sai)\b/iu.test(text);
  const con = cheoPhuDinh(text)
    .replace(/\b(?:bạn phải|em phải|phải ghi|ghi lại|ghi giúp|ghi là|sửa lại|sửa thành|chứ không phải|không phải|nhầm rồi|sai rồi|ban phai|em phai|phai ghi|ghi lai|ghi giup|ghi la|sua lai|sua thanh|chu khong phai|khong phai|nham roi|sai roi)\b/giu, " ")
    .replace(/\s+/g, " ").replace(TIEU_TU_DAU, "").replace(/^[\s,.;:–-]+|[\s,.;:–-]+$/g, "").trim();
  const kdCon = boDau(con);
  const dai = /\b(?:dai|sau|doc)\s*(?:la\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|met)?(?![\d])/.exec(kdCon)?.[1] ?? null;
  const ngang = /\b(?:ngang|mat tien|mt|rong)\s*(?:la\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|met)?(?![\d])/.exec(kdCon)?.[1] ?? null;
  return { laSua, con, ngang, dai };
}

export function bocCumDiaChi(text: string): string | null {
  const t = text.trim();
  const m = /(?:^|[\s,])(?:ở|tại)\s+([^,.;!?\n]{3,80})$/iu.exec(t) ??
    /(?:^|[\s,])((?:đường|duong|hẻm|hem|hxh|phố|số nhà)\s+[^,.;!?\n]{2,80})/iu.exec(t);
  return m ? m[1].trim() : null;
}
// Chữ TẢ CON ĐƯỜNG (không phải tên đường): "hẻm xe hơi 4m", "đường nhựa 7m",
// "hẻm thông", "hẻm bê tông". Tên đường là chữ KHÔNG nằm trong bảng này.
const TU_TA_DUONG = new Set([
  "xe", "hoi", "may", "tai", "thong", "cut", "rong", "nho", "lon", "be", "tong",
  "nhua", "dat", "vao", "ra", "trong", "thuong", "co", "truoc", "sau", "noi",
  "met", "m", "mo", "cua", "nha", "ban", "ngang", "dai", "cho",
  // 14/09/2026: "hẻm ba gác đường Phạm Thế Hiển" → "ba gác" từng bị đọc là TÊN đường.
  "ba", "gac",
  // 15/09/2026 (bắn thử kho xưởng): "đường xe container" → street "xe container".
  "container", "cont", "tai",
  // 24/09/2026 (chủ dự án test Zalo): "mặt tiền ngay nút giao Trần Đình Xu" → tên đường từng thành "ngay nút giao Trần".
  "ngay", "nut", "giao",
]);
// Tên quận/huyện đứng ngay sau tên đường ("hxh Nguyễn Kiệm Phú Nhuận") — gặp là hết tên đường.
const QUAN_SAU_TEN = /^(?:phu nhuan|tan binh|binh thanh|go vap|tan phu|binh tan|thu duc|nha be|binh chanh|hoc mon|cu chi|can gio)$/;
// 15/09/2026 (bắn thử): "hẻm 5m Lê Đức Thọ gò vấp" → tên đường "Lê Đức" — "tho" nằm
// trong TU_DUNG (vì "thổ cư") nên cắt cụt Lê Đức Thọ. Chữ ĐA NGHĨA chỉ dừng khi đi
// thành CỤM hai chữ của thứ khác: "thổ cư", "thổ đất".
// 24/09/2026: "mặt tiền Hợp đồng thuê…" — "hợp đồng" không mở đầu tên đường nào.
const DUNG_HAI_CHU = /^(?:tho cu|tho dat|hop dong)$/;
/** "hợp đồng" nói về HỢP ĐỒNG THUÊ đang chạy (không phải giấy tờ nhà). */
const HOP_DONG_THUE_RE = /\bhop dong\s+(?:thue\s+)?\d+\s*(?:nam|thang)\b|\bhop dong\b[^,.;]{0,40}\b(?:thue|het han|con \d+ (?:nam|thang)|(?:den|toi)\s*(?:nam\s*)?20\d\d)\b|\b(?:cho|khach|dang|ngan hang)\b[^,.;]{0,30}\bthue\b[^,.;]{0,20}\bhop dong\b|\b(?:het han|con)\s+hop dong\b/;

/**
 * Mảnh RÁC không đáng vào "📝 Thêm" (24/09/2026, tin thật 152 Trần Đình Xu: "Quận 1 em ơi", "mới"):
 * bỏ từ đệm / xưng hô / "ơi" mà còn dưới 2 chữ, hoặc chỉ còn tên một đơn vị hành chính (quận / phường / xã…).
 */
export function laBoSungRac(s: string | null | undefined): boolean {
  const kd = boDau(s ?? "").replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(?:em|e|anh|a|chi|c|oi|nha|nhe|nhen|nghen|a|ah|ha|nhi|luon|vay|thoi|roi|ok|oke|uh|uhm|um|da|vang)\b/g, " ")
    .replace(/\s+/g, " ").trim();
  if (!kd || kd.split(" ").length < 2) return true;
  return /^(?:o\s+|tai\s+|thuoc\s+)?(?:quan|q|huyen|phuong|p|xa|thi tran|tp|thanh pho)\s*[a-z0-9 ]{0,24}$/.test(kd) && kd.split(" ").length <= 5;
}

// Chữ mở đầu THỨ KHÁC — gặp là hết tên đường: giấy tờ, giá, kết cấu, hành chính.
// "đường nhựa 7m sổ riêng 850tr" dừng ở "sổ", không nuốt cả câu.
//
// Bảng này CỐ Ý NGẮN và chỉ chứa chữ KHÔNG BAO GIỜ mở đầu tên đường Sài Gòn.
// Bản nháp đầu có "an", "cống", "điện", "nam", "cô" — tức là giết luôn An Dương
// Vương, Cống Quỳnh, Điện Biên Phủ, Nam Kỳ Khởi Nghĩa, Cô Giang. Thà giữ dư một
// hai chữ rác trong địa chỉ còn hơn mất tên đường thật.
const TU_DUNG = new Set([
  // 17/09/2026: "hẻm 2 xẹc nhưng hẻm rộng" từng thành địa chỉ — "xẹc" là bậc hẻm, "nhưng/mà" là nối câu.
  "xec", "sec", "set", "xet", "nhung", "ma",
  "so", "giay", "gia", "ban", "mua", "thue", "huong", "full", "that", "tret",
  "lau", "tang", "phong", "ngu", "wc", "toilet", "hoan", "gap", "luong",
  "tich", "phuong", "quan", "huyen", "khong", "ngap", "xay",
  // 15/09/2026 (Zalo thật): "đường Lê Văn Việt mới làm lại rất rộng" → tên đường
  // "Lê Văn Việt mới" (trần 4 chữ vô tình cắt đúng trước "làm"), geocode tra
  // "Lê Văn Việt mới" ra rỗng. "Mới" không mở đầu tên đường Sài Gòn nào.
  "moi",
  // KHÔNG có "duong"/"hem" ở đây: bỏ dấu thì "Dương" (An Dương Vương, Dương Bá
  // Trạc) trùng "đường" — thêm vào là cắt cụt tên đường thật.
  "ty", "ti", "trieu", "m2", "shr", "hdmb",
]);

/**
 * Chữ dừng tên đường, xét CẢ DẤU (bắn thật 23/09: "hẻm Nguyễn Tri Phương quận 10" → "hẻm Nguyễn Tri"; cùng lỗi với
 * "Lê Hồng Phong", "Lương Nhữ Học", "Huyền Trân Công Chúa"…): bỏ dấu thì tên người trùng chữ dừng. Chữ CÓ DẤU chỉ
 * dừng khi đúng dạng có dấu của chữ dừng ("phường", "phòng", "lượng"); chữ gõ KHÔNG DẤU giữ cách cũ (dừng), trừ
 * phuong / huong / phong — ba chữ này dừng khi chữ SAU cho thấy nghĩa ("phuong 5", "huong dong", "phong ngu").
 */
const DANG_CO_DAU: Record<string, readonly string[]> = {
  xec: ["xẹc"], sec: ["sẹc"], set: ["sẹt"], xet: ["xẹt"], nhung: ["nhưng"], ma: ["mà"], so: ["sổ", "số"],
  giay: ["giấy"], gia: ["giá"], ban: ["bán"], thue: ["thuê"], huong: ["hướng"], that: ["thật"], tret: ["trệt"],
  lau: ["lầu"], tang: ["tầng"], phong: ["phòng"], ngu: ["ngủ"], hoan: ["hoàn"], gap: ["gấp"], luong: ["lượng"],
  tich: ["tích"], phuong: ["phường"], quan: ["quận"], huyen: ["huyện"], khong: ["không"], ngap: ["ngập"],
  xay: ["xây"], moi: ["mới"], ty: ["tỷ", "tỉ"], ti: ["tỉ", "tỷ"], trieu: ["triệu"],
};
function laTuDungTen(w: string, sau: string): boolean {
  const kd = boDau(w);
  if (!TU_DUNG.has(kd)) return false;
  const thuong = w.toLowerCase();
  if (thuong === kd) {
    const kdSau = boDau(sau);
    if (kd === "phuong") return /^\d/.test(kdSau);
    if (kd === "huong") return /^(?:dong|tay|nam|bac)/.test(kdSau);
    if (kd === "phong") return /^(?:ngu|khach|tam|wc|\d)/.test(kdSau);
    return true;
  }
  const dang = DANG_CO_DAU[kd];
  return dang ? dang.includes(thuong) : true;
}

/**
 * VỊ TRÍ trong CÂU RAO: "hẻm xe hơi 5m Nguyễn Trãi p3 q5" → "hẻm xe hơi 5m Nguyễn Trãi".
 *
 * 12/09/2026 (bắn 20 tin thật): bản trước loại NGUYÊN cụm khi chữ ngay sau
 * "hẻm/đường" là chữ tả đường ("xe", "nhựa", "rộng") — ý đúng là để "hẻm xe hơi
 * 4m" không thành tên đường, nhưng nó vứt luôn TÊN ĐƯỜNG đứng sau, nên 7/7 tin
 * của lượt bắn có `location_raw` rỗng và bot hỏi địa chỉ vòng vòng.
 *
 * Nay: cắt mệnh đề địa chỉ tới trước phường/quận/giá/dấu phẩy, rồi hỏi một câu
 * duy nhất — sau mấy chữ tả đường, CÓ tên riêng nào không? Có thì giữ cả cụm
 * (bề rộng hẻm là thứ đáng giữ trong địa chỉ), không có thì trả null.
 */
export function bocViTriRao(text: string): string | null {
  const t = (text ?? "").trim();
  // Mệnh đề bắt đầu từ chữ hẻm/đường tới dấu ngắt câu gần nhất. 14/09/2026: "nhà phố" /
  // "mặt phố" là LOẠI nhà, không phải "phố <tên>" — bỏ qua, tìm chữ mở đầu kế tiếp.
  let menh: string | null = null;
  // 15/09/2026 (bắn thật N1): "mặt tiền Nguyễn Chí Thanh" cũng là địa chỉ.
  // 24/09/2026 (chủ dự án test Zalo): "Góc 2 mặt tiền⏎Hợp đồng thuê Sacombank…" — `\s+` sau chữ mở đầu nuốt cả dấu
  // XUỐNG DÒNG, địa chỉ thành "mặt tiền Hợp đồng" và bot tưởng căn khác, tạo tin thứ hai. Chỉ khoảng trắng cùng dòng.
  const reMenh = /(?:^|[\s,(])((?:đường|duong|hẻm|hem|hxh|phố|pho|ngõ|ngo|mặt tiền|mat tien|mt)[ \t]+[^,.;!?\n]{2,70})/giu;
  for (let mm = reMenh.exec(t); mm; mm = reMenh.exec(t)) {
    const truoc = boDau(t.slice(Math.max(0, mm.index - 6), mm.index + 1));
    // "mặt tiền 4m" là CHIỀU NGANG, không phải địa chỉ — tìm tiếp sau chữ "mặt tiền".
    if (/^(?:mặt tiền|mat tien|mt)\s+\d/iu.test(mm[1])) {
      reMenh.lastIndex = mm.index + mm[0].length - mm[1].length + 2;
      continue;
    }
    if (/^(?:pho|phố)\s/iu.test(mm[1]) && /\b(?:nha|mat)\s*$/.test(truoc)) {
      // Mệnh đề "phố Tân Bình đường Cộng Hòa" đã nuốt tới dấu phẩy — tìm lại ngay sau chữ "phố".
      reMenh.lastIndex = mm.index + mm[0].length - mm[1].length + 3;
      continue;
    }
    menh = mm[1].trim();
    break;
  }
  if (menh) {
    const tu = menh.split(/\s+/);
    const haiChu = /^(?:mặt tiền|mat tien)\s/iu.test(menh);
    // "mặt tiền đường An Dương Vương" → mệnh đề địa chỉ bắt đầu từ "đường".
    const dauSau = haiChu && /^(?:đường|duong|hẻm|hem|hxh|phố|pho|ngõ|ngo)$/iu.test(tu[2] ?? "");
    const dau = dauSau ? tu[2] : haiChu ? `${tu[0]} ${tu[1]}` : tu[0];
    let i = dauSau ? 3 : haiChu ? 2 : 1;
    // Chữ TẢ đường và bề rộng/số nhà đứng trước tên: "xe hơi 5m", "102". 14/09/2026: cả
    // chữ "đường"/"phố" CÓ DẤU nằm giữa ("hẻm ba gác đường Phạm Thế Hiển") — bỏ dấu thì
    // "đường" trùng "Dương" (An Dương Vương), nên chỉ nhận bản có dấu.
    // 24/09/2026 (chủ dự án test Zalo): "đường số 59 Gò vấp" — đường ĐÁNH SỐ (Gò Vấp, Bình Tân, Thủ Đức…): "số" là
    // chữ dừng tên đường ("sổ/số") nên cả địa chỉ rơi. "đường số N" là tên đường trọn vẹn.
    if (/^(?:đường|duong)$/iu.test(dau) && /^(?:số|so)$/iu.test(tu[i] ?? "") && /^\d{1,3}[a-z]?$/i.test(tu[i + 1] ?? "")) {
      return [dau, tu[i], tu[i + 1]].join(" ");
    }
    const truoc: string[] = [];
    while (i < tu.length && (TU_TA_DUONG.has(boDau(tu[i])) || /^(?:đường|phố)$/iu.test(tu[i]) ||
      /^\d{1,5}[a-z]?(?:\/\d{1,5}[a-z]?)*(?:m|met|mét)?$/i.test(tu[i]))) {
      truoc.push(tu[i]);
      i++;
    }
    // Rồi tới TÊN đường: chữ thuần, tối đa 4 chữ, gặp chữ của thứ khác thì dừng.
    const ten: string[] = [];
    while (i < tu.length && ten.length < 4 && /^[\p{L}]{2,}$/u.test(tu[i]) && !laTuDungTen(tu[i], tu[i + 1] ?? "") &&
      !DUNG_HAI_CHU.test(boDau(`${tu[i]} ${tu[i + 1] ?? ""}`).trim()) &&
      !(ten.length && QUAN_SAU_TEN.test(boDau(`${tu[i]} ${tu[i + 1] ?? ""}`).trim()))) {
      ten.push(tu[i]);
      i++;
    }
    // 15/09/2026 (bắn thật C3): "Cách Mạng Tháng 8", "3 Tháng 2" — tên đường KẾT
    // THÚC bằng con số sau chữ "tháng"; bản trước cắt mất số ("Cách Mạng Tháng").
    if (ten.length && boDau(ten[ten.length - 1]) === "thang" && i < tu.length && /^\d{1,2}$/.test(tu[i])) {
      ten.push(tu[i]);
      i++;
    }
    return ten.length ? [dau, ...truoc, ...ten].join(" ") : null;
  }
  // 16/09/2026 (bắn thật): "Căn số 14 ở Ny'ah Phú Định, 80m2, giá 7 tỷ" — số căn + ở/tại/trong
  // + tên khu/dự án là địa chỉ của căn (tin mới mở từng trống `location_raw`).
  const can = /(?:^|[\s,])((?:căn|can|lô|lo|nền|nen|shop)\s*(?:số|so)?\s*\d{1,4}[a-zA-Z]?(?:[.\-\/]\d{1,4})?\s+(?:ở|o|tại|tai|trong|thuộc|thuoc)\s+[^,.;!?\n]{3,60})/iu
    .exec(t)?.[1]?.trim() ?? null;
  if (can && !/\d\s*(?:m2|m²|tỷ|ty|triệu|trieu)\b/iu.test(can)) return can;
  // Số nhà trần: "7 Hồng Bàng phường 12", "123/4 An Dương Vương q5" — chỉ nhận
  // khi ngay sau là phường/quận, để "5 tỷ" hay "40m2" không thành địa chỉ.
  // 22/09/2026 (bắn thật căn hộ): "126 Hung Vuong p12" — lookahead cũ `p\d\b` chỉ nhận phường MỘT chữ số
  // ("p4"), "p12" trượt ở ranh từ sau chữ số đầu → địa chỉ trần trước phường 10–19 không bao giờ được nhận.
  const so = /(?:^|[\s,])(\d{1,5}[a-zA-Z]?(?:\/\d{1,5}[a-zA-Z]?)*\s+(?:[\p{L}]+\s?){1,4}?)(?=\s*(?:p\.?\s*\d{1,2}|phường|phuong|quận|quan|q\.?\s*\d{1,2})\b)/iu
    .exec(t)?.[1]?.trim() ?? null;
  // 23/09/2026 (bắn thật): "căn 2 căn hộ Hà Đô quận 10" → "2 căn hộ Hà Đô" — số thứ tự căn + chữ LOẠI nhà không phải số nhà.
  if (so && /^\d{1,5}[a-zA-Z]?\s+(?:căn|can|nhà|nha|lô|lo|nền|nen|phòng|phong|tầng|tang|lầu|lau|miếng|mieng)(?![\p{L}])/iu.test(so)) return null;
  return so && so.length >= 6 ? so : null;
}

export function catDapAn(question: string, dapAn: string): string {
  // 15/09/2026: bỏ phần hỏi ngược trước khi cắt; đáp án chữ chỉ giữ MẢNH nói về đúng
  // câu đang hỏi — "Nhà 5 tầng, có thang máy thì phải, bạn có biết…" → kết cấu "Nhà 5
  // tầng"; "Được giá, căn tôi sở hữu nhưng chưa vào xem…" → gấp "Được giá".
  const tach = tachCauHoiNguoc(dapAn);
  const goc = tach.hoi && tach.traLoi ? tach.traLoi : dapAn;
  if (question === "vi_tri" && LENH_DAN.test(boDau(goc))) return bocCumDiaChi(goc) ?? goc;
  // 20/09/2026 (bắn thật mau-y-B): "phường 17 nhé, đường Phan Văn Trị" — lời sửa phường bị bóc, còn
  // "nhé, đường Phan Văn Trị" thành location_raw và street = "nhé". Tiểu từ đứng đầu mệnh đề bỏ đi.
  if (question === "vi_tri") {
    // 24/09/2026 (chủ dự án test Zalo): "137/28 nhé em, cần bán gấp giá 5 tỏi 9…" — cả câu thành địa chỉ, street = "nhé
    // em". Mảnh ĐẦU là số nhà / hẻm và phần sau không nói gì về địa chỉ → chỉ giữ mảnh đầu, bỏ tiểu từ cuối.
    const manh = goc.split(/[,;\n]/);
    const dau0 = (manh[0] ?? "").replace(TIEU_TU_DAU, "").trim();
    const sau0 = boDau(manh.slice(1).join(" "));
    if (manh.length > 1 && /^\d{1,5}[a-z]?(?:\/\d{1,5}[a-z]?)*(?:\s|$)/i.test(dau0) &&
        !/\b(?:duong|hem|hxh|pho|phuong|quan|p\s*\d|q\s*\d|ngo|kdc|khu)\b/.test(sau0)) {
      const gon = dau0.replace(/(?:\s+(?:nhé|nha|nhe|nghen|em|anh|chị|ạ|ơi|đó|nè|á|luôn|thôi))+\s*$/iu, "").trim();
      if (gon) return gon;
    }
    const sach = goc.replace(TIEU_TU_DAU, "").trim();
    if (sach && sach !== goc) return sach;
  }
  if (question === "phuong") {
    const m = /(?:phường|phuong|(?<![\p{L}])p)\s*\.?\s*(\d{1,2})(?!\d)/iu.exec(goc);
    if (m) return `Phường ${Number(m[1])}`;
  }
  // 15/09/2026 (bắn thật A2/A3): "giá thì mình muốn tầm 4 tỷ 2" ghi nguyên mệnh đề vào
  // ô giá, "70m2 2pn" vào ô tim tường. Cột đúng (parse_vnd, trigger) nhưng fact là rác:
  // giá lấy từ chữ "tầm/khoảng" hoặc con số tới hết mảnh; m² lấy đúng cụm số+m2.
  if (question === "gia" || question === "phi_quan_ly" || question === "tien_coc") {
    const kdD = boDauGiuDoDai(goc);
    const m = new RegExp(`(?:\\b(?:tam|khoang|co|tren|duoi|tu)\\s+)?[\\d][\\d.,]*\\s*(?:${TIEN_KD})(?![a-z])|(?:\\b(?:tam|khoang)\\s+)?${TIEN_T_KEP}`).exec(kdD);
    if (m && m.index > 0) {
      const manh = goc.slice(m.index).split(/[,;\n]/)[0].trim()
        .replace(/(?:\s+(?:thôi|nha|nhé|nhe|nhen|ạ|á|em|anh|chị|luôn|rồi|nè|đó|đấy|ơi))+\s*$/iu, "");
      if (manh && manh.length < goc.length) return manh;
    }
  }
  if (question === "dien_tich_tim_tuong" || question === "dien_tich" || question === "dien_tich_dat" || question === "tho_cu") {
    const kdD = boDauGiuDoDai(goc);
    const m = /\d+(?:[.,]\d+)?\s*(?:m2|m²|met vuong)(?![a-z0-9])/.exec(kdD);
    if (m && m[0].trim().length < goc.trim().length && !/\d\s*x\s*\d/.test(kdD)) return goc.slice(m.index, m.index + m[0].length).trim();
  }
  if (question === "gap") {
    const kdD = boDauGiuDoDai(goc);
    const m = GAP_CAT_RE.exec(kdD);
    if (m) return goc.slice(m.index, m.index + m[0].length).trim();
  }
  // 16/09/2026 (Zalo thật, ảnh chủ dự án): "ngang 5m còn dọc 16m cần bán gấp" trả lời câu
  // diện tích đất → ô đất ghi NGUYÊN câu. Có ngang + dài thì đáp án là "ngang 5m dài 16m"
  // (SQL `boc_thong_so` đọc được hai chiều rồi nhân).
  if (/^dien_tich/.test(question) || question === "tho_cu") {
    const nd = ngangDai(boDau(goc));
    if (nd) return nd;
  }
  const manh = goc.split(/[,;\n]|\.\s+(?=\S)/).map((x) => x.trim()).filter(Boolean);
  if (manh.length > 1 && question !== "vi_tri" && question !== "bo_sung") {
    const nd = nhanDienNhieuFact(goc).find((f) => cungHo(f.question, question));
    const khop = (nd?.answer && nd.answer.length < goc.length ? nd.answer : null) ??
      manh.find((x) => { const f = nhanDienFact(x); return !!f && cungHo(f.question, question); }) ?? null;
    if (khop) {
      // Mảnh mang SĐT ("sổ hồng riêng, gọi tôi 0703 123 456") giữ lại — nhánh người bán
      // không lọc số, CTV cần nó để gọi (V48-105d).
      const SDT_RE = /(?:\+?84|0)(?:[\s.]?\d){8,10}\b/;
      const giu = manh.filter((x) => x !== khop && !khop.includes(x) && SDT_RE.test(x));
      return [khop, ...giu].join(", ");
    }
  }
  return goc;
}

// Tiểu từ / ừ hử đứng ĐẦU mệnh đề, thường sót lại sau khi bóc lời sửa ("nhé, đường Phan Văn Trị").
export const TIEU_TU_DAU = /^(?:\s*(?:nhé|nhe|nha|nhen|hen|ạ|à|a|ừ|u|ờ|dạ|da|vâng|vang|rồi|roi|thì|thi|mà|ma|ok|oke|okie|em|anh|chị|chi)(?![\p{L}])[\s,.;:–-]*)+/iu;

// Mảnh "gấp" cắt khỏi câu dài — dùng ở cả `catDapAn` lẫn `nhanDienFact` (16/09/2026:
// "ngang 5m còn dọc 16m cần bán gấp" từng ghi nguyên câu vào ô gấp).
const GAP_CAT_RE = /\b(?:(?:khong|ko|k|chua)\s+(?:can\s+)?(?:gap|voi)|can\s+(?:ban\s+)?gap|ban\s+gap|(?:duoc|dc)\s+gia(?:\s+thi\s+thoi)?|tu tu|thong tha|can tien|ban nhanh|ban som|gap|khong voi|ko voi)\b/;
// "ngang 5m còn dọc 16m", "ngang 5 dài 20", "5x16" → "ngang 5m dài 16m"; không có thì null.
const NGANG_DAI_RE = /\b(?:ngang|mat tien|mt|rong)\s*(?:la\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|met)?\b(?:\s*,?\s*(?:con\s+|va\s+)?(?:x|dai|sau|doc)\s*(?:la\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|met)?\b)/;
export function ngangDai(kd: string): string | null {
  // "5x16" giữ nguyên dạng (DB đọc được, câu "4x14 nở hậu 5m" còn giữ nở hậu) — chỉ đổi dạng chữ.
  const m = NGANG_DAI_RE.exec(kd);
  return m ? `ngang ${m[1]}m dài ${m[2]}m` : null;
}

/**
 * 24/09/2026 (chủ dự án test Zalo: trích tin cũ + "đã trả lời rồi này"): chủ nhà nói MÌNH ĐÃ TRẢ LỜI — không phải dữ liệu.
 * Chỉ câu ngắn (≤ 8 chữ) mà ý chính là "đã trả lời / nói / nhắn / gửi rồi".
 */
export function laNoiDaTraLoi(text: string): boolean {
  const kd = boDau(text ?? "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!kd || kd.split(" ").length > 8) return false;
  return /\b(?:tra loi|noi|nhan|gui|ghi|bao)\s+(?:roi|o tren|luc nay|hoi nay|nay gio)\b/.test(kd);
}

/**
 * 24/09/2026 (chủ dự án test Zalo: "137/28 nghĩa là đường số 59 hẻm 137 và nhà số 28"): mảnh ĐẦU của câu chỉ là số nhà
 * có gạch chéo ("137/28 nhé em, cần bán gấp…") → trả { soNha, conLai }. Không có gạch chéo thì null ("5 tỷ", "4m"
 * không phải số nhà).
 */
export function soNhaDau(text: string): { soNha: string; conLai: string } | null {
  const manh = (text ?? "").split(/[,;\n]/);
  const dau = (manh[0] ?? "").replace(TIEU_TU_DAU, "")
    .replace(/(?:\s+(?:nhé|nha|nhe|nghen|em|anh|chị|ạ|ơi|đó|nè|á|luôn|thôi))+\s*$/iu, "").trim();
  const m = /^(?:(?:số nhà|so nha|số|so|nhà|nha)\s+)?(\d{1,5}[a-z]?(?:\/\d{1,5}[a-z]?)+)$/iu.exec(dau);
  return m ? { soNha: m[1], conLai: manh.slice(1).join(",").trim() } : null;
}

/**
 * 24/09/2026 (chủ dự án test Zalo): đang hỏi DIỆN TÍCH, chủ đã nói "ngang 5m" ở lượt trước, lượt này nói "dài 16m"
 * → "ngang 5m dài 16m" (DB nhân ra 80 m²). Câu nói MỘT chiều mà chiều kia đã có trong tin thì ghép; câu có đủ hai
 * chiều, có "x", có m², chỉ nói ngang, hoặc không nói chiều nào → null (đi đường cũ).
 */
export function ghepMotChieu(question: string, dapAn: string, ngangCo: number | string | null | undefined, daiCo: number | string | null | undefined): string | null {
  if (!/^dien_tich(?:_dat)?$/.test(question)) return null;
  const kd = boDau(dapAn ?? "");
  if (ngangDai(kd) || /\d\s*(?:m\s*)?x\s*\d|m2|m²|met vuong/.test(kd)) return null;
  const so = (re: RegExp) => { const m = re.exec(kd); return m ? m[1].replace(",", ".") : null; };
  const dai = so(/\b(?:dai|sau|doc|chieu dai)\s*(?:la\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|met)?(?![\d])/);
  const ngang = so(/\b(?:ngang|mat tien|mt|chieu ngang)\s*(?:la\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|met)?(?![\d])/);
  const n = (v: number | string | null | undefined) => { const x = v == null ? NaN : Number(v); return Number.isFinite(x) && x > 0 ? String(x) : null; };
  // Chỉ chiều "dài" nối vào "ngang" đã có (thứ tự người ta nói: ngang trước, dài sau). "Ngang 5" trần vẫn đi đường cũ
  // (ghi mặt tiền, câu diện tích treo) — `length_m` cũ trong tin có thể từ lượt khác, không tự nhân.
  void daiCo;
  if (dai && !ngang && n(ngangCo)) return `ngang ${n(ngangCo)}m dài ${dai}m`;
  return null;
}

// ── Tiểu từ / ack ────────────────────────────────────────────────────────────
// Lời chào không mang dữ liệu (bỏ dấu): "hello", "chào em", "alo em ơi", "hi bạn".
export const CHAO_SUONG_RE =
  /^\s*(?:(?:anh|chi|co|chu|bac|ong|ba|di|cau|mo|thim|duong)\s+)?(?:hello|helo|hi|hey|alo|a lo|chao|xin chao|chao buoi (?:sang|trua|chieu|toi))\s*(?:em|chau|con|ban|shop|ad|admin|bot|a|c|anh|chi|ai oi|ai)?\s*(?:oi|nhe|nha|a)?\s*[!.~]*\s*$/;

/**
 * 22/09/2026: "chào cháu" / "chào con" mà KHÔNG xưng chú/cô/bác — biết là người lớn tuổi, chưa biết chú hay cô.
 * Chỉ trên chữ còn dấu ("chao chau" bỏ dấu vẫn đủ rõ, nhưng giữ một luật với `tuXungTuCau`).
 */
export function laChaoChau(text: string): boolean {
  return /(?<![\p{L}])chào\s+(?:cháu|con)(?![\p{L}])/u.test((text ?? "").trim().toLowerCase());
}
const TIEU_TU =
  /\b(a|u|o|oi|da|vang|em|anh|chi|nha|nhe|nhen|ha|hen|ok|oke|okie|roi|thi|ma|voi|va|do|luon|de|coi|xem|chut|lat|nua|tam|di|ne|ne|ok|uh|uk|um|hmm|hm|yes|yep)\b/g;
const conChu = (kd: string) => kd.replace(TIEU_TU, "").replace(/[^a-z0-9]+/g, "");

const CO_SO = /\d/;
// Từ nói chuyện (còn dấu) — không có trong tên phường/xã nào ("Bàn Cờ" là "bàn",
// không phải "bận").
const TU_NOI_CHUYEN = /(?<![\p{L}])(?:hỏi|gì|sao|vậy|lắm|bận|biết|không|chưa|rồi|để|đang|ơi|thôi|tính|nghĩ|vợ|chồng|mệt|hả)(?![\p{L}])/iu;
const SO_CHU = /\b(mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi|ruoi)\b/;

// Câu hỏi cần MỘT CON SỐ mới là trả lời.
const HOI_SO = new Set([
  "dien_tich", "dien_tich_dat", "dien_tich_tim_tuong", "tho_cu", "ket_cau", "tang",
  "so_phong_ngu", "nam_xay", "mat_tien", "do_rong_hem", "do_rong_duong",
  "phi_quan_ly", "gia_dien_nuoc", "thoi_han_thue", "gia",
  // FR-186 (09/09/2026, cho thuê): cọc mấy tháng, trượt giá mấy % — đều là số.
  "tien_coc", "truot_gia",
  // 20260909i: câu hỏi bù sau đăng + loại mới.
  "so_wc", "cach_mat_tien", "no_hau", "phi_gui_xe", "mat_do_xd", "tang_cao_toi_da", "fit_out",
  "so_phong", "ty_le_lap_day", "doanh_thu", "chieu_cao", "tai_trong_san", "tram_bien_ap",
]);
// Trường có đơn vị tiền hợp lệ ("120 triệu/tháng" là doanh thu, không phải giá bán lạc chỗ).
const TIEN_OK = new Set(["gia", "doanh_thu", "phi_quan_ly", "phi_gui_xe", "gia_dien_nuoc", "tien_coc"]);
// Câu hỏi CÓ/KHÔNG: "có", "không", "rồi", "chưa" là câu trả lời đủ (không phải ack).
const HOI_CO_KHONG = new Set([
  "hem_thong", "ngap_nuoc", "the_chap", "thuong_luong", "can_goc", "thang_may", "pccc", "len_tho_cu", "gap",
  "ranh_gioi", "xu_ly_nuoc_thai", "duong_container", "nguon_nuoc", "hien_trang_su_dung", "so_huu", "tang_phu",
  "hoan_cong", "ban_giao", "dong_y_ban", // FR-223
]);

// Từ khoá tối thiểu cho các câu hỏi CHỮ. Không có từ nào trong đây thì coi là
// lệch: "16m nha" không phải hướng, "kêu chị nha" không phải pháp lý.
const TU_KHOA: Record<string, RegExp> = {
  phap_ly: /\b(so|hong|do|hoan cong|giay|hop dong|hdmb|vi bang|phap ly|chung|rieng|chua co so|cho so|ra so|dang lam so|shr|shc)\b/,
  huong: /\b(dong|tay|nam|bac|huong|chua ro|khong ro|ko ro|khong biet|ko biet|chua biet)\b/,
  quy_hoach: /\b(khong|ko|k|chua|co|dinh|vuong|on|sach|quy hoach|lo gioi|treo|giai toa|an toan|khong dinh|ko dinh|chuan)\b/,
  loai_bds: /\b(nha|pho|cap 4|chung cu|can ho|dat|biet thu|phong tro|mat bang|kho|xuong)\b/,
  // Vị trí cụ thể (chủ dự án 09/09/2026: "hỏi vị trí cụ thể thì tốt hơn"):
  // tên đường / hẻm / số nhà / mốc gần — hoặc có số (số nhà, số hẻm).
  vi_tri: /\b(duong|hem|hxh|so|pho|ngo|kdc|khu|toa|chung cu|cu xa|lo|kp|ap|xa|phuong|quan|gan|doi dien|nga|cho|truong|benh vien|cong vien|du an|block|thap)\b/,
  // FR-186 (09/09/2026): bộ câu hỏi riêng cho đất / biệt thự (chat Gemini
  // 21/06: "vướng cột điện, hố ga", "xây tự do hay theo mẫu CĐT", "compound").
  ha_tang: /\b(cot dien|ho ga|tru dien|cong|duong dam|vuong|khong vuong|ko vuong|sach|khong co|ko co|khong|ko|trong|thoang)\b/,
  xay_dung: /\b(tu do|theo mau|mau|chu dau tu|cdt|quy hoach|xay|tang|lau|khong|ko|duoc)\b/,
  khu_compound: /\b(compound|biet lap|an ninh|bao ve|khu|cong|rieng|khong|ko|mo|tu do|ben ngoai|dan cu)\b/,
  // 14/09/2026: đang hỏi "gấp không", chủ nhà nhắn "à anh nói lại, là đất trống chưa xây"
  // → cả câu vào ô gấp. Câu trả lời gấp phải nói về NHỊP bán.
  // FR-220 (24/09/2026): "nhà có tầng lửng, sân thượng hay tầng hầm không".
  tang_phu: /\b(lung|gac|san thuong|ham|ap mai|khong|ko|k|co|chua|chi|deu|ca|het)\b/,
  gap: /\b(gap|voi|tu tu|thong tha|can tien|duoc gia|cho duoc|ban nhanh|ban som|som|lien|ngay|khong can|khong|ko|chua|co)\b(?!\s+xay)/,
};

// Câu hỏi ngược của chủ nhà: có dấu hỏi hoặc mở đầu bằng từ để hỏi.
// "phí quản lý 20 nghìn/m2" KHÔNG phải câu hỏi (10/09: từng bị coi là "hỏi phí") —
// chỉ "phí sao / phí bao nhiêu / phí bên em" mới là hỏi ngược.
const CAU_HOI_RE = /\?|^\s*(?:phi (?:ben em|sao|bao nhieu|the nao|nhu the nao|gi|nhu nao|la)|bao nhieu|sao|the nao|nhu the nao|bao gio|khi nao|em la|ben em|co phai|lam sao|toi co|toi phai|minh phai|co can)\b/;

/**
 * Phân loại câu chủ nhà vừa nhắn so với câu hỏi `question` đang treo.
 * `text` là phần còn lại SAU khi tầng trên đã bóc lời sửa (FR-164).
 */
// Hai khoá cùng "họ": câu trả lời nhận ra khoá này thì vẫn là câu trả lời cho
// khoá kia (không coi là lệch). "Ngang 5" cho câu diện tích có luật riêng ở dưới.
const HO_FACT: string[][] = [
  ["vi_tri", "phuong"],
  ["dien_tich", "dien_tich_dat", "dien_tich_tim_tuong", "tho_cu", "mat_tien"],
  ["do_rong_hem", "do_rong_duong", "duong_vao"],
  ["so_huu", "thoi_han_su_dung", "han_hop_dong_thue"],
  ["hien_trang", "hien_trang_su_dung", "ket_cau", "tang_phu", "han_hop_dong_thue"],
  ["noi_that", "fit_out"],
  // Tin cho thuê hỏi "thuê tối thiểu", khách đáp "hợp đồng 1 năm" (luật đọc ra hạn hợp đồng) → vẫn là câu trả lời.
  ["thoi_han_thue", "han_hop_dong_thue"],
  ["tiem_nang", "muc_dich", "nganh_hang_phu_hop"],
  ["phap_ly", "the_chap", "hoan_cong", "giay_to_hien_co", "du_kien_ra_so", "ban_giao", "dong_so_huu_voi", "dong_y_ban"],
];
const cungHo = (a: string, b: string) => a === b || HO_FACT.some((h) => h.includes(a) && h.includes(b));
export const cungHoFact = cungHo;

// 15/09/2026 (Zalo thật, Ny'ah Phú Định): chủ nhà vừa trả lời vừa hỏi ngược trong MỘT
// câu — "Nhà 5 tầng, có thang máy thì phải, bạn có biết xung quanh khu này có tiện ích
// gì không", "Được giá, căn tôi sở hữu nhưng chưa vào xem bạn có thông tin thêm về căn
// này không". Không dấu "?", không mở đầu bằng từ để hỏi, nên CAU_HOI_RE không thấy:
// cả câu vào ô kết cấu / ô gấp, còn câu hỏi của chủ nhà thì bot lờ đi và hỏi tiếp —
// chủ dự án: "nó ngu quá". Tách ở ranh MẢNH (dấu phẩy, hoặc trước "bạn có biết / bạn
// có thông tin / cho hỏi / mà bạn…"): mảnh HỎI = có "?" hoặc (có từ để hỏi VÀ kết bằng
// tiểu từ hỏi, ≥ 3 chữ). Mảnh còn lại là câu trả lời. Chỉ dùng khi CÓ CẢ HAI phần —
// câu thuần hỏi ("phí sao em?") và "5 tỷ được không?" vẫn đi luật cũ.
// 23/09/2026 (bắn thật): "bên em lấy phí bao nhiêu vậy? anh có nhà Lê Hồng Phong muốn gửi bán" — câu hỏi đứng TRƯỚC, ngăn
// bằng "?" (không phẩy) nên cả tin là một mảnh và câu hỏi phí bị nuốt. Ranh sau "?" (giữ "?" trong mảnh hỏi).
const RANH_MANH_RE = /[,;\n]|\.\s+(?=\S)|(?<=\?)\s+(?=\S)|\s+(?=(?:mà|nhưng|với lại|còn|ma|nhung|voi lai|con)\s+(?:bạn|em|bên|anh|chị|mình|bot|ban|ben|chi|minh)\b)|\s+(?=(?:bạn|em|bên em|bên mình|ban|ben em|ben minh)\s+(?:có\s+(?:biết|thông tin|nắm|thể)|biết|tư vấn|cho hỏi|co\s+(?:biet|thong tin|nam|the)|biet|tu van|cho hoi)\b)/iu;
const DAU_HOI_RE = /\b(?:co (?:biet|thong tin|the|nam)|biet|thong tin|tu van|cho hoi|hoi|gi|nao|bao nhieu|sao|the nao|nhu the nao|duoc khong|dc khong|bao gio|khi nao|o dau|co phai|la (?:bot|may|nguoi)|hay (?:bot|may|nguoi))\b|\bco\b(?=.*\b(?:khong|ko|k|chua)\b)/;
// 17/09/2026 (Zalo thật): "…bot hay người vậy\tTr" — đuôi rác ≤ 3 ký tự sau tiểu từ hỏi (gõ lỡ) không làm mất câu hỏi.
const DUOI_HOI_RE = /\b(?:khong|ko|k|chua|gi|nao|nhi|nhe|a|vay|ha|the|sao|bao nhieu|dau)(?:\s+(?:em|anh|chi|ban|chau|a|nha|nhe|nhi|vay|ha|ne|ạ))*(?:\s+\S{1,3})?\s*\?*\s*$/;
export function tachCauHoiNguoc(text: string): { traLoi: string; hoi: string | null } {
  const goc = (text ?? "").trim();
  const manh = goc.split(RANH_MANH_RE).map((x) => x.trim()).filter(Boolean);
  if (manh.length < 2) return { traLoi: goc, hoi: null };
  const laHoi = (m: string): boolean => {
    if (/\?/.test(m)) return true;
    const kd = boDau(m).replace(/[?.!]+$/, "").trim();
    return kd.split(/\s+/).length >= 3 && DAU_HOI_RE.test(kd) && DUOI_HOI_RE.test(kd);
  };
  const hoi = manh.filter(laHoi), traLoi = manh.filter((m) => !laHoi(m));
  if (!hoi.length || !traLoi.length) return { traLoi: goc, hoi: null };
  return { traLoi: traLoi.join(", "), hoi: hoi.join(" ") };
}

/**
 * Cả tin là MỘT CÂU HỎI ("bên bạn có cần mình gửi hình không hay sao") và không
 * mang fact nào → không phải dữ liệu để ghi, là câu hỏi ngược cần trả lời.
 * 15/09/2026 (bắn thật A5): bản trước ghi nguyên câu hỏi vào ô "thông tin bổ sung".
 */
export function laCauHoiTron(text: string): boolean {
  const goc = (text ?? "").trim();
  if (!goc || nhanDienFact(goc)) return false;
  if (/\?/.test(goc)) return true;
  const kd = boDau(goc).replace(/[?.!]+$/, "").trim();
  // Không dấu hỏi thì cần thêm CHỦ NGỮ/TỪ HỎI rõ ("bên bạn có…", "bao nhiêu", "thế nào"):
  // "không dính gì" (trả lời quy hoạch) có "gì" ở cuối nhưng không phải câu hỏi.
  // 16/09/2026 (bắn thật mau-co-thue): "à mà cháu là bot hay người vậy" — bot xưng cháu nên khách
  // hỏi "cháu là…"; câu hỏi về bản chất bot (là bot / máy / người thật) luôn là câu hỏi.
  // 20/09/2026 (bắn thật mau-y-A, môi giới gõ không dấu): "phi ben minh sao, co bat ky doc quyen ko"
  // từng vào ô bổ sung — "bên mình / của em" + "sao", "có bắt/tính/lấy … không" cũng là chủ ngữ hỏi.
  const coTuHoi = /\b(?:ban|ben|em|anh|chi|minh|chau)\s+(?:co|biet|tinh|nhan|can|thay|la)\b|\b(?:ben|cua)\s+(?:minh|em|ban|anh|chi|cac ban)\b|\bco\s+(?:bat|tinh|lay|thu|doi|yeu cau)\b|\b(?:phi|hoa hong)\b[^.?!]*\b(?:sao|bao nhieu|the nao|nhieu)\b|\b(?:bao nhieu|the nao|nhu the nao|khi nao|bao gio|o dau|co phai|duoc khong|dc khong|hay sao|ha em|ha chau|khong em|khong chau|khong a|khong ban|la bot|la may|la nguoi|hay nguoi|hay may|hay bot)\b/;
  return kd.split(/\s+/).length >= 3 && DAU_HOI_RE.test(kd) && DUOI_HOI_RE.test(kd) && coTuHoi.test(kd);
}

export function phanLoaiCauTraLoi(question: string, text: string): KetQuaKhop {
  // 11/09/2026: bận / hoãn đứng TRƯỚC mọi luật khác — câu này không mang dữ liệu
  // nào (có số thì `laHoanLai` đã trả false), mà luật phường cũ nhận bất kỳ câu
  // ≥ 3 chữ. Duyệt tin và chấm điểm có đường riêng, không đụng.
  if (question !== "duyet_tin" && question !== "danh_gia" && laHoanLai(text)) {
    const xh = batXungHo(text) ?? tuXungTuCau(text);
    return { loai: "hoan", ...(xh ? { xungHo: xh } : {}) };
  }
  // 15/09/2026: vừa trả lời vừa hỏi ngược → phần trả lời đi tiếp các luật dưới, phần
  // hỏi trả về `hoiNguoc` để tầng trên trả lời TRƯỚC câu kế (không nuốt câu hỏi).
  if (question !== "duyet_tin" && question !== "danh_gia") {
    const { traLoi, hoi } = tachCauHoiNguoc(text);
    if (hoi && traLoi && traLoi !== text.trim()) {
      const kqTL = phanLoaiCauTraLoi(question, traLoi);
      return { ...kqTL, hoiNguoc: hoi, dapAn: traLoi };
    }
  }
  // 09/09/2026 tối (chạy 12 kịch bản trên production): câu trả lời bị ghi LỆCH
  // MỘT Ô hàng loạt — "Hẻm 4m" vào diện tích, "Đúc 5 tầng" vào số phòng ngủ,
  // "lên thổ cư 300m2" vào địa chỉ, "cọc 2 tháng" vào diện tích… vì các nhánh
  // số/từ khoá ở dưới chỉ hỏi "có số không / có từ khoá không", không hỏi "câu
  // này đang nói về THỨ GÌ". Nay hỏi `nhanDienFact` TRƯỚC: nhận ra rõ một fact
  // KHÁC họ với câu đang hỏi thì là lệch + chuyển sang, câu hỏi gốc treo lại.
  {
    const kd0 = boDau(text.trim());
    const chu0 = conChu(kd0.replace(XUNG_HO_RE, " "));
    if (question !== "duyet_tin" && question !== "danh_gia" && question !== "hinh_anh" &&
        question !== "loai_bds" && chu0.length >= 2 && !CAU_HOI_RE.test(kd0)) {
      const nd = nhanDienFact(text);
      // Câu có NHIỀU ý mà một ý chính là câu đang hỏi ("hẻm 4m, mà thôi anh cần bán
      // gấp" khi đang hỏi hẻm) → là câu trả lời KHỚP, các ý còn lại ghi kèm ở tầng trên.
      const nhieuY = nhanDienNhieuFact(text);
      const coCauDangHoi = nd && nd.question !== question && nhieuY.some((f) => cungHo(f.question, question));
      // FR-223 (bắn thật 24/09, rn-test-h): đang hỏi TIỀN THUÊ / cọc / phí mà khách trả lời một số tiền ("150 triệu một
      // tháng em") → luật đọc thành GIÁ BÁN và xếp lệch (AI tắt thì ghi đè giá bán thành 150 triệu). Hỏi tiền mà đáp tiền là khớp.
      const tienChoCauTien = nd?.question === "gia" && question !== "gia" && TIEN_OK.has(question);
      if (nd && !coCauDangHoi && !tienChoCauTien && nd.question !== "bo_sung" && !cungHo(nd.question, question) &&
          !(HOI_CO_KHONG.has(question) && /^\s*(co|khong|ko|k|chua|roi|da)\b/.test(kd0))) {
        const xh = batXungHo(text);
        return { loai: "lech", chuyenSang: nd, ...(xh ? { xungHo: xh } : {}) };
      }
      // 15/09/2026 (bắn thật A3): "3 phòng ngủ em. nhà đang cho thuê 25 triệu/tháng" khi đang
      // hỏi số phòng ngủ — có TIỀN trong câu nên luật "tiền ở câu không phải tiền" bên dưới
      // xếp LỆCH, cả câu vào "bổ sung" rồi hỏi lại phòng ngủ dù cột đã có 3. Câu nhiều ý mà
      // một ý là câu đang hỏi thì KHỚP; `catDapAn` lấy mảnh đó, ý còn lại ghi kèm ở tầng trên.
      if (question !== "phuong" && question !== "vi_tri" && nhieuY.length >= 2 && nhieuY.some((f) => cungHo(f.question, question))) {
        const xh = batXungHo(text);
        return { loai: "khop", ...(xh ? { xungHo: xh } : {}) };
      }
    }
  }
  const kq = phanLoaiTho(question, text);
  // FR-177 e: câu LỆCH mà nhận ra chủ nhà đang nói fact nào thì trỏ sang đó.
  if (kq.loai === "lech" && !kq.chuyenSang) {
    const nd = nhanDienFact(text);
    if (nd && nd.question !== question &&
        !(nd.question === "dien_tich" && /^dien_tich/.test(question))) {
      return { ...kq, chuyenSang: nd };
    }
  }
  return kq;
}

function phanLoaiTho(question: string, text: string): KetQuaKhop {
  const kd = boDau(text.trim());
  const xungHo = batXungHo(text);
  const chu = conChu(kd.replace(XUNG_HO_RE, " "));

  // Dặn xưng hô mà ngoài ra không còn nội dung → nhớ, hỏi lại.
  if (xungHo && chu.length < 3) return { loai: "xung_ho", xungHo };
  // Câu hỏi có/không (20260909i): "có", "không", "rồi", "chưa", "cụt", "thông"… là đáp án thật.
  // 15/09/2026 (bắn thật E4): "bên bạn có cần mình gửi hình không hay sao" khi đang hỏi
  // GẤP — chữ "không" làm cả câu hỏi thành đáp án. Câu hỏi trọn (`laCauHoiTron`) đi tiếp
  // xuống nhánh hỏi ngược bên dưới.
  if (HOI_CO_KHONG.has(question) && !laCauHoiTron(text) &&
      /^\s*(co|khong|ko|k|chua|roi|da|cut|thong|ngap|kho|cam tay|the chap|ngan hang|dang o|cho thue|trong|lau dai|50 nam|tl|thuong luong|cung duoc|de o)\b/.test(kd)) {
    return { loai: "khop", ...(xungHo ? { xungHo } : {}) };
  }
  if (chu.length < 2 && !CO_SO.test(kd)) return { loai: "ack" };
  // 16/09/2026 (Zalo thật 13:36): "Hello" khi đang chờ ảnh → ghi "thông tin bổ sung: Hello".
  // Lời chào suông là ack, không phải dữ liệu.
  if (CHAO_SUONG_RE.test(kd)) return { loai: "ack" };

  // Chủ nhà hỏi ngược. Có số kèm dấu hỏi ("5 tỷ được không?") vẫn là câu hỏi
  // — bot phải trả lời chứ không lặng lẽ ghi "5 tỷ được không?" làm đáp án.
  if (CAU_HOI_RE.test(kd) && !(HOI_SO.has(question) && /^\s*[\d.,]+\s*(m2|m|ty|ti|tr|trieu|tang|lau|tam|pn)?\s*\?\s*$/.test(kd))) {
    return { loai: "hoi", ...(xungHo ? { xungHo } : {}) };
  }
  // 15/09/2026 (bắn thật E4): câu hỏi trọn không có dấu "?" ("bên bạn có cần mình gửi
  // hình không hay sao") — CAU_HOI_RE bỏ lỡ, rồi từ khoá "không" khớp ô gấp.
  if (laCauHoiTron(text)) return { loai: "hoi", ...(xungHo ? { xungHo } : {}) };

  const ketQua = (loai: LoaiCau, them: Partial<KetQuaKhop> = {}): KetQuaKhop =>
    ({ loai, ...(xungHo ? { xungHo } : {}), ...them });

  // Chấm điểm chăm sóc (09/09/2026): câu chữ tự do — "8 điểm", "giống người
  // thật", "ổn em", "hơi lâu" đều là câu trả lời. Chỉ ack/hỏi ngược ở trên mới
  // không tính. Không bao giờ chuyển sang fact khác.
  if (question === "danh_gia") return ketQua("khop");

  if (/^dien_tich/.test(question) || question === "tho_cu") {
    // "Ngang 5" / "rộng 4m" là MẶT TIỀN, không phải diện tích. Ghi đúng chỗ
    // và vẫn treo câu diện tích. "5x16", "5 x 16m", "80m2", "80" → khớp.
    const ngang = /\b(?:ngang|rong|mat tien|mt)\s*(?:la\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|met)?\b/.exec(kd);
    const coDien = /\d+(?:[.,]\d+)?\s*(?:m2|m²|met vuong|mv)\b|\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?/.test(kd);
    // "ngang 5 dài 16" / "sâu 16 ngang 5": có cả hai chiều là đủ diện tích.
    if (/\b(ngang|rong|mat tien|mt)\b[^a-z]*\d[^a-z]*\b(dai|sau)\b\s*(?:la\s*)?\d/.test(kd) ||
        /\b(dai|sau)\b[^a-z]*\d[^a-z]*\b(ngang|rong)\b\s*(?:la\s*)?\d/.test(kd)) {
      return ketQua("khop");
    }
    if (ngang && !coDien && !/\b(dai|sau)\b/.test(kd)) {
      return ketQua("lech", { chuyenSang: { question: "mat_tien", answer: `${ngang[1]}m` } });
    }
    // 15/09/2026 (Zalo thật): "Căn số 14 ở Ny'ah Phú Định" trả lời câu diện tích →
    // "14" thành 14m² trong cột. Số đứng sau căn số / số nhà / lô / hẻm là ĐỊNH DANH,
    // không phải diện tích: coi là vị trí, câu diện tích vẫn treo.
    if (!coDien && /\b(?:can so|so nha|so|lo|hem|can)\s*\d/.test(kd)) {
      return ketQua("lech", { chuyenSang: { question: "vi_tri", answer: bocViTriRao(text) ?? text.trim() } });
    }
    if (coDien || (CO_SO.test(kd) && !/\b(ngang|rong|dai|sau|tang|lau|tam|phong|pn|ty|ti|trieu|tr)\b/.test(kd))) {
      return ketQua("khop");
    }
    return ketQua("lech");
  }

  // Ảnh (FR-177 a): ảnh thật đi đường ghiAnhKem, chữ chỉ "khớp" khi chủ nói
  // KHÔNG có ảnh; "chiều gửi" là lời hứa (PROMISE_RE tầng trên đặt nhắc).
  if (question === "hinh_anh") {
    return ketQua(/\b(khong co|ko co|k co|chua co|chua chup|khong chup|ko chup)\b/.test(kd) ? "khop" : "lech");
  }

  if (HOI_SO.has(question)) {
    // 16/09/2026 (bắn thật mau-chu-q8): "phường 16 quận 8" khi đang hỏi GIÁ — lời sửa FR-164 bóc
    // "phường 16" đi, còn "quận 8" rơi vào ô giá. Số của quận/phường không phải đáp án số;
    // câu chỉ còn quận/phường thì là ack (quận đã có `capNhatQuan` lo), câu hỏi vẫn treo.
    const kdKhongDiaGioi = kd.replace(/\b(?:quan|q|phuong|p)\s*\.?\s*\d{1,2}\b/g, " ");
    if (kdKhongDiaGioi !== kd && !CO_SO.test(kdKhongDiaGioi) && conChu(kdKhongDiaGioi.replace(/\b(?:quan|phuong)\b/g, "")).length < 2) {
      return { loai: "ack" };
    }
    // 16/09/2026 (Zalo thật): "Căn số 14 ở Ny'ah Phú Định" khi đang hỏi GIÁ / kết cấu —
    // số sau "căn số / số nhà / lô" là định danh, không phải đáp án số. Cùng luật với
    // nhánh diện tích ở trên: coi là vị trí, câu đang hỏi vẫn treo.
    if (/\b(?:can so|so nha|lo so|can|lo)\s*\d+[a-z]?\b/.test(kd) && (kd.match(/\d+/g) ?? []).length === 1 &&
        !/\d+[a-z]?\s*(?:m2|m²|m\b|met|ty|ti|toi|trieu|tr\b|tang|lau|tam|pn|phong|wc|nam|thang|%)/.test(kd)) {
      return ketQua("lech", { chuyenSang: { question: "vi_tri", answer: bocViTriRao(text) ?? text.trim() } });
    }
    if (CO_SO.test(kd) || SO_CHU.test(kd)) {
      // Số đi kèm đơn vị của trường KHÁC thì lệch: hỏi năm xây mà nhận "5 tỷ".
      // Trường TIỀN (giá, doanh thu, phí, cọc, điện nước) thì đơn vị tiền là đúng.
      if (!TIEN_OK.has(question) && CO_TIEN_KD.test(kd)) return ketQua("lech");
      // "80m2": không có ranh giới từ giữa "80" và "m2", nên đừng dùng \b trước m2.
      if (question === "gia" && /(m2|m²|met vuong|\btang\b|\blau\b|\btam\b|\bngang\b|\brong\b|\bdai\b|\bsau\b|\bhem\b|\bmat tien\b)/.test(kd) && !/\b(ty|ti|toi|trieu|tr|k)\b/.test(kd)) return ketQua("lech");
      return ketQua("khop");
    }
    // "chưa rõ / không nhớ" là câu trả lời hợp lệ cho năm xây, phí quản lý…
    if (/\b(khong nho|ko nho|chua ro|khong ro|ko ro|khong biet|ko biet|chua biet|khong co|ko co|mien phi)\b/.test(kd)) return ketQua("khop");
    return ketQua("lech");
  }

  // Phường: "5", "phường 5", "p5", "Nguyễn Cư Trinh", "xã Phong Phú" đều nhận; "ừ" thì không.
  // 11/09/2026 (42 ca): "chu.length >= 3" một mình nhận CẢ câu than phiền làm tên
  // phường. Tên phường bằng chữ ngắn (≤ 4 tiếng) và không có từ nói chuyện.
  if (question === "phuong") {
    const soTieng = kd.split(/\s+/).filter(Boolean).length;
    const tenChu = chu.length >= 3 && soTieng <= 4 && !TU_NOI_CHUYEN.test(text);
    // Chữ "phường/xã" phải đi với một cái TÊN: "không biết phường nào" không phải tên phường.
    const coNhan = /\bp\s*\d|\b(?:phuong|xa|thi tran)\s+(?!nao\b|may\b|gi\b|do\b|nay\b)[a-z]/.test(kd);
    // 17/09/2026 (Zalo thật): "ngang 5m còn dọc 18m" → cột PHƯỜNG. Số chỉ là phường khi là
    // số phường TRẦN (1–2 chữ số, có thể kèm "phường/p", "quận N"), không kèm đơn vị đo.
    const coPhuongSo = /\b(?:phuong|p)\s*\.?\s*\d{1,2}\b/.test(kd);
    const soTran = /^\s*\d{1,2}\s*(?:,?\s*(?:quan|q\.?)\s*\d{1,2})?\s*(?:nha|nhe|a|em|chau)?\s*$/.test(kd);
    const coDonVi = /\d\s*(?:m2|m²|m\b|met|ty|ti|trieu|tr\b|x\s*\d|lau|tang|tam|pn)/.test(kd);
    return ketQua(coPhuongSo || soTran || ((coNhan || tenChu) && !coDonVi) ? "khop" : "lech");
  }
  // Vị trí: cần dấu hiệu địa chỉ thật (đường / hẻm / số nhà / mốc), KHÔNG chỉ vì
  // có con số — "lên thổ cư 300m2", "thời hạn đến 2060" từng đi vào địa chỉ.
  if (question === "vi_tri") {
    const coDiaChi = /\b(duong|hem|hxh|so nha|dia chi|ngo|kdc|khu|toa|block|thap|chung cu|cu xa|du an|kp|ap|xa|phuong|quan|gan|doi dien|nga|cho|truong|benh vien|cong vien|lo|mat tien|mt|pho)\b/.test(kd) ||
      /\b(?:can|lo|nen|shop)\s*(?:so\s*)?\d+[a-z]?(?:[.\-\/]\d+)?\s+(?:o|tai|trong|thuoc|cua)\s+[a-z]{2,}/.test(kd) ||
      /^\s*\d+[a-z]?(?:\/\d+[a-z]?)*\s+[a-z]{2,}/.test(kd);
    // "đường bê tông 5m xe tải vào được", "đường 12m" là ĐƯỜNG VÀO, không phải địa chỉ.
    const laMoTaDuong = /\b(be tong|nhua|dat do|duong dat|xe tai|container|\d+\s*(?:m|met)\b)/.test(kd) && !/\b(so nha|hem \d|so \d|\/)/.test(kd);
    return ketQua(coDiaChi && !laMoTaDuong && !/\b(m2|m²|met vuong|tho cu|thoi han|nam \d{4}|ty|trieu)\b/.test(kd) ? "khop" : "lech");
  }

  const tk = TU_KHOA[question];
  if (tk) return ketQua(tk.test(kd) ? "khop" : "lech");

  // Câu hỏi chữ tự do (hiện trạng, nội thất, ngành hàng, sân vườn, giờ giấc…):
  // có nội dung là nhận.
  return ketQua(chu.length >= 3 ? "khop" : "lech");
}

/**
 * FR-188 b: câu MỀM — hỏi trong chat ĐÚNG MỘT lần. Chủ nhà trả lời thứ khác thì
 * thôi, không hỏi lại lần hai (chủ dự án 10/09). Vòng hỏi bù (ask-seller) vẫn có
 * thể nhắc lại hôm sau, đó là một lượt/ngày gom 2–3 câu nên không làm khách mệt.
 * Câu CỨNG (giá, địa chỉ, diện tích, pháp lý…) giữ luật né-2-lần.
 */
export const HOI_MOT_LAN = new Set(["gap", "ly_do_ban", "thuong_luong", "tiem_nang", "muc_dich"]);

/** Nhãn tiếng Việt ngắn để hỏi lại, KHÔNG lặp nguyên văn câu hỏi trước. */
export const NHAN_HOI_LAI: Record<string, string> = {
  phap_ly: "giấy tờ nhà mình là sổ hồng riêng hay sổ chung",
  hoan_cong: "sổ nhà mình đã hoàn công chưa",
  huong: "nhà mình quay hướng nào",
  dien_tich_dat: "tổng diện tích đất bao nhiêu m2, hoặc ngang bao nhiêu dài bao nhiêu",
  dien_tich: "diện tích bao nhiêu m2",
  ket_cau: "nhà mấy tầng, mấy phòng ngủ",
  quy_hoach: "nhà có dính quy hoạch hay lộ giới gì không",
  nam_xay: "nhà xây năm nào",
  gia: "giá mình muốn bán bao nhiêu",
  phuong: "nhà mình thuộc phường mấy",
  vi_tri: "nhà mình ở đường nào, số mấy hay hẻm nào",
  danh_gia: "mình chấm cách em chăm sóc mấy điểm, có góp ý gì cho em",
  do_rong_hem: "hẻm trước nhà rộng mấy mét, xe hơi vào được không",
  hinh_anh: "mình gửi giúp em vài tấm ảnh sổ, mặt tiền nhà và hẻm",
  duyet_tin: "bản nháp tin như vậy đã được chưa, hay mình muốn sửa chỗ nào",
  // FR-186
  tang: "căn hộ mình ở tầng mấy",
  noi_that: "bàn giao nhà trống hay để lại nội thất gì",
  ha_tang: "lô đất có vướng cột điện, hố ga hay đường đâm gì không",
  xay_dung: "đất được xây tự do hay phải xây theo mẫu chủ đầu tư",
  khu_compound: "nhà nằm trong khu biệt lập có bảo vệ hay khu dân cư mở",
  tien_coc: "mình lấy cọc mấy tháng",
  truot_gia: "giá thuê tăng mấy phần trăm mỗi năm",
  thoi_han_thue: "mình muốn cho thuê tối thiểu bao lâu",
  tiem_nang: "nhà mình hợp để ở hay kinh doanh ngành gì",
  ngung_rao_can_nao: "mình muốn ngưng rao căn nào, nhắn số thứ tự hoặc địa chỉ giúp em",
};

// ── FR-177 e: chủ nhà đang nói FACT NÀO? ─────────────────────────────────────
// Chỉ nhận khi câu có NHÃN hoặc ĐƠN VỊ rõ ("ngang 5", "80m2", "5 tỷ", "hẻm 4m",
// "3 lầu", "2 phòng ngủ", "sổ hồng", "hướng đông", "phường 5", "xây 2010").
// Một con số trần ("16m nha") thì KHÔNG đoán — về `bo_sung`, người đọc sau.
// Đáp án là chuỗi ĐÃ BỎ DẤU cho các trường số (parse_vnd/boc_thong_so phía DB
// đọc được "ty"/"trieu"), còn trường chữ (pháp lý, hướng, quy hoạch, nội thất)
// giữ nguyên văn để tầng DB bóc theo từ khoá có dấu.
export type NhanDien = { question: string; answer: string };
const SO = "(\\d+(?:[.,]\\d+)?)";
// Bỏ dấu mà GIỮ ĐỘ DÀI từng ký tự — chỉ số khớp trên bản này cắt được đúng đoạn
// trong câu gốc ("18 tỷ" thay vì "18 ty" — bản 09/09 tối ghi giá thành "18 ty").
const boDauGiuDoDai = (s: string): string =>
  Array.from(s, (c) => {
    if (c === "đ" || c === "Đ") return "d";
    const b = c.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return (b.length === 1 ? b : c).toLowerCase();
  }).join("");
// Một câu chủ nhà nói có thể mang NHIỀU fact ("Đường 12m, hướng Bắc"; "3 tầng,
// 4 phòng ngủ"): tách theo dấu phẩy / chấm phẩy / "và", nhận từng mảnh, bỏ trùng.
// Fact PHỤ hay đi kèm trong cùng một câu mà không có dấu phẩy ("2 lầu 3 phòng",
// "3 tầng 4 phòng ngủ 2 wc", "ngang 5 dài 20"): bắt thêm trên cả câu.
// Diện tích SÀN / sử dụng / xây dựng (16/09/2026): "dtsd 120m2", "diện tích sàn 240m2";
// "tổng diện tích 240m2" / "diện tích tổng 240m2" chỉ là sàn khi câu có tầng/tấm/lầu
// (lookbehind dài — V8/Deno hỗ trợ) và không phải "tổng diện tích đất".
const DIEN_TICH_SAN_RE = new RegExp(
  `(?:(?:${TRUOC_LA_SAN.source})|(?<=\\b(?:tam|tang|lau|tret)\\b.*)\\b(?:tong\\s+(?:dien tich|dt)|(?:dien tich|dt)\\s+tong)(?!\\s+dat\\b))\\s*(?:la\\s*|khoang\\s*|tam\\s*)?(\\d{1,5}(?:[.,]\\d+)?)\\s*(?:m2|m²|met vuong|mv)\\b`,
);
// 22/09/2026 (bộ đo giọng B11): "5 tỷ 60m2" / "12 tỷ 80m2" — số đứng sau đơn vị tiền chỉ là
// phần LẺ của giá ("5 tỷ 6") khi nó KHÔNG mang đơn vị của thứ khác (m2, x, pn, lầu, tầng…) và
// không phải một số dài hơn (không cắt "60" ra "6"). Dùng chung cho ba chỗ đọc giá dưới đây.
const KHONG_PHAI_LE_GIA = "(?![\\d.,]*\\d)(?!\\s*(?:m2|m\\b|x\\s*\\d|pn\\b|phong|lau|tang|tam|wc|met|nam\\b|thang))";
const FACT_PHU: Array<[string, RegExp, (m: RegExpExecArray) => string]> = [
  // "cần bán gấp 5 tỷ" → câu chính là gấp, giá vẫn phải ghi.
  ["gia", new RegExp(`\\b(\\d+(?:[.,]\\d+)?)\\s*(${TIEN_KD})(?![a-z])(?:\\s*(\\d{1,3}(?:[.,]\\d+)?)${KHONG_PHAI_LE_GIA})?(?:\\s*(ruoi))?`), (m) => `${m[1]} ${m[2] === "toi" ? "tỏi" : m[2] === "ty" || m[2] === "ti" ? "tỷ" : "triệu"}${m[3] ? ` ${m[3]}` : ""}${m[4] ? " rưỡi" : ""}`],
  // 24/09/2026 (bắn 10 tin): "toà nhà CHDV 20 phòng" — phòng cho thuê, không phải phòng ngủ.
  ["so_phong_ngu", /(?<!\b(?:chdv|dich vu|toa nha|nha tro|day tro|phong tro)\b[^,.;]{0,12})\b(\d{1,2})\s*(?:phong ngu|pn|phong)\b(?!\s*(?:tro|cho thue|khach|tam|dich vu|bep|wc))/, (m) => m[1]],
  ["so_phong", /\b(?:chdv|can ho dich vu|toa nha|nha tro|day tro)\b[^,.;]{0,12}?\b(\d{1,3})\s*phong\b(?!\s*(?:ngu|wc|tam|ve sinh))/, (m) => m[1]],
  ["so_wc", /\b(\d{1,2})\s*(?:wc|toilet|ve sinh)\b/, (m) => m[1]],
  ["huong", /\bhuong\s*((?:dong|tay|nam|bac)(?:\s*(?:dong|tay|nam|bac))?)\b/, (m) => `hướng ${m[1]}`],
  // 13/09/2026: "ngang 5 dài 20" giữ CẢ hai chiều — đáp án "5m" làm mất chiều dài
  // (SQL `boc_thong_so` đọc được "ngang 5m dài 20m" ra frontage + length).
  // 16/09/2026: "ngang 5m CÒN DỌC 16m" — "dọc" là dài, chữ "còn" chen giữa.
  ["mat_tien", /(?<!cach\s)(?<!cach\s\s)\b(?:ngang|mat tien|mt)\s*(?:la\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|met)?\b(?:\s*,?\s*(?:con\s+|va\s+)?(?:x|dai|sau|doc)\s*(?:la\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|met)?\b)?/,
    (m) => m[2] ? `ngang ${m[1]}m dài ${m[2]}m` : `${m[1]}m`],
  // 22/09/2026 (kịch bản D): "nở hậu 4m5" — số dính "m" rồi phần lẻ, như "hẻm 3m5".
  ["no_hau", /\bno hau\s*(?:la\s*|hon\s*|khoang\s*)?(\d+(?:[.,]\d+)?)\s*(?:m(\d)|m|met)?(?![a-z0-9])/, (m) => `${m[1].replace(",", ".")}${m[2] ? `.${m[2]}` : ""}m`],
  // Câu rao dài (FR-177 n): các ý đời thường đi kèm không có dấu phẩy.
  ["cach_mat_tien", /\bcach\s*(?:mat tien|duong lon|duong chinh|mt)\s*(?:khoang|tam)?\s*(\d+(?:[.,]\d+)?)\s*(?:m|met)?\b/, (m) => `${m[1]}m`],
  ["hem_thong", /\bhem\s*(thong|cut)\b/, (m) => `hẻm ${m[1] === "cut" ? "cụt" : "thông"}`],
  ["ngap_nuoc", /\b((?:khong|ko|k)\s*(?:bi\s*)?ngap|ngap nuoc|hay ngap|bi ngap)\b/, (m) => /khong|ko|k\s/.test(m[1]) ? "không ngập" : "có ngập"],
  ["ly_do_ban", /\b(dinh cu|ke tien|can tien|doi nha|chuyen cho|di nuoc ngoai|chia tai san|tra no|ve que|doi cong tac|mua cho khac)\b/, (m) => m[1]],
  // 13/09/2026: "tầng 15 view sông" — mảnh đó ra `tang`, view rơi mất. Cắt từ chữ gốc.
  ["view", /\bview\s+[a-z0-9]+(?:\s+(?:song|ho|bien|thanh pho|cong vien|kenh|landmark|q1|quan 1|\d+))?/, (m) => m[0]],
  ["nam_xay", /\b(?:xay|hoan cong|xd)\s*(?:tu\s*|moi\s*|hoi\s*)?(?:nam\s*)?((?:19|20)\d{2})\b/, (m) => m[1]],
  ["thuong_luong", /\b(con thuong luong|co thuong luong|thuong luong duoc|\btl\b|fix|gia cung|khong bot)\b/, (m) => m[1]],
  // 16/09/2026 (Zalo thật): "nhà trong hẻm 2 xẹc nhưng hẻm rộng 5m nhà 4 tấm diện tích tổng
  // 240m2" — một mảnh, câu chính là hẻm; "4 tấm" và sàn 240m2 rơi mất.
  ["ket_cau", /(?<!\b(?:toa|thap|block|xay|cao|toi da|xay toi da|tang)\s*)\b((?:\d{1,2}|mot|hai|ba|bon|nam|sau)\s*(?:tam|tang|lau)(?:\s*(?:lung|st|san thuong))?|tret\s*(?:\+|va)?\s*\d\s*(?:lau|lung))\b(?!\s*(?:cao|toi da))/, (m) => m[1]],
  ["dien_tich_san", DIEN_TICH_SAN_RE, (m) => `${m[1]}m2`],
];
// Nhiều căn trong MỘT tin ("căn A5 8x20 giá 18 tỷ, căn A7 8x20 giá 18 tỷ 5, căn B2 góc
// 10x20 giá 22 tỷ") — đại diện chủ đầu tư / môi giới rao theo lô (chân dung 3, 10/09).
// 11/09/2026 (42 ca): "anh có 2 căn: 1 căn q5 50m2 6 tỷ, 1 căn q11 40m2 4 tỷ" —
// "q5" đứng sau chữ "căn" là QUẬN, không phải mã căn; bản trước ghi unit_code
// "Q5" và quận mặc định. Nay tách `quan`, và giữ diện tích m² nếu có.
// 15/09/2026 (bắn thử 07:19 UTC): "em có 2 căn: căn 1 hẻm 3m nguyễn trãi q5 4x12 giá 5 tỷ,
// căn 2 mặt tiền trần phú q5 4x20 giá 18 tỷ" — "căn 1 / căn 2 / căn thứ 2" là SỐ THỨ TỰ,
// không phải mã căn, bản trước không nhận → chỉ mở căn 1, còn câu nối "còn căn 2 …" bị
// hiểu là SỬA căn 1 (căn 1 mang luôn 4x20 và 18 tỷ). Nay nhận thứ tự (`thu`), không ghi
// unit_code. Số ngay sau "căn" mà kèm đơn vị (2 pn, 2 tầng, 2 x 10) thì không phải thứ tự.
export type CanTrongTin = { ma?: string; thu?: number; quan?: string; ngang?: string; dai?: string; dt?: string; gia?: string; goc: string;
  /** Loại đọc từ CHÍNH mảnh của căn (căn hộ / nhà / đất) — mảnh không nói thì không có. */
  loai?: "chung_cu" | "nha_pho" | "dat";
  /** Mảnh tách theo LOẠI ("căn nhà …, với 1 căn hộ …"), không theo số thứ tự. */
  theoLoai?: true };
const CAN_CHU_RE = /(?:^|[^\p{L}])(?:[Cc]ăn|[Cc]an|[Ll]ô|[Ll]o)\s+([A-H])(?![\p{L}\d])/u;
/** Loại BĐS nói bằng chữ trong một mảnh (không dấu): căn hộ/chung cư > đất > nhà. */
export function loaiTuChu(kd: string): "chung_cu" | "nha_pho" | "dat" | undefined {
  if (/\b(?:can ho|chung cu)\b/.test(kd)) return "chung_cu";
  if (/\b(?:lo dat|manh dat|mieng dat|dat nen|dat tho cu|dat vuon|dat nong nghiep)\b/.test(kd) || /\b(?:lo|manh|mieng)\b[^,.;]*\bdat\b/.test(kd) ||
    (/\bdat\b/.test(kd) && !/\bdat coc\b/.test(kd) && !/\bnha\b/.test(kd))) return "dat";
  if (/\bnha\b/.test(kd)) return "nha_pho";
  return undefined;
}
const giaTuKd = (kd: string): string | undefined => {
  const m = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${TIEN_KD})(?![a-z])(?:\\s*(\\d{1,3}(?:[.,]\\d+)?)${KHONG_PHAI_LE_GIA})?(?:\\s*(ruoi))?`).exec(kd);
  return m ? `${m[1]} ${m[2] === "toi" ? "tỏi" : /^t[iy]$/.test(m[2]) ? "tỷ" : "triệu"}${m[3] ? ` ${m[3]}` : ""}${m[4] ? " rưỡi" : ""}` : undefined;
};
/**
 * 23/09/2026 (bắn thật, 5 người): "Chị cần bán 2 căn: căn nhà hẻm 5m Nguyễn Trãi quận 5 60m2 giá 9 tỷ, với 1 căn hộ
 * chung cư Hà Đô quận 10 2PN 75m2 giá 5 tỷ 2" — không có "căn 1/căn 2" nên bản trước gộp làm MỘT tin (loại căn hộ, 2PN
 * của căn hộ, giá của căn nhà). Tách theo chữ LOẠI (căn nhà / căn hộ / chung cư / lô đất / đất…) khi câu báo nhiều căn
 * ("2 căn", "hai nhà", "với 1 căn hộ…"). Mỗi mảnh phải có GIÁ; mảnh chưa có giá ("căn hộ" đứng trước "chung cư …")
 * gộp vào mảnh kề sau (hoặc trước, nếu là mảnh cuối).
 */
function tachTheoLoai(text: string): CanTrongTin[] {
  const kdAll = boDau(text);
  const baoNhieu = /\b(?:2|3|4|hai|ba|bon)\s+(?:can|nha|lo|manh|mieng|bds|bat dong san|cai|tai san|noi)\b/.test(kdAll) ||
    /\b(?:voi|va|con|them)\s+(?:1|mot)\s+(?:can|nha|lo|manh|mieng)\b/.test(kdAll);
  if (!baoNhieu) return [];
  const re = /(?:^|[\s,;:.])((?:(?:với|voi|và|va|còn|con|thêm|them)\s+)?(?:(?:1|một|mot)\s+)?(?:căn hộ|can ho|chung cư|chung cu|căn nhà|can nha|nhà|nha|lô đất|lo dat|mảnh đất|manh dat|miếng đất|mieng dat|đất nền|dat nen)(?![\p{L}]))/giu;
  const moc: number[] = [];
  for (let m = re.exec(text); m; m = re.exec(text)) moc.push(m.index + m[0].length - m[1].length);
  if (moc.length < 2) return [];
  let manh = moc.map((bat, i) => text.slice(bat, moc[i + 1]).replace(/[\s,;:.]+$/u, "").trim()
    .replace(/^(?:với|voi|và|va|còn|con|thêm|them)\s+(?:(?:1|một|mot)\s+)?/iu, ""));
  const coGia = (s: string) => !!giaTuKd(boDau(s));
  const gop: string[] = [];
  let cho = "";
  for (const m of manh) {
    if (coGia(m)) { gop.push(`${cho}${cho ? " " : ""}${m}`); cho = ""; } else cho = `${cho}${cho ? " " : ""}${m}`;
  }
  if (cho && gop.length) gop[gop.length - 1] = `${gop[gop.length - 1]} ${cho}`;
  manh = gop;
  if (manh.length < 2) return [];
  return manh.map((goc, i) => {
    const kd = boDau(goc);
    const mKt = /(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/.exec(kd);
    const mDt = /(\d{1,4}(?:[.,]\d+)?)\s*m2/.exec(kd);
    const q = /\b(?:quan|q)\s*\.?\s*(\d{1,2})\b/.exec(kd);
    const loai = loaiTuChu(kd);
    return { thu: i + 1, ...(q ? { quan: `Quận ${Number(q[1])}` } : {}), ngang: mKt?.[1], dai: mKt?.[2], dt: mDt?.[1], gia: giaTuKd(kd), goc, ...(loai ? { loai } : {}), theoLoai: true as const };
  });
}
export function nhanDienNhieuCan(text: string): CanTrongTin[] {
  const out: CanTrongTin[] = [];
  // 23/09/2026: "em ban 2 nha: nha 1 hem 3m …, nha 2 mat tien …" — "nhà 1/nhà 2" là số thứ tự khi câu có CẢ HAI
  // ("nhà 2 mặt tiền" đứng một mình là nhà hai mặt tiền, không phải căn thứ hai).
  const kdToan = boDau(text);
  const nhaThu = /\bnha\s+1\b/.test(kdToan) && /\bnha\s+2\b/.test(kdToan);
  const reThu = new RegExp(`(?:^|[^\\d])\\b(?:can|lo${nhaThu ? "|nha" : ""})\\s+(?:so\\s+|thu\\s+)?(\\d{1,2})\\b(?!\\s*(?:x\\s*\\d|m2|m\\b|ty|ti|toi|trieu|tr\\b|pn|phong|lau|tang|tam|met|wc))`);
  for (const goc of text.split(/[,;\n]|\s+va\s+|\s+và\s+/i).map((s) => s.trim()).filter(Boolean)) {
    const kd = boDau(goc);
    const mMa = /\b(?:can|lo|shop|nen)\s*(?:so\s*)?([a-z]{1,3}[\s.\-]?\d{1,3}(?:[.\-]\d{1,3})?[a-z]?|\d{1,3}[a-z])\b/.exec(kd);
    const mThuSo = mMa ? null : reThu.exec(kd);
    // 23/09/2026 (bắn thật, môi giới): "căn A 1pn 52m2 giá 4.8 tỷ, căn B 2pn 80m2 giá 7 tỷ 1" — CHỮ IN HOA
    // làm số thứ tự (A=1, B=2…). Chỉ nhận chữ in hoa đứng một mình ("căn A12-05" là mã căn, "căn ạ" không phải).
    const mChu = mMa || mThuSo ? null : CAN_CHU_RE.exec(goc);
    const mThu: [string, string] | null = mThuSo ? [mThuSo[0], mThuSo[1]] : mChu ? [mChu[0], String(mChu[1].charCodeAt(0) - 64)] : null;
    if (!mMa && !mThu) continue;
    if (mThu) {
      const mKt = /(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/.exec(kd);
      const mDt = /(\d{1,4}(?:[.,]\d+)?)\s*m2/.exec(kd);
      const mGia = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${TIEN_KD})(?![a-z])(?:\\s*(\\d{1,3}(?:[.,]\\d+)?)${KHONG_PHAI_LE_GIA})?(?:\\s*(ruoi))?`).exec(kd);
      const q = /\b(?:quan|q)\s*\.?\s*(\d{1,2})\b/.exec(kd);
      // 15/09/2026 (bắn thật N2): "căn 2 sổ hồng riêng, căn 1 đúc 3 tấm" là FACT cho căn đã
      // mở, không phải rao thêm — căn thứ tự không giá, không kích thước thì không tính.
      if (!mKt && !mDt && !mGia) continue;
      const loaiThu = loaiTuChu(kd.replace(/\bnha\s+\d\b/, ""));
      out.push({
        thu: Number(mThu[1]), ...(q ? { quan: `Quận ${Number(q[1])}` } : {}), ...(nhaThu ? { loai: loaiThu ?? "nha_pho" } : loaiThu ? { loai: loaiThu } : {}),
        ngang: mKt?.[1], dai: mKt?.[2], dt: mDt?.[1],
        gia: mGia ? `${mGia[1]} ${mGia[2] === "toi" ? "tỏi" : /^t[iy]$/.test(mGia[2]) ? "tỷ" : "triệu"}${mGia[3] ? ` ${mGia[3]}` : ""}${mGia[4] ? " rưỡi" : ""}` : undefined,
        goc,
      });
      continue;
    }
    const laQuan = /^q\s*\.?\s*\d{1,2}$/.test(mMa![1]);
    const mKt = /(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/.exec(kd);
    const mDt = /(\d{1,4}(?:[.,]\d+)?)\s*m2/.exec(kd);
    const mGia = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${TIEN_KD})(?![a-z])(?:\\s*(\\d{1,3}(?:[.,]\\d+)?)${KHONG_PHAI_LE_GIA})?(?:\\s*(ruoi))?`).exec(kd);
    out.push({
      ...(laQuan
        ? { quan: `Quận ${Number(mMa![1].replace(/\D/g, ""))}` }
        : { ma: mMa![1].replace(/[\s.]/g, "").toUpperCase() }),
      ngang: mKt?.[1], dai: mKt?.[2], dt: mDt?.[1],
      gia: mGia ? `${mGia[1]} ${mGia[2] === "toi" ? "tỏi" : /^t[iy]$/.test(mGia[2]) ? "tỷ" : "triệu"}${mGia[3] ? ` ${mGia[3]}` : ""}${mGia[4] ? " rưỡi" : ""}` : undefined,
      goc,
    });
  }
  return out.length >= 2 ? out : tachTheoLoai(text);
}
/**
 * Tin nói về NHIỀU CĂN đã mở, theo số thứ tự: "căn 2 sổ hồng riêng, có thương lượng. căn 1
 * đúc 3 tấm" → [{thu: 2, manh: "sổ hồng riêng, có thương lượng."}, {thu: 1, manh: "đúc 3 tấm"}].
 * Số ngay sau "căn" mà kèm đơn vị (2 pn, 2 x 10, 2 tấm) thì không phải thứ tự. (15/09/2026)
 */
export function tachTheoCan(text: string): Array<{ thu: number; manh: string }> {
  const out: Array<{ thu: number; manh: string }> = [];
  const re = /(?:^|[\s,;.])(?:căn|can|lô|lo)\s+(?:số\s+|so\s+|thứ\s+|thu\s+)?(\d{1,2})(?![\d])(?!\s*(?:x\s*\d|m2|m\b|tỷ|ty|tỉ|ti|tỏi|toi|triệu|trieu|tr\b|pn|phòng|phong|lầu|lau|tầng|tang|tấm|tam|mét|met|wc))/giu;
  const moc: Array<{ thu: number; bat: number; het: number }> = [];
  for (let m = re.exec(text); m; m = re.exec(text)) moc.push({ thu: Number(m[1]), bat: m.index, het: m.index + m[0].length });
  // 23/09/2026: "căn B …" — chữ in hoa làm thứ tự (A=1, B=2…), cùng luật `nhanDienNhieuCan`.
  const reChu = /(?:^|[\s,;.])(?:[Cc]ăn|[Cc]an|[Ll]ô|[Ll]o)\s+([A-H])(?![\p{L}\d])/gu;
  for (let m = reChu.exec(text); m; m = reChu.exec(text)) moc.push({ thu: m[1].charCodeAt(0) - 64, bat: m.index, het: m.index + m[0].length });
  moc.sort((a, b) => a.bat - b.bat);
  for (let i = 0; i < moc.length; i++) {
    const manh = text.slice(moc[i].het, i + 1 < moc.length ? moc[i + 1].bat : undefined).replace(/^[\s:,.-]+|[\s,.]+$/g, "");
    if (manh.length >= 2) out.push({ thu: moc[i].thu, manh });
  }
  return out;
}
export function nhanDienNhieuFact(text: string): NhanDien[] {
  const out: NhanDien[] = [];
  // 14/09/2026: tin rao kiểu Facebook ("🏢 Kết cấu: 3 tấm", "📜 Sổ hồng riêng") — đáp án bỏ
  // biểu tượng và nhãn "Kết cấu:" ở đầu mảnh.
  const gon = (a: string) => a.replace(/^[\p{Extended_Pictographic}️‍\s•\-*]+/u, "")
    .replace(/^(?:kết cấu|pháp lý|giá|diện tích|dt|địa chỉ|vị trí|hướng|nội thất)\s*:\s*/iu, "").trim() || a;
  const them = (nd: NhanDien | null) => {
    if (nd && !out.some((x) => x.question === nd.question)) out.push({ ...nd, answer: gon(nd.answer) });
  };
  // 11/09/2026 (42 ca): xét từng MẢNH trước cả câu. Bản trước lấy nhanDienFact(cả
  // câu) trước, nên câu rao "bán nhà …, 4x16, 1 trệt 2 lầu, shr, 9t5" ghi fact pháp
  // lý là NGUYÊN câu rao (5/42 tin). Mảnh "shr" mới là câu trả lời pháp lý.
  // 15/09/2026 (bắn thật A3): "3 phòng ngủ em. nhà đang cho thuê 25 triệu/tháng" — dấu chấm + khoảng trắng cũng là ranh mảnh.
  // 24/09/2026 (xuất prompt, lượt Trần Đình Xu): "còn tầng 1 và 2 là để kinh doanh" bị cắt ở "và" thành
  // tiềm năng "2 là để kinh doanh". "và" giữa hai SỐ ("tầng 1 và 2", "lầu 2 và 3") không phải ranh mảnh.
  const manh = text.split(/[,;\n]|\.\s+(?=\S)|(?<!\d)\s+(?:va|và)\s+|(?<=\d)\s+(?:va|và)\s+(?!\d)/i).map((s) => s.trim()).filter((s) => s.length >= 2);
  if (manh.length > 1) for (const s of manh) them(nhanDienFact(s));
  // 13/09/2026 (lượt bắn thật): câu nhiều mảnh mà lượt CẢ CÂU trả về nguyên câu
  // làm đáp án thì đó là rác — "anh cần bán căn nhà hẻm xe hơi 5m Nguyễn Trãi…"
  // thành fact độ rộng hẻm, "ngang 5 dài 20, đường nhựa 7m, sổ riêng" thành pháp
  // lý. Các mảnh đã được xét riêng ở trên; cả câu chỉ còn được góp đáp án ĐÃ CẮT.
  const caCau = nhanDienFact(text);
  if (manh.length <= 1 || (caCau && caCau.answer !== text.trim())) them(caCau);
  const kd = boDau(text);
  const kdD = boDauGiuDoDai(text);
  for (const [q, re, lay] of FACT_PHU) {
    // Lý do bán giữ DẤU ("cần tiền", không phải "can tien"): khớp trên bản bỏ dấu
    // giữ độ dài rồi cắt đúng đoạn chữ gốc.
    if (q === "ly_do_ban" || q === "view" || q === "ket_cau") {
      const mm = re.exec(kdD);
      if (mm) them({ question: q, answer: text.slice(mm.index, mm.index + mm[0].length).trim() });
      continue;
    }
    const m = re.exec(kd);
    // 15/09/2026 (bắn thật A2/C2): "nhà đang cho thuê 25 triệu/tháng" của tin BÁN là thu nhập
    // thuê, không phải giá mong muốn — luật hiện trạng (đang cho thuê) lo.
    if (m && q === "gia" && TRUOC_LA_THUE.test(kd.slice(Math.max(0, m.index - 30), m.index))) continue;
    if (m) them({ question: q, answer: lay(m) });
  }
  return out;
}
// Đổi loại giao dịch (15/09/2026): "cho thuê chứ không bán", "không bán, cho thuê",
// "đổi sang cho thuê" → thuê; "bán chứ không cho thuê", "chuyển qua bán" → bán.
export const DOI_SANG_THUE_RE = /\bcho thue\b[^,.]{0,6}\bchu\s+(?:khong|ko|k|hong)\s+(?:phai\s+)?ban\b|\b(?:khong|ko|k)\s+ban\b[^,.]{0,12}\bcho thue\b|\bcho thue\b[^,.]{0,12}\b(?:khong|ko|k)\s+ban\b|\b(?:doi|chuyen)\s+(?:sang|qua|thanh)\s+cho thue\b/;
// 24/09/2026 (bắn 10 tin, CHDV): "vẫn bán nha em, không phải cho thuê" — chủ khẳng định lại là BÁN.
export const DOI_SANG_BAN_RE = /\b(?:van|la|dang)\s+ban\b[^.]{0,20}\b(?:khong|ko|k|hong)\s+(?:phai\s+)?(?:la\s+)?cho thue\b|\bban\b[^,.]{0,6}\bchu\s+(?:khong|ko|k|hong)\s+(?:phai\s+)?cho thue\b|\b(?:khong|ko|k)\s+cho thue\b[^,.]{0,12}\bban\b|\b(?:doi|chuyen)\s+(?:sang|qua|thanh)\s+ban\b/;
export function nhanDienFact(text: string): NhanDien | null {
  const goc = text.trim();
  const kd = boDau(goc);
  const kdD = boDauGiuDoDai(goc);
  const catGoc = (mm: RegExpExecArray) => goc.slice(mm.index, mm.index + mm[0].length).trim();
  // 13/09/2026 (lượt bắn thật): luật trả NGUYÊN câu làm đáp án thì câu nhiều mảnh
  // mang rác vào ô — "ngang 5 dài 20, đường nhựa 7m, sổ riêng" thành pháp lý. Chỉ
  // lấy MẢNH (giữa hai dấu phẩy) có chứa từ khoá; câu một mảnh thì như cũ.
  const manhKhop = (re: RegExp): string => {
    const ps = goc.split(/[,;\n]|\.\s+(?=\S)/).map((x) => x.trim()).filter(Boolean);
    if (ps.length < 2) return goc;
    return ps.find((x) => re.test(boDau(x))) ?? goc;
  };
  let m: RegExpExecArray | null;
  // 17/09/2026: "srh" là gõ lỡ của "shr" (Zalo thật) — nhận luôn.
  const PHAP_LY_RE = /\b(so hong|so do|so chung|so rieng|hoan cong|vi bang|hop dong|hdmb|shr|srh|shrr|shc|giay tay|cam ngan hang|dang the chap)\b/;
  // 22/09/2026 (kịch bản D): "đang thế chấp ngân hàng" một mình là TÌNH TRẠNG thế chấp (`the_chap`), không phải loại
  // giấy tờ; có kèm sổ/hợp đồng thì vẫn là pháp lý (mảnh thế chấp đi riêng qua `nhanDienNhieuFact`).
  if (/\b(dang the chap|the chap|cam ngan hang|trong ngan hang)\b/.test(kd) &&
      !/\b(so hong|so do|so chung|so rieng|hoan cong|vi bang|hop dong|hdmb|shr|srh|shrr|shc|giay tay)\b/.test(kd)) {
    return { question: "the_chap", answer: goc };
  }
  // 24/09/2026 (chủ dự án test Zalo, tin đang cho Techcombank thuê): "Hợp đồng 10 năm cho thuê 4 năm rồi đó" là HỢP ĐỒNG
  // THUÊ đang chạy, không phải giấy tờ nhà — bản trước ghi đè ô pháp lý. Chữ "hợp đồng" đi với thuê / hạn / còn N năm và
  // không kèm giấy tờ (sổ, HĐMB, công chứng…) → hạn hợp đồng thuê.
  if (HOP_DONG_THUE_RE.test(kd) && !/\b(so hong|so do|so chung|so rieng|hoan cong|vi bang|hdmb|mua ban|cong chung|shr|shc|giay tay|sang ten)\b/.test(kd)) {
    return { question: "han_hop_dong_thue", answer: goc };
  }
  if (PHAP_LY_RE.test(kd)) {
    return { question: "phap_ly", answer: manhKhop(PHAP_LY_RE) };
  }
  // 10/09/2026 (chủ dự án): GẤP bắt ở MỌI lượt — "cần bán gấp", "không gấp, bán được
  // giá thì thôi", "không vội". Trả nguyên văn; tầng DB (sync_cols) đọc ra true/false.
  // 15/09/2026 (Zalo thật): "Được giá, căn tôi sở hữu…" — "được giá" đứng một mình cũng là nhịp bán.
  if (laGap(goc) || /\b(khong|ko|k|chua|chang|dau co)\s*(?:can\s*)?(?:gap|voi)\b|\bduoc gia\b|\bkhong voi\b|\btu tu\b|\bban duoc gia\b/.test(kd)) {
    // "gấp đôi / gấp 3 lần" là bội số; "cần bán gấp 5 tỷ" thì "5 tỷ" là giá, gấp vẫn là gấp.
    if (!/\bgap\s*(doi|ba|lan|ruoi|\d+(?:[.,]\d+)?\s*(?:lan|x\b))/.test(kd)) {
      // 16/09/2026: câu dài ("ngang 5m còn dọc 16m cần bán gấp") chỉ giữ mảnh gấp.
      const mg = GAP_CAT_RE.exec(kdD);
      return { question: "gap", answer: mg ? catGoc(mg) : goc };
    }
  }
  // 09/09 tối: những thứ CÓ SỐ nhưng không phải giá/diện tích — xét TRƯỚC giá,
  // kẻo "doanh thu 120 triệu/tháng" đè giá bán, "phí quản lý 15 nghìn/m2" rơi bo_sung.
  if (/\b(doanh thu|thu ve|dong tien|thu nhap|tien thue thu)\b/.test(kd)) return { question: "doanh_thu", answer: goc };
  if (/\b(phi quan ly|phi ql|phi dich vu|phi bao tri)\b/.test(kd)) return { question: "phi_quan_ly", answer: goc };
  if (/\b(phi gui xe|phi giu xe|tien gui xe)\b/.test(kd)) return { question: "phi_gui_xe", answer: goc };
  // 24/09/2026 (bắn 10 tin, biệt thự): "Bán biệt thự sân vườn Thảo Điền quận 2, …" → số của "quận 2" làm cả câu thành
  // ô sân vườn. Chỉ lấy MẢNH có chữ sân, và mảnh đó phải có số đo (không tính số quận / phường).
  if (/\b(san truoc|san sau|san vuon|co san|san rong|san dau xe)\b/.test(kd)) {
    const SAN_RE = /\b(san truoc|san sau|san vuon|co san|san rong|san dau xe)\b/;
    const mk = manhKhop(SAN_RE);
    const kdMk = boDau(mk).replace(/\b(?:quan|q|phuong|p|huyen)\.?\s*\d+/g, " ");
    if (SAN_RE.test(boDau(mk)) && /\d/.test(kdMk)) return { question: "san_vuon", answer: mk };
  }
  if (/\b(len tho cu|len tho|chuyen tho cu|chuyen muc dich)\b/.test(kd)) return { question: "len_tho_cu", answer: goc };
  if ((m = /\b(?:tho cu)\s*(?:duoc|la|het|full)?\s*(\d{1,4}(?:[.,]\d+)?)\s*(m2|%)/.exec(kd)) || (m = /\b(\d{1,4}(?:[.,]\d+)?)\s*(m2|%)\s*tho cu\b/.exec(kd))) {
    return { question: "tho_cu", answer: `${m[1]}${m[2]}` };
  }
  // "đường 12m", "đường trước đất rộng 8m" → độ rộng đường (đất), không phải địa chỉ.
  if ((m = new RegExp(`\\bduong\\s*(?:truoc dat|truoc nha|noi khu|noi bo)?\\s*(?:rong\\s*)?(?:la\\s*)?${SO}\\s*(?:m|met)\\b`).exec(kd))) {
    return { question: "do_rong_duong", answer: `đường ${m[1]}m` };
  }
  if ((m = /\b(?:xa|thi tran|tt)\.?\s+([a-z][a-z ]{2,30})$/.exec(kd)) && !/\bxa hoi\b/.test(kd)) {
    return { question: "phuong", answer: goc };
  }
  // 14/09/2026: "à anh nói lại, là đất trống chưa xây nha em" — đổi LOẠI BĐS giữa chừng.
  if (/\b(?:la|thanh|chuyen sang|doi sang)\s+dat\s*(?:trong|nen|tho cu)?\b|\bdat trong\b(?![^,.;]*\bnha\b)|\bchua xay\b/.test(kd) &&
      !/\b(?:cho xay|xay duoc|duoc xay|len tho)\b/.test(kd)) {
    return { question: "loai_bds", answer: /\bdat nen\b/.test(kd) ? "đất nền" : "đất trống" };
  }
  // "tầng 12" (chung cư), "thuê tối thiểu 1 năm", "hợp để ở / kinh doanh được" — 09/09 tối lần 2 rơi bo_sung.
  if ((m = /\b(?:tang|lau)\s*(?:thu\s*)?(\d{1,2})\b(?!\s*(?:lau|tang|tam|phong|m\b|met|x|%|(?:moi|mot|1)?\s*nam))/.exec(kd)) &&
      !/\b\d+\s*(?:lau|tang|tam)\b/.test(kd) && !/\btang\s*(?:gia|them|len)\b|\d\s*%/.test(kd) &&
      // 24/09/2026: "tầng 1 và 2 là để kinh doanh" kể các TẦNG của nhà phố, không phải căn hộ nằm tầng mấy.
      !/\b(?:tang|lau)\s*\d{1,2}\s*(?:va|den|toi|-|,)\s*\d/.test(kd)) {
    return { question: "tang", answer: m[1] };
  }
  // 16/09/2026 (bắn thật mau-co-thue): "cọc 2 tháng, ở tối thiểu 1 năm" → ô thời hạn ghi cả câu; chỉ lấy mảnh.
  const THOI_HAN_RE = /\b(thue toi thieu|toi thieu \d+ (?:nam|thang)|hop dong \d+ (?:nam|thang)|thoi han thue|ky \d+ nam|thue \d+ nam)\b/;
  if (THOI_HAN_RE.test(kd)) {
    return { question: "thoi_han_thue", answer: manhKhop(THOI_HAN_RE) };
  }
  // 15/09/2026 (bắn thật C4): "à mà nhà này cho thuê chứ ko bán, 25 triệu" là ĐỔI LOẠI
  // GIAO DỊCH — bản trước ghi vào ô "tiềm năng", tin vẫn là tin BÁN và 25 triệu bị
  // trigger giá gạt (dưới sàn giá bán). Đáp án là giá trị enum `listings.deal`;
  // trigger `listing_facts_sync_deal` (20260915d) lật cột và tính lại giá.
  if (DOI_SANG_THUE_RE.test(kd)) return { question: "loai_giao_dich", answer: "cho_thue" };
  if (DOI_SANG_BAN_RE.test(kd)) return { question: "loai_giao_dich", answer: "ban" };
  // 13/09/2026: "cho thuê căn hộ Sunrise City quận 7" là VIỆC RAO (deal + loại
  // BĐS), không phải tiềm năng — bản trước ghi nó vào ô "Phù hợp".
  // 16/09/2026 (bắn thật mau-co-thue): "cô có căn chung cư ở q7 muốn cho thuê" → ô tiềm năng.
  // "muốn/cần/đang + bán/cho thuê" là VIỆC rao, dù không có vật sau chữ đó.
  const laViecRao = /\b(?:ban|cho thue|sang|sang nhuong|de lai)\s+(?:lai\s+)?(?:gap\s+)?(?:can ho|can|nha|dat|lo|phong|mat bang|chung cu|kho|xuong|shophouse|biet thu|nen|mieng)\b/.test(kd) ||
    /\b(?:muon|can|dang|nho|ky gui|giao)\s+(?:giao\s+|gui\s+)?(?:ban|cho thue|sang nhuong)\b/.test(kd);
  // 16/09/2026 (Zalo thật): "nhà ở từ năm 2019 rồi" là HIỆN TRẠNG (đang ở, từ khi nào), không
  // phải tiềm năng sử dụng.
  const O_TU_NAM_RE = /\b(?:nha\s+)?(?:o|xay|xay dung|su dung|dang o)\s+(?:tu|hoi|nam)\s+(?:nam\s+)?((?:19|20)\d{2})\b/;
  if ((m = O_TU_NAM_RE.exec(kd))) return { question: "hien_trang", answer: manhKhop(O_TU_NAM_RE) };
  // 21/09/2026 (bắn thật mau-tdt): "nhà ở đường trần đình trọng quận 5" là ĐỊA CHỈ ("ở" = nằm ở), từng
  // thành tiềm năng "nhà ở" rồi lên bản nháp "💡 Phù hợp: nhà ở đường…". "ở" theo sau là đường/hẻm/số/
  // phường/quận/khu/gần… thì không phải cách dùng.
  // 24/09/2026 (chủ dự án test Zalo): "ở Nguyễn Trãi quận 5" — tên đường KHÔNG có chữ "đường" đứng trước — cũng là
  // địa chỉ: chữ sau "ở" viết hoa (tên riêng) hoặc câu có quận/phường/huyện thì không phải cách dùng.
  const oLaDiaChi = /^\s*(?:nhà\s+)?ở\s+\p{Lu}/u.test(goc.trim()) || /\b(?:quan|q|phuong|p)\s*\d{1,2}\b|\b(?:quan|huyen|phuong|xa|tinh)\s+[a-z]/.test(kd);
  if (!laViecRao && (/^\s*(?:hop|de|nha)?\s*(?:hop )?(?:de o|o gia dinh|o(?!\s+(?:duong|hem|hxh|so|sn|phuong|quan|q\d|p\d|tai|gan|khu|xa|tren|trong|ngay|mat tien|chung cu|du an))|kinh doanh|buon ban|cho thue|lam van phong|mo shop|mo quan|lam cua hang)(?:\s|$|,)/.test(kd) && kd.split(/\s+/).length <= 8 &&
        !(/^\s*(?:nha\s+)?o\s/.test(kd) && oLaDiaChi)) ||
      (/\b(o hoac|hoac lam|deu duoc|lam can ho dich vu|lam chdv|hop (?:de )?(?:o|kinh doanh|cho thue|lam))\b/.test(kd) && kd.split(/\s+/).length <= 14 &&
        !/\b(showroom|lam xuong|van phong cong ty|nha hang|benh vien|truong hoc|lam kho)\b/.test(kd))) {
    return { question: "tiem_nang", answer: goc };
  }
  // Nội thất: "để lại máy lạnh, bếp", "full nội thất", "nhà trống".
  // 13/09/2026: "để lại căn nhà 4x16…" là BÁN, không phải để lại nội thất.
  const NOI_THAT_RE = /\b(de lai(?!\s+(?:lai\s+)?(?:can|nha|lo|dat|nen|mieng|mat bang|cho|gia|so|phong))|full noi that|noi that (?:co ban|day du|full)|may lanh|tu lanh|giuong|bep|ban giao (?:tho|trong|nha trong)|nha trong(?!\s+(?:hem|ngo|kiet|ngach|khu|duong|xom|day|toa|chung cu|du an|kdc|so|lo)))\b/;
  if (NOI_THAT_RE.test(kd) && !/\b(mat tien|m2|ty|trieu)\b/.test(kd)) {
    return { question: "noi_that", answer: manhKhop(NOI_THAT_RE) };
  }
  // "phường Tân Hưng" (tên chữ, câu ngắn) — phường số bắt ở dưới.
  if (/^\s*(?:phuong|p\.)\s+[a-z][a-z ]{2,25}\s*$/.test(kd) && !/\d/.test(kd)) return { question: "phuong", answer: goc };
  // Đường VÀO đất/xưởng: chất liệu, xe tải — không phải địa chỉ.
  const DUONG_VAO_RE = /\b(duong (?:be tong|nhua|dat|dal|cap phoi)|xe tai (?:vao|vo|chay)|duong vao)\b/;
  if (DUONG_VAO_RE.test(kd)) return { question: "duong_vao", answer: manhKhop(DUONG_VAO_RE) };
  // Vị trí cụ thể: "đường Trần Bình Trọng", "hẻm 123/45 Nguyễn Trãi", "số 12
  // Lê Lợi", "123/4 An Dương Vương". "hẻm 4m" (độ rộng) không rơi vào đây vì
  // sau số là đơn vị mét, không phải "/" hay tên đường.
  // 16/09/2026 (Zalo thật): "Căn số 14 ở Ny'ah Phú Định" — số căn + "ở/tại/trong" + tên
  // dự án / khu là VỊ TRÍ; bản trước không nhận, "14" thành diện tích đất.
  if (/\b(duong|pho)\s+[a-z]{2,}/.test(kd) ||
      /\b(?:can|lo|nen|shop)\s*(?:so\s*)?\d+[a-z]?(?:[.\-\/]\d+)?\s+(?:o|tai|trong|thuoc|cua)\s+[a-z]{2,}/.test(kd) ||
      /\b(?:hem|hxh)\s*\d+(?:\/\d+)+\b/.test(kd) ||
      // "hẻm 123 Trần Bình Trọng": số hẻm rồi TÊN ĐƯỜNG (chữ), không phải "hẻm 4m".
      // 22/09/2026 (kịch bản C): "em xoá cái hẻm 4m ghi nhầm đi" — "4m" từng đọc thành số hẻm "4" + hậu tố
      // "m", chữ "ghi" thành tên đường, cả câu vào địa chỉ. Hậu tố số nhà không được là "m" đứng trơ.
      /\b(?:hem|hxh)\s*\d+(?:(?!m\b)[a-z])?\s+(?!m\b|met\b|xe\b|rong\b|thong\b|cut\b|xec\b|sec\b|set\b|xet\b|lan\b|doi\b)[a-z]{2,}/.test(kd) ||
      /\b(?:so|so nha|dia chi)\s*\d+[a-z]?(?:\/\d+)*\s+[a-z]{2,}/.test(kd) ||
      /^\s*\d+[a-z]?(?:\/\d+[a-z]?)+\s+[a-z]{2,}/.test(kd)) {
    // 17/09/2026 (Zalo thật): "Chào cháu, cô có căn nhà hẻm 4m Trần Hưng Đạo quận 5, 50m2, giá 5 tỷ 8…"
    // từng vào NGUYÊN CÂU làm vị trí (location_raw = cả câu, street = "Chào cháu"). Câu dài /
    // có dấu phẩy thì chỉ lấy mệnh đề địa chỉ (`bocViTriRao`), không lấy cả câu.
    const dai = goc.length > 40 || /[,;]/.test(goc);
    return { question: "vi_tri", answer: dai ? (bocViTriRao(goc) ?? goc) : goc };
  }
  // 22/09/2026 (kịch bản D): "nhà cô đang cho thuê 30 triệu/tháng" là DÒNG TIỀN đang thu (doanh_thu →
  // rent_income_vnd), không phải giá thuê rao, không chỉ là hiện trạng. Xét trước luật giá.
  if (/\b(?:dang|co)\s+cho thue\b|\bcho thue\s+(?:duoc|lai)\b/.test(kd) &&
      (m = new RegExp(`${SO}\\s*(trieu|tr)(?![a-z])(?:\\s*(\\d{1,3})(?![\\d])(?!\\s*(?:thang|th\\b)))?\\s*(?:\\/|mot|moi|1|\\s)\\s*(?:thang|th)\\b`).exec(kd))) {
    return { question: "doanh_thu", answer: `${m[1].replace(",", ".")} triệu${m[3] ? ` ${m[3]}` : ""}/tháng` };
  }
  // "cách mặt tiền 30m" xét TRƯỚC độ rộng hẻm (kẻo "30m hẻm thông" thành hẻm 30m).
  if ((m = new RegExp(`\\bcach\\s*(?:mat tien|duong lon|duong chinh|mt)\\s*(?:khoang|tam|chung)?\\s*${SO}\\s*(?:m|met)?\\b`).exec(kd))) {
    return { question: "cach_mat_tien", answer: `${m[1]}m` };
  }
  // 14/09/2026 (bắn 14 tin bán): "hẻm rộng tầm 2m5 thôi em" không vào ô nào, bot hỏi lại
  // đúng câu hẻm rộng mấy mét. "2m5" = 2,5 m ("5m2" vẫn là diện tích — số sau m khác 2).
  if ((m = /\b(?:hem|hem truoc nha)\s*(?:rong\s*)?(?:la\s*|tam\s*|khoang\s*|chung\s*|co\s*|chi\s*)?(\d{1,2})\s*m\s*([013-9])(?!\d)/.exec(kd))) {
    return { question: "do_rong_hem", answer: `hẻm ${m[1]}.${m[2]}m` };
  }
  // Độ rộng hẻm: có đơn vị mét, hoặc số nhỏ (≤ 30) đứng cuối / trước dấu câu —
  // "hẻm 123 Trần Bình Trọng" là địa chỉ (đã bắt ở trên), không phải "hẻm 123m".
  if ((m = new RegExp(`\\b(?:hem|hem rong|hem truoc nha)\\s*(?:rong\\s*)?(?:la\\s*|tam\\s*|khoang\\s*|chung\\s*|co\\s*|chi\\s*)?${SO}\\s*(?:m|met)\\b`).exec(kd)) ||
      (m = new RegExp(`\\b(?:hem|hem rong|hem truoc nha)\\s*(?:rong\\s*)?(?:la\\s*)?(\\d{1,2}(?:[.,]\\d+)?)\\s*(?=$|[,.;!?]|\\s+(?:xe\\b|o to|oto|thong|cut|nha|em|anh|chi|a\\b))`).exec(kd)) ||
      (m = new RegExp(`${SO}\\s*(?:m|met)\\s*hem\\b`).exec(kd))) {
    return { question: "do_rong_hem", answer: `hẻm ${m[1]}m` };
  }
  if ((m = /\b(hem xe hoi|hem oto|hem o to|xe hoi (?:vao|toi|tới) (?:duoc|tan|toi)|hem xe tai)\b(?:\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:m|met)\b)?/.exec(kdD))) {
    // 13/09/2026: cắt đúng cụm ("hẻm xe hơi 5m"), không lấy cả câu rao làm đáp án
    // — trigger đọc số ĐẦU TIÊN trong đáp án, câu "hẻm 102 … hẻm xe hơi" là ra 102.
    return { question: "do_rong_hem", answer: catGoc(m) };
  }
  // 20260909i: "cách mặt tiền 50m" là KHOẢNG CÁCH, không phải chiều ngang.
  if ((m = new RegExp(`\\bcach\\s*(?:mat tien|duong lon|duong chinh|mt)\\s*(?:khoang|tam|chung)?\\s*${SO}\\s*(?:m|met)?\\b`).exec(kd))) {
    return { question: "cach_mat_tien", answer: `${m[1]}m` };
  }
  // 17/09/2026 (Zalo thật): "ngang 5m còn dọc 18m" — có cả hai chiều là DIỆN TÍCH (DB nhân ra
  // m²), không phải câu vô danh rơi vào ô phường.
  {
    const nd = ngangDai(kd);
    if (nd) return { question: "dien_tich", answer: nd };
  }
  if ((m = new RegExp(`\\b(?:ngang|rong|mat tien|mt)\\s*(?:la\\s*)?${SO}\\s*(?:m|met)?\\b`).exec(kd)) &&
      !/\b(dai|sau|doc)\b/.test(kd)) {
    return { question: "mat_tien", answer: `${m[1]}m` };
  }
  // 16/09/2026 (Zalo thật): "nhà 4 tấm diện tích tổng 240m2" — 240 là SÀN (cộng các
  // tầng), không phải đất; bản trước ghi area_m2 = 240. Diện tích sàn / sử dụng / xây
  // dựng là fact riêng `dien_tich_san`, DB không đổ vào cột đất. "tổng diện tích" chỉ
  // là sàn khi câu có tầng/tấm/lầu và không nói "đất".
  if ((m = DIEN_TICH_SAN_RE.exec(kd))) {
    return { question: "dien_tich_san", answer: `${m[1]}m2` };
  }
  if ((m = new RegExp(`${SO}\\s*(?:m2|m²|met vuong|mv)\\b`).exec(kd)) ||
      (m = new RegExp(`${SO}\\s*x\\s*${SO}`).exec(kd))) {
    return { question: "dien_tich", answer: m[0].replace(/\s+/g, " ") };
  }
  // Giá: khớp trên bản bỏ dấu GIỮ ĐỘ DÀI rồi cắt đúng đoạn gốc ("18 tỷ", "4 tỷ 5").
  if ((m = new RegExp(`${SO}\\s*(?:${TIEN_KD})(?![a-z])(?:\\s*${SO})?(?:\\s*(?:ruoi|thuong luong|tl))?`).exec(kdD)) &&
      // 15/09/2026 (bắn thật A2): "đang cho thuê 25 triệu/tháng" là thu nhập thuê, không phải giá.
      !TRUOC_LA_THUE.test(kd.slice(Math.max(0, m.index - 30), m.index))) {
    return { question: "gia", answer: catGoc(m) };
  }
  // Toà / tháp / block của chung cư — bắt TRƯỚC luật kết cấu, vì "toa S3.02 tang
  // 15" có chữ "tang" nên luật kết cấu vơ cả câu (bắt 10/09 ở lượt bắn 15 tin:
  // bản nháp in "🏗 Kết cấu: toa S3.02 tang 15 · tầng 15 · 2 phòng ngủ").
  // Chỉ nhận khi sau chữ toà/tháp/block là một MÃ (có số hoặc một chữ cái đơn) —
  // "toà nhà văn phòng" hay "block đất" thì không phải mã toà.
  // Số sau chữ toà/block mà đi kèm ĐƠN VỊ ĐẾM thì là số lượng, không phải mã toà:
  // "toà 20 phòng cho thuê" là hai mươi phòng — CI bắt được 10/09. Còn "toà S3.02
  // tầng 15" thì chữ "tầng" đứng sau mã là bình thường, vẫn nhận.
  if ((m = /\b(?:toa|thap|block|khoi)\s+([a-z]?\d[a-z0-9.\-]{0,6}|[a-z]\d?)(?!\s*(?:phong|can|nen|m2|ty|ti|trieu|tr|nha|xuong))(?=\s|$|,)/.exec(kd)) &&
      !/\b(toa nha|van phong|cong ty|nha xuong)\b/.test(kd)) {
    return { question: "toa_thap", answer: m[1].toUpperCase() };
  }
  // 20260909i: "xây tối đa 5 tầng" là TẦNG CAO CHO PHÉP của lô đất, không phải kết cấu nhà.
  if ((m = /\b(?:xay|cao)\s*(?:toi da|duoc)\s*(\d{1,2})\s*(?:tang|lau|tam)\b/.exec(kd))) return { question: "tang_cao_toi_da", answer: m[1] };
  if ((m = /\b(\d{1,2}|mot|hai|ba|bon|nam|sau)\s*(?:lau|tang|tam)\b/.exec(kd)) || /\btret\b/.test(kd)) {
    return { question: "ket_cau", answer: goc };
  }
  if ((m = /\b(\d{1,2}|mot|hai|ba|bon|nam|sau)\s*(?:phong ngu|pn)\b/.exec(kd))) {
    return { question: "so_phong_ngu", answer: m[1] };
  }
  if ((m = /\b(?:phuong|p)\.?\s*(\d{1,2})\b/.exec(kd))) {
    return { question: "phuong", answer: `Phường ${m[1]}` };
  }
  if ((m = /\b(?:xay|hoan cong|xd)\s*(?:nam\s*|tu\s*)?((?:19|20)\d{2})\b/.exec(kd))) {
    return { question: "nam_xay", answer: m[1] };
  }
  if ((m = /\bhuong\s*(?:dong|tay|nam|bac)(?:\s*(?:dong|tay|nam|bac))?\b/.exec(kdD))) return { question: "huong", answer: catGoc(m) };
  // FR-186: cho thuê — "cọc 2 tháng", "cọc 1 đóng 3"; "tăng 5%/năm", "trượt giá 10%".
  if ((m = /\bcoc\s*(\d{1,2})\s*(?:thang|th)?\b/.exec(kd)) || (m = /\b(\d{1,2})\s*thang\s*(?:tien\s*)?coc\b/.exec(kd))) {
    return { question: "tien_coc", answer: `cọc ${m[1]} tháng` };
  }
  if ((m = /\b(?:tang|truot gia|len)\s*(?:gia\s*)?(?:khoang\s*)?(\d{1,2})\s*%/.exec(kd)) || (m = /(\d{1,2})\s*%\s*(?:moi|1|mot)?\s*nam\b/.exec(kd))) {
    return { question: "truot_gia", answer: `${m[1]}%/năm` };
  }
  // 20260909i: câu hỏi bù sau đăng (chat 21/06 lượt 65–67, chat 07/09).
  if ((m = /\b(\d{1,2})\s*(?:wc|toilet|ve sinh|nha ve sinh)\b/.exec(kd)) || (m = /\b(?:wc|toilet)\s*(\d{1,2})\b/.exec(kd))) {
    return { question: "so_wc", answer: m[1] };
  }
  if ((m = new RegExp(`\\bcach\\s*(?:mat tien|duong lon|duong chinh|mt)\\s*(?:khoang|tam|chung)?\\s*${SO}\\s*(?:m|met)?\\b`).exec(kd))) {
    return { question: "cach_mat_tien", answer: `${m[1]}m` };
  }
  if ((m = new RegExp(`\\bno hau\\s*(?:la\\s*|hon\\s*|khoang\\s*)?${SO}\\s*(?:m(\\d)|m|met)?(?![a-z0-9])`).exec(kd))) return { question: "no_hau", answer: `${m[1].replace(",", ".")}${m[2] ? `.${m[2]}` : ""}m` };
  if (/\b(ngap|dong nuoc|khong ngap|ko ngap|kho rao|cao rao)\b/.test(kd) && /\b(mua|nuoc|ngap|cao rao|kho rao)\b/.test(kd)) {
    return { question: "ngap_nuoc", answer: goc };
  }
  if (/\b(hem thong|hem cut|quay dau|thong ra|khong thong|ko thong)\b/.test(kd)) return { question: "hem_thong", answer: goc };
  if (/\b(dang the chap|the chap|cam ngan hang|so cam tay|cam tay|trong ngan hang|ket sat)\b/.test(kd)) return { question: "the_chap", answer: goc };
  if (/\b(thuong luong|\btl\b|bot chut|fix|cung duoc|con bot|gia net|gia chot|(?:bot|giam)\s+(?:cho|xiu|it|them|chut)|(?:bot|giam)\s+(?:cho\s+)?nguoi\s+(?:o|thue)(?:\s+lau dai)?)\b/.test(kd) && !CO_TIEN_KD.test(kd)) {
    return { question: "thuong_luong", answer: goc };
  }
  if (/\b(dang o|dang cho thue|de trong|nha trong|con o|dang thue)\b/.test(kd) && !/\b(noi that|ban giao)\b/.test(kd)) return { question: "hien_trang_su_dung", answer: goc };
  const LY_DO_RE = /\b(ly do|dinh cu|ke tien|can tien|doi nha|chuyen cho|di nuoc ngoai|chia tai san)\b/;
  if (LY_DO_RE.test(kd)) return { question: "ly_do_ban", answer: manhKhop(LY_DO_RE) };
  if (/\b(truong hoc|truong tieu hoc|cong chung|phong gym|gym|gan cho\b|cho gan\b|sieu thi|benh vien gan)\b/.test(kd)) return { question: "tien_ich_gan", answer: goc };
  if (/\b(can goc|lo goc)\b/.test(kd)) return { question: "can_goc", answer: goc };
  if (/\bthang may\b/.test(kd)) return { question: "thang_may", answer: goc };
  if (/\bview\b/.test(kd)) return { question: "view", answer: goc };
  if (/\b(pccc|phong chay)\b/.test(kd)) return { question: "pccc", answer: goc };
  if ((m = /\b(\d{1,3})\s*(?:phong|can)\s*(?:cho thue|dich vu|khach)\b/.exec(kd))) return { question: "so_phong", answer: m[1] };
  // 24/09/2026 (bắn 10 tin): "toà nhà CHDV 20 phòng" — số phòng cho thuê (không phải phòng ngủ), bot từng hỏi lại.
  if ((m = /\b(?:chdv|can ho dich vu|toa nha|nha tro|day tro)\b[^,.;]{0,12}?\b(\d{1,3})\s*phong\b(?!\s*(?:ngu|wc|tam|ve sinh))/.exec(kd))) return { question: "so_phong", answer: m[1] };
  if ((m = /\b(?:lap day|kin phong|full phong)\s*(?:khoang|tam)?\s*(\d{1,3})\s*%/.exec(kd)) || (m = /(\d{1,3})\s*%\s*(?:lap day|kin phong)/.exec(kd))) return { question: "ty_le_lap_day", answer: `${m[1]}%` };
  if (/\bdoanh thu\b|\bthu ve\b.*\bthang\b|\bdong tien\b/.test(kd)) return { question: "doanh_thu", answer: goc };
  if ((m = new RegExp(`\\b(?:cao|thong thuy|chieu cao)\\s*(?:khoang|tam)?\\s*${SO}\\s*(?:m|met)\\b`).exec(kd)) &&
    // 24/09/2026 (bắn 10 tin, kho xưởng): mảnh "cao 10m" tách khỏi câu rao (hay "cao 10m như anh nói rồi") không còn chữ
    // kho / xưởng đi kèm → rơi vào "📝 Thêm", bot hỏi lại thông thủy. Mảnh MỞ ĐẦU bằng "cao / chiều cao" thì nhận luôn.
    (/\b(xuong|kho|thong thuy|tran|tai trong|bien ap|kva|container|pccc)\b/.test(kd) || /^(?:chieu\s+)?cao\s*\d/.test(kd.trim()))) return { question: "chieu_cao", answer: `${m[1]}m` };
  if ((m = new RegExp(`\\b(?:tai trong)\\s*(?:san)?\\s*(?:khoang|tam)?\\s*${SO}\\s*(?:tan|t)\\b`).exec(kd))) return { question: "tai_trong_san", answer: `${m[1]} tấn/m2` };
  if ((m = new RegExp(`${SO}\\s*kva\\b`).exec(kd)) || (m = new RegExp(`\\b(?:tram|bien ap|dien)\\s*(?:khoang|tam)?\\s*${SO}\\s*kva`).exec(kd))) return { question: "tram_bien_ap", answer: `${m[1]} kVA` };
  if (/\b(nuoc thai|xu ly nuoc)\b/.test(kd)) return { question: "xu_ly_nuoc_thai", answer: goc };
  if (/\b(container|cont\b|xe cong)\b/.test(kd)) return { question: "duong_container", answer: goc };
  if (/\b(len tho cu|len tho|chuyen tho cu|chuyen muc dich)\b/.test(kd)) return { question: "len_tho_cu", answer: goc };
  if (/\b(kenh|muong|tuoi tieu|nguon nuoc|gieng)\b/.test(kd)) return { question: "nguon_nuoc", answer: goc };
  if (/\b(cam coc|rao luoi|ranh gioi|ranh dat)\b/.test(kd)) return { question: "ranh_gioi", answer: goc };
  // "đất thuê nhà nước TỚI 2058" có mốc năm → thời hạn sử dụng; không có năm → hình thức thuê đất.
  if (/\b(toi|den|het|thoi han)\s*(?:nam\s*)?20\d\d\b/.test(kd) && /\b(thue|so huu|su dung|thoi han)\b/.test(kd)) return { question: "thoi_han_su_dung", answer: goc };
  if (/\b(tra (?:tien )?(?:thue dat )?(?:mot lan|hang nam|tung nam)|thue dat (?:hang nam|mot lan|nha nuoc)|dat thue)\b/.test(kd)) return { question: "hinh_thuc_thue_dat", answer: goc };
  if (/\b(lau dai|so huu lau dai|den nam 20\d\d|thoi han su dung|50 nam)\b/.test(kd) && !/\b(bot|giam|nguoi o|khach o|o lau dai)\b/.test(kd)) return { question: /\b(can ho|chung cu)\b/.test(kd) ? "so_huu" : "thoi_han_su_dung", answer: goc };
  if (/\b(mat do xay dung|mat do xd)\b/.test(kd)) return { question: "mat_do_xd", answer: goc };
  if (/\b(vuong vuc|bop hau|thop hau|meo|hinh dang)\b/.test(kd)) return { question: "hinh_dang", answer: goc };
  if (new RegExp(`\\bfit.?out\\s*(?:khoang|tam)?\\s*${SO}\\s*(?:ngay|thang|tuan)`).test(kd) || new RegExp(`\\b(?:mien phi|free)\\s*${SO}\\s*(?:ngay|thang|tuan)\\s*(?:sua|sua chua|setup|lam noi that)`).test(kd)) return { question: "fit_out", answer: goc };
  // 10/09 lần 7: "Anh đầu tư mua nhà cũ sửa lại bán, giờ có căn…" là chủ nhà KỂ VỀ
  // MÌNH (nghề của họ), không phải tiềm năng của căn — trước bản này nó vào bản nháp
  // thành "💡 Phù hợp: Anh đầu tư mua nhà cũ sửa lại bán". Câu mở bằng đại từ + nghề
  // thì hai luật cuối (muc_dich, tiem_nang) bỏ qua.
  const keVeMinh = /^(?:anh|chi|em|toi|minh|ba|chu|ong|co)\b[^,.]{0,20}\b(?:dau tu|chuyen|lam nghe|moi gioi|mua ban|buon|co nghe)\b/.test(kd);
  if (/\b(showroom|van phong cong ty|lam xuong|truong hoc|benh vien|nha hang)\b/.test(kd) && /\b(hop|phu hop|lam|mo)\b/.test(kd) && !keVeMinh) return { question: "muc_dich", answer: goc };
  // FR-186: đất — hạ tầng (cột điện, hố ga), xây tự do / theo mẫu; biệt thự — compound.
  if (/\b(cot dien|ho ga|tru dien|duong dam)\b/.test(kd)) return { question: "ha_tang", answer: goc };
  if (/\b(xay tu do|theo mau|mau chu dau tu|mau cdt|xay theo)\b/.test(kd)) return { question: "xay_dung", answer: goc };
  if (/\b(compound|biet lap|khu an ninh|bao ve 24)\b/.test(kd)) return { question: "khu_compound", answer: goc };
  if (/\b(quy hoach|lo gioi|giai toa)\b/.test(kd)) return { question: "quy_hoach", answer: goc };
  if (/\b(noi that|ban giao|nha trong|full nt)\b/.test(kd)) return { question: "noi_that", answer: goc };
  if (/\b(de o|cho thue|kinh doanh|mo quan|mo shop|chdv|dau tu|van phong|buon ban)\b/.test(kd) && !keVeMinh && !laViecRao) {
    return { question: "tiem_nang", answer: goc };
  }
  return null;
}

// ── FR-177 a: câu hỏi KẾ TIẾP bám câu chủ nhà vừa nói ────────────────────────
// Nhóm ưu tiên cao nhất còn thiếu quyết định TẬP ứng viên (co_ban trước);
// trong tập đó, chọn câu LIÊN QUAN tới fact vừa ghi (nghe "ngang 5" thì hỏi
// diện tích, nghe "3 lầu" thì hỏi phòng ngủ), không có thì lấy câu đầu.
// Nhóm đọc từ cột `nhom` của view; view cũ không có cột thì tra bảng dưới.
export const NHOM_FACT: Record<string, "co_ban" | "chuyen_mon" | "phu"> = {
  loai_bds: "co_ban", phuong: "co_ban", vi_tri: "co_ban", dien_tich: "co_ban", dien_tich_dat: "co_ban",
  dien_tich_tim_tuong: "co_ban", tho_cu: "co_ban", gia: "co_ban", gap: "co_ban", mat_tien: "co_ban",
  huong: "phu", quy_hoach: "phu", nam_xay: "phu",
};
const LIEN_QUAN: Record<string, string[]> = {
  mat_tien: ["dien_tich_dat", "dien_tich", "dien_tich_tim_tuong", "tho_cu"],
  dien_tich: ["mat_tien", "gia"], dien_tich_dat: ["mat_tien", "tho_cu", "gia"],
  dien_tich_tim_tuong: ["gia"], tho_cu: ["len_tho_cu", "gia"],
  // 10/09: hỏi GẤP ngay sau giá ("mình cần ra hàng gấp hay được giá thì thôi").
  // (gap ở nhóm co_ban priority 10 = câu CUỐI của nhóm cơ bản, tức ngay sau giá theo thứ
  //  tự ưu tiên; không nối gia → gap để địa chỉ/phường còn thiếu vẫn được hỏi trước.)
  gia: ["phuong"], gap: ["do_rong_hem", "do_rong_duong", "ket_cau"], phuong: ["vi_tri", "dien_tich_dat", "dien_tich", "dien_tich_tim_tuong"],
  vi_tri: ["phuong", "do_rong_hem", "dien_tich_dat", "dien_tich"],
  loai_bds: ["phuong"],
  do_rong_hem: ["ket_cau", "mat_tien"], do_rong_duong: ["huong", "ha_tang", "mat_tien"],
  ket_cau: ["so_phong_ngu", "san_vuon", "phap_ly"], tang: ["so_phong_ngu", "huong"], so_phong_ngu: ["huong", "noi_that", "phap_ly"],
  // FR-186 (09/09/2026): chuỗi hỏi giống người cho chung cư / đất / biệt thự / cho thuê.
  huong: ["noi_that", "ha_tang", "phap_ly"], noi_that: ["phap_ly", "tien_coc"],
  ha_tang: ["xay_dung", "phap_ly"], xay_dung: ["phap_ly"],
  san_vuon: ["khu_compound", "do_rong_hem"], khu_compound: ["phap_ly"],
  // FR-223: câu nhánh pháp lý (chỉ có trong danh sách khi re-nhanh.ts thêm vào) đi NGAY sau câu pháp lý.
  phap_ly: ["hoan_cong", "giay_to_hien_co", "du_kien_ra_so", "ban_giao", "dong_so_huu_voi", "dong_y_ban", "tien_coc", "tiem_nang", "hinh_anh"], tiem_nang: ["hinh_anh"],
  hoan_cong: ["hinh_anh"], giay_to_hien_co: ["du_kien_ra_so", "ban_giao"], du_kien_ra_so: ["ban_giao", "hinh_anh"],
  dong_so_huu_voi: ["dong_y_ban"], dong_y_ban: ["hinh_anh"],
  tien_coc: ["thoi_han_thue"], thoi_han_thue: ["truot_gia"], truot_gia: ["hinh_anh"],
  hinh_anh: [],
};
export type CauThieu = { fact_key: string; priority?: number; nhom?: string | null };
export function chonCauKe(vuaNoi: string[], conThieu: CauThieu[]): string | undefined {
  if (!conThieu.length) return undefined;
  const nhom = (c: CauThieu) => c.nhom ?? NHOM_FACT[c.fact_key] ?? "chuyen_mon";
  // Nhóm trước, priority sau (10/09: `gap` co_ban priority 10 hoà `do_rong_hem`
  // chuyen_mon 10 — xếp theo priority đơn thuần thì nhóm cơ bản bị chen).
  const bac: Record<string, number> = { co_ban: 0, chuyen_mon: 1, sau_dang: 2, phu: 3 };
  const xep = [...conThieu].sort((a, b) => (bac[nhom(a)] ?? 1) - (bac[nhom(b)] ?? 1) || (a.priority ?? 0) - (b.priority ?? 0));
  const dau = xep[0];
  const ungVien = xep.filter((c) => nhom(c) === nhom(dau));
  // FR-219 (24/09/2026, chủ dự án chọn "hỏi theo thứ chủ nhà dễ trả lời … ko fix cứng"): câu liên quan vẫn được
  // chen lên, nhưng KHÔNG vượt dải — vật lý (<12) → tiền (12–15) → pháp lý (16) → phường, gấp, ảnh (17+). Nghe
  // "diện tích" thì hỏi mặt tiền / kết cấu được, không kéo GIÁ lên trước kết cấu, phòng ngủ, hẻm.
  const dai = (p?: number) => p == null ? 0 : p < 12 ? 0 : p < 16 ? 1 : p < 17 ? 2 : 3;
  for (const k of [...vuaNoi].reverse()) {
    for (const lq of LIEN_QUAN[k] ?? []) {
      const c = ungVien.find((u) => u.fact_key === lq);
      if (c && dai(c.priority) <= dai(dau.priority)) return lq;
    }
  }
  return dau.fact_key;
}

// ── FR-177 c: chủ nhà GẬT bản nháp? (AGREE_RULES, bản tiền định) ─────────────
// Gật = câu chỉ gồm từ đồng ý + tiểu từ, không có từ phủ định/sửa; hoặc emoji
// vui, like, tim. "ok nhưng sửa giá" là KHÔNG gật — sửa đi trước.
const TU_GAT = new Set(["da","vang","ok","oke","okie","okay","u","uh","um","duoc","dc","chuan","dung","dong","y","chot","len","dang","vay","tot","hay","dep","on","nhat","tri","xin","cam","on","yes","yep"]);
// 21/09/2026 (bắn thật kiem-cc2, chủ nhà là chú): "ok đăng đi cháu" KHÔNG gật vì bộ đệm chỉ có anh/chị/em —
// lời gật thành "thông tin bổ sung" và bản nháp gửi lại. Thêm cách xưng lớn tuổi (FR-176): cháu, chú, cô, bác, con.
const TU_DEM = new Set(["nha","nhe","nhen","em","e","a","roi","do","day","luon","di","thoi","ha","rat","qua","lam","cu","the","nhu","tin","vay","cho","chi","anh","minh","toi","ne","het","cai","nay","ma","chau","chu","co","bac","con","ong","ba"]);
const EMOJI_VUI = /(👍|❤️|❤|😍|🥰|😊|🙂|👌|🔥|💯|\[sticker|\[khach tha tim|\[thả tim|\[like)/;
export function laDongY(text: string): boolean {
  const goc = text.trim();
  if (!goc) return false;
  if (EMOJI_VUI.test(goc)) return true;
  const kd = boDau(goc).replace(/[^a-z0-9\s]/g, " ").trim();
  if (!kd) return false;
  if (/\b(khong|ko|k|chua|sua|doi|sai|nham|bo|them|thieu|nhung)\b/.test(kd)) return false;
  const tu = kd.split(/\s+/);
  return tu.every((w) => TU_GAT.has(w) || TU_DEM.has(w)) && tu.some((w) => TU_GAT.has(w));
}

// ── "Đủ rồi" — FR-177 g ───────────────────────────────────────────────────────
// Chủ dự án 09/09/2026: "điểm đầy đủ thì chỉ khách nói là đã đầy đủ tin rồi" —
// bot hỏi bù dần trong vài ngày, nhưng chủ nhà bảo "đủ rồi / vậy thôi / đừng
// hỏi nữa" thì NGỪNG hỏi. Điểm KHÔNG nhảy lên 100: nó vẫn đo theo dữ liệu thật,
// chỉ có vòng hỏi dừng lại (`listings.chu_noi_du_at`).
// Không phải "đủ rồi": "chưa đủ", "đủ 3 lầu" (số đi kèm là dữ liệu), "còn nữa".
const DU_ROI_RE =
  /\b(?:(?:vay|the|nhieu do|bay nhieu|nhu vay|nhu the|chi vay|toi day|toi do)\s*(?:la\s*)?(?:du|thoi|het)\b|(?:thong tin\s*)?(?:day\s*)?du\s*(?:thong tin\s*)?roi\b|het roi\b|khong con gi(?: nua| khac)?\b|(?:dung|khoi|thoi)\s*hoi\s*(?:nua|them)?\b|(?:chi|nhieu do|bay nhieu|vay)\s*thoi\b)/;
export function laDuRoi(text: string): boolean {
  const kd = boDau(text).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!kd) return false;
  // "chưa đủ", "còn nữa", "thiếu", "bổ sung thêm" là NGƯỢC lại.
  if (/\b(chua|con nua|thieu|bo sung|them cai|them cho)\b/.test(kd)) return false;
  // "đủ 3 lầu", "đủ 4 phòng" — số đi sau "đủ" là dữ liệu, không phải kết thúc.
  if (/\bdu\s+\d/.test(kd)) return false;
  return DU_ROI_RE.test(kd);
}

// ── "Gấp" — cột listings.gap ──────────────────────────────────────────────────
// Chủ dự án 09/09/2026: tình trạng gấp hay không cần cột riêng (cùng loại giao
// dịch, vị trí). true khi câu rao / câu chat nói bán gấp, cần tiền, thanh lý
// gấp, bán nhanh; false khi nói rõ "không gấp"; câu không nhắc gì → tầng trên
// giữ null (chưa rõ), không ép false.
export function laGap(text: string): boolean {
  const kd = boDau(text).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!kd) return false;
  if (/\b(khong|ko|k|chua|dau co|chang)\s*(?:can\s*)?gap\b/.test(kd)) return false;
  if (/\bgap\s*(doi|ba|lan|ruoi|\d)/.test(kd)) return false; // "gấp đôi", "gấp 3" là so sánh
  // 12/09/2026 (bắn 20 tin): "gia đình cần tiền nên để lại căn nhà…" bị gắn cờ
  // CẦN BÁN GẤP rồi in thẳng lên tin rao. Cần tiền là LÝ DO bán, không phải hạn
  // chót — chỉ tính gấp khi cùng câu có chữ bán/ra hàng/thanh lý/nhanh.
  if (/\bcan tien\b/.test(kd) && /\bcan tien\b[^.]{0,40}\b(ban|ra hang|thanh ly|nhanh|gap)\b/.test(kd)) return true;
  return /\b(ban|thue|thanh ly|can|ra|di)\s*(?:nha\s*|dat\s*)?gap\b|\bgap\s*(lam|qua|nha|nhe|em|a)?\b|\b(ban|di|ra)\s*nhanh\b/.test(kd);
}

// ── "Bán rồi / ngưng rao" — FR-184 (chat Gemini 21/06, chủ dự án chốt 09/09/2026) ──
// Chủ nhà tự báo: "bán rồi", "đã bán", "có người thuê rồi", "nhận cọc rồi" →
// `ban_roi` (tin sang da_chot); "ngưng bán", "không bán nữa", "rút tin", "để lại
// ở" → `rut` (tin ẩn). Không phải: câu hỏi ("bán rồi hả em?"), phủ định ("chưa
// bán", "vẫn đang bán"), lời rao ("bán nhà 5 tỷ"), hay số liệu ("chốt giá 5 tỷ").
export type NgungRao = "ban_roi" | "rut";
export function laNgungRao(text: string): NgungRao | null {
  const goc = text.trim();
  if (!goc || /\?/.test(goc)) return null;
  const kd = boDau(goc).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!kd) return null;
  // Phủ định / còn bán / câu hỏi tình trạng → không phải lời báo ngưng.
  if (/\b(chua|van con|van dang|con ban|con cho thue|chua ai|chua co ai|chua chot|dang ban|dang cho thue|sao roi|the nao|ha|ha em|hong|khong a)\b/.test(kd)) return null;
  // "cho thuê CHỨ không bán" / "bán chứ không cho thuê" là đổi loại giao dịch (15/09), không phải rút tin.
  if (/\bchu\s+(?:khong|ko|k|hong)\s+(?:phai\s+)?(?:ban|cho thue)\b/.test(kd)) return null;
  // "chốt giá 5 tỷ", "bán 5 tỷ rồi" — có số + đơn vị tiền là dữ liệu, không phải báo bán.
  // 15/09: "gia 6ty2 shr … ko ban" — đơn vị dính số ("6ty2") không có biên từ
  // sau "ty" nên cửa này hụt, câu rao không dấu bị hiểu thành RÚT TIN. Đơn vị
  // kết thúc ở chỗ hết chữ cái là đủ, không đòi biên từ.
  if (/\d\s*(ty|ti|toi|trieu|tr|m2)(?![a-z])/.test(kd)) return null;
  // 24/09/2026 (chủ dự án test Zalo): "đã cho thuê là nhà đã hoàn thiện hết rồi em, đăng rao bán đi" → bị hiểu "bán rồi",
  // bot hỏi "mình đã bán căn nào". Lời GIỤC đăng ("đăng / rao bán đi") xét TRƯỚC mọi luật "bán rồi"; và "đã/đang cho thuê"
  // kèm chuyện hợp đồng / ngân hàng / dòng tiền là NHÀ ĐANG CÓ KHÁCH THUÊ (thông tin tin rao), không phải giao dịch xong.
  const giucDangTruoc = !/\bnua\b/.test(kd) && /\b(?:dang|rao)\b[^.]{0,12}\b(?:di|giup|gium|dum|ho|len)\b/.test(kd);
  if (giucDangTruoc) return null;
  const dangCoKhachThue = /\b(?:da|dang)\s*cho thue\b/.test(kd) &&
    /\b(?:hop dong|ngan hang|dong tien|thu nhap|khach thue|moi thang|hoan thien|kinh doanh)\b/.test(kd) &&
    !/\b(?:da ban|ban roi|ban duoc|chot roi|coc roi)\b/.test(kd);
  if (dangCoKhachThue) return null;
  const banRoi =
    /\b(?:da|vua)\s*(?:ban|cho thue|chot|nhan coc|giao dich|co nguoi (?:mua|thue)|sang ten|xong)\b/.test(kd) ||
    /\b(?:ban|cho thue|chot|giao dich|sang ten)\s*(?:duoc|xong|het|nha|dat|can|no)?\s*(?:roi|xong roi|r)\b/.test(kd) ||
    /\b(?:co nguoi|co khach)\s*(?:mua|thue|coc)\s*(?:roi|r)?\b/.test(kd) ||
    /\b(?:nhan|lay|da)\s*coc\s*(?:roi|xong)?\b/.test(kd) ||
    /\bban (?:duoc|xong) roi\b/.test(kd);
  if (banRoi) return "ban_roi";
  // HAI CỬA CHẶN trước khi kết luận "rút tin" — vì kết luận này PHÁ HUỶ: tin
  // sang `an`, mọi câu hỏi treo thành `expired`, nhắc bị huỷ. Bắt 10/09 bằng
  // review: `"thôi đăng đi em"` (chủ nhà GIỤC đăng) và `"không đăng ảnh nữa nha
  // em"` (từ chối gửi ảnh) đều ra `rut` — mồi chỉ cần "thoi|khong" đứng gần
  // "dang". Đúng luật chính file này tự viết ở đầu: thà hỏi lại một câu thừa
  // còn hơn đóng một câu hỏi bằng rác — mà ở đây còn nặng hơn: đóng cả tin rao.
  //
  //  (1) "đăng/rao ĐI, GIÚP, DÙM, LÊN, CHO" là lời GIỤC, không phải lời rút.
  //  (2) tân ngữ là ẢNH/HÌNH/VIDEO thì đó là chuyện gửi ảnh, không phải chuyện
  //      rao tin ("không đăng ảnh nữa", "thôi khỏi gửi hình").
  //
  // Chữ "nua" là dấu hiệu CHẤM DỨT ("không đăng NỮA", "ngưng bán NỮA"), nên khi
  // có nó thì cửa (1) mở ra — không nhầm lời giục được. Cửa (2) chỉ tính khi
  // ảnh/hình đứng NGAY SAU động từ: "anh" trần còn là cách xưng hô, chặn theo
  // chữ trần là giết luôn câu rút tin thật ("anh không bán nữa em ơi").
  const giucDang = !/\bnua\b/.test(kd) &&
    /\b(?:dang|rao|ban|cho thue)\b[^.]{0,12}\b(?:di|giup|gium|dum|ho|len)\b/.test(kd);
  const veAnh = /\b(?:dang|gui|up|chup|them|xoa|bo)\s+(?:anh|hinh|video|clip)\b/.test(kd);
  if (giucDang || veAnh) return null;
  const rut =
    /\b(?:ngung|ngung|dung|thoi|het|khong|ko|k|chua muon)\s*(?:ban|cho thue|rao|dang)\s*(?:nua|nha|em|a|roi)?\b/.test(kd) ||
    /\b(?:rut|go|xoa|huy|bo|dong)\s*(?:tin|bai|dang|ky gui|rao|ho so)\b/.test(kd) ||
    /\b(?:de lai|giu lai)\s*(?:o|xai|dung|cho thue|nha|can)?\b/.test(kd) && /\b(khong|ko|thoi|ngung)\b/.test(kd) ||
    /\bkhong (?:ban|cho thue|rao) nua\b/.test(kd);
  return rut ? "rut" : null;
}

// Nhiều căn đang rao → chủ nhà chỉ căn nào? Nhận SỐ THỨ TỰ ("1", "căn 2", "cái
// thứ 2", "số 1") hoặc ĐỊA CHỈ (chữ ≥ 4 ký tự trong location_raw / số phường
// khớp câu). Không rõ → null, tầng trên hỏi lại.
export type CanChon = { id: string; location_raw?: string | null; ward?: string | null; code?: string | null; property_type?: string | null };
// Generic: trả về ĐÚNG kiểu người gọi đưa vào. Bản cũ trả `CanChon` hẹp nên
// chat-reply đọc `chon.deal` ra TS2339 dù lúc chạy trường đó có thật (bật kiểm
// kiểu bot 11/09).
export function chonCanTheoCau<T extends CanChon>(text: string, cans: T[]): T | null {
  if (!cans.length) return null;
  const kd = boDau(text).replace(/[^a-z0-9\s/]/g, " ").replace(/\s+/g, " ").trim();
  if (!kd) return null;
  if (cans.length === 1) return cans[0];
  const stt = /^(?:can|cai|so|thu|tin)?\s*(?:thu\s*)?(\d{1,2})\b\s*(?:nha|nhe|em|do|a)?$/.exec(kd) ||
    /\b(?:can|cai|tin|so)\s*(?:thu\s*)?(\d{1,2})\b/.exec(kd);
  if (stt) {
    const i = Number(stt[1]) - 1;
    if (i >= 0 && i < cans.length) return cans[i];
  }
  if (/\b(dau|dau tien|thu nhat|1st)\b/.test(kd)) return cans[0];
  if (/\b(cuoi|sau cung|con lai)\b/.test(kd)) return cans[cans.length - 1];
  // 22/09/2026 (kịch bản E): "rao lại căn chung cư đi" — chỉ MỘT căn là chung cư thì là căn đó.
  const loaiKd = /\b(?:chung cu|can ho|cc)\b/.test(kd) ? "chung_cu" : /\b(?:nha pho|nha hem|nha mat tien)\b/.test(kd) ? "nha_pho" : /\b(?:lo dat|dat)\b/.test(kd) ? "dat" : null;
  if (loaiKd) {
    const cung = cans.filter((c) => c.property_type === loaiKd);
    if (cung.length === 1) return cung[0];
  }
  let tot: T | null = null, diemTot = 0;
  for (const c of cans) {
    const tu = boDau(c.location_raw ?? "").replace(/[^a-z0-9\s/]/g, " ").split(/\s+/).filter((w) => w.length >= 4 || /^\d+(\/\d+)*$/.test(w) && w.length >= 2);
    let d = tu.filter((w) => kd.includes(w)).length;
    const p = /\bphuong\s*(\d{1,2})\b/.exec(boDau(c.ward ?? ""));
    if (p && new RegExp(`\\b(?:phuong|p)\\s*\\.?\\s*${p[1]}\\b`).test(kd)) d += 1;
    if (c.code && kd.includes(boDau(c.code))) d += 3;
    if (d > diemTot) { diemTot = d; tot = c; }
    else if (d === diemTot && d > 0) tot = null; // hoà → không đoán
  }
  return diemTot > 0 ? tot : null;
}

// ── "Rao lại / mở lại" — 22/09/2026 (kịch bản E) ─────────────────────────────
// Bot hứa "muốn rao lại nhắn em một tiếng là em mở lại liền" nhưng chưa có luật nào nhận.
// "mở lại căn 2", "rao lại căn chung cư đi", "đăng lại tin", "căn đó chưa bán, mở lại giúp".
// Không phải: câu hỏi; "bán lại giá tốt" (không có mở/rao/đăng/lên).
export function laRaoLai(text: string): boolean {
  const goc = (text ?? "").trim();
  if (!goc || /\?/.test(goc)) return false;
  const kd = boDau(goc).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!kd) return false;
  return /\b(?:rao|dang|mo|len|treo)\s+(?:tin\s+|can\s+\d\s+|can\s+)?lai\b/.test(kd) ||
    (/\b(?:chua ban|con ban|van con|chua chot|con nguyen|chua co ai)\b/.test(kd) && /\b(?:rao|dang|mo|len)\b/.test(kd));
}

// ── Tầng phụ — FR-220 (24/09/2026) ───────────────────────────────────────────
// Trả lời câu "nhà có tầng lửng, sân thượng hay tầng hầm không" → chen phần CÓ vào kết cấu chữ
// (`floors_text`): lửng sau "trệt", hầm đầu, áp mái / sân thượng cuối. Phủ định tính theo từng mảnh
// (phẩy, "nhưng", "còn"): "không có lửng, có sân thượng" → chỉ sân thượng; "lửng thì có, hầm không" → chỉ lửng.
// "có" trơn / "không có" / kết cấu còn trống → null (fact vẫn ghi, không đoán).
const PHU_DINH_TP = /^(?:khong|ko|k|chua|hong|hok)$/;
const TANG_PHU_RE = /\b(?:gac lung|lung|san thuong|tang ham|ham|ap mai)\b/g;
export function themTangPhu(floorsText: string | null | undefined, floors: number | null | undefined, answer: string): string | null {
  const kd = boDau(answer ?? "").replace(/[^a-z0-9,;.\s]/g, " ");
  if (/\?/.test(answer ?? "")) return null;
  const co = new Set<string>();
  for (const manh of kd.split(/[,;.]|\b(?:nhung|con)\b/)) {
    const tu = manh.trim().split(/\s+/).filter(Boolean);
    if (!tu.length) continue;
    const cau = tu.join(" ");
    const cuoi = tu.filter((t) => !/^(?:a|nha|nhe|em|anh|chi|ha|luon|nua|het|co)$/.test(t));
    const duoiPhuDinh = cuoi.length > 0 && PHU_DINH_TP.test(cuoi[cuoi.length - 1]);
    for (const m of cau.matchAll(TANG_PHU_RE)) {
      const truoc = cau.slice(0, m.index).trim().split(/\s+/).filter(Boolean);
      // Phủ định đứng TRƯỚC ("không có lửng") — "có" sau phủ định vẫn là phủ định.
      const iPd = truoc.map((t) => PHU_DINH_TP.test(t)).lastIndexOf(true);
      const truocPd = iPd >= 0 && !truoc.some((t, i) => i > iPd + 1 && t === "co");
      if (truocPd || duoiPhuDinh) continue;
      co.add(m[0] === "gac lung" ? "lung" : m[0] === "tang ham" ? "ham" : m[0]);
    }
  }
  if (!co.size) return null;
  let kc = (floorsText ?? "").normalize("NFC").trim();
  if (!kc && floors != null && floors >= 1) kc = floors === 1 ? "trệt" : `trệt + ${floors - 1} lầu`;
  if (!kc) return null;
  const kcKd = boDau(kc);
  let doi = false;
  if (co.has("lung") && !/\blung\b/.test(kcKd)) {
    const m = /trệt/iu.exec(kc);
    if (m) {
      const sau = kc.slice(m.index + m[0].length).replace(/^\s*\+?\s*/, "");
      kc = kc.slice(0, m.index + m[0].length) + " + lửng" + (sau ? ` + ${sau}` : "");
    } else kc += " + lửng";
    doi = true;
  }
  if (co.has("ham") && !/\bham\b/.test(kcKd)) { kc = `hầm + ${kc}`; doi = true; }
  if (co.has("ap mai") && !/\bap mai\b/.test(kcKd)) { kc += " + áp mái"; doi = true; }
  if (co.has("san thuong") && !/\bsan thuong\b/.test(kcKd)) { kc += " + sân thượng"; doi = true; }
  return doi ? kc : null;
}
