// van-tra-loi.ts — van TIỀN ĐỊNH đặt SAU lời model, trước khi gửi (13/09/2026).
//
// Lượt bắn 20 tin thật 12/09 cho thấy ba chỗ model nói sai dù câu lệnh đã dặn:
//
//   1. Kho TRỐNG (khối "KHO HIỆN CÓ: (trống)") mà model vẫn đáp "Dạ có em" /
//      "Em đang có vài căn 3 phòng, hẻm xe hơi tầm 7 tỷ". Người mua tin là có
//      hàng, rồi không bao giờ thấy căn nào — lời hứa suông đầu tiên là lời hứa
//      làm mất khách. Câu lệnh đã có "Chỉ dùng listing trong KHO, không bịa";
//      model vẫn bịa, nên chặn bằng code.
//   2. Ghi chú hoàn cảnh người mua bị LẶP: model trả lại cả ghi chú cũ lẫn mới
//      ("mẹ già ở cùng; muốn gần bệnh viện"), hàm gộp chỉ so NGUYÊN chuỗi nên
//      nối thêm cả đoạn → "mẹ già ở cùng; mẹ già ở cùng; muốn gần bệnh viện".
//   3. Code đã gửi bong bóng "Dạ em sửa lại Phường 9 rồi ạ." rồi model mở tin
//      của nó bằng "Dạ em sửa lại 6 tỷ 5 và Phường 9 rồi ạ." — hai lần ghi nhận.
//
// Tầng bóc tách (bot/tests/ranh-gioi.mjs): không model, không RPC.

import { XUNG_HO_LON_TUOI as LON_TUOI } from "./khop-cau-tra-loi.ts";

const boDau = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

// Câu KHẲNG ĐỊNH đang có hàng. Chỉ sai khi không có căn nào trong tay model —
// tầng trên quyết định lúc nào gọi.
const HUA_CO_HANG: RegExp[] = [
  // "Dạ có em." / "Có ạ!" / "Dạ có chị nha" — cả câu chỉ là chữ "có".
  // 13/09: "Dạ có anh/chị!" lọt vì dấu "/" — cho phép.
  /^(?:da|vang|u|ok|oke)?[\s,]*co(?:\s+(?:em|a|chi|anh|anh\/chi|nha|nhe|luon|lien|san|nhieu|lam))*\s*[.!…]*$/,
  // 13/09: "Dạ em tìm vài căn hẻm xe hơi… cho chị xem nha" — hứa gửi căn chưa có.
  // "em tìm cho (chị) mấy căn 3PN…" — 14/09 bắn lại: chữ "cho" chen giữa làm lọt.
  /\b(?:tim|gui|loc|chon|lua|kiem)\s+(?:(?:ra|duoc|san)\s+)?(?:cho\s+(?:(?:anh\/chi|anh|chi|minh)\s+)?)?(?:vai|mot vai|mot so|may|\d+)\s+can\b/,
  // 14/09 (bắn 16 hội thoại mua): "căn hộ có ban công chúng mình có nhiều",
  // "Em tìm căn khớp 4 người ở quanh trường … rồi".
  /\b(?:ben em|chung minh|chung em|em|minh)\s+(?:dang\s+|van\s+)?co\s+(?:rat\s+)?nhieu\b(?!\s+(?:khach|nguoi))/,
  /\bem\s+(?:da\s+)?(?:tim|kiem|loc)\s+(?:duoc\s+|ra\s+)?(?:can|nha)\b[^.?!]*\broi\b/,
  // 14/09 (bắn lại sau siết): "để em gửi căn cho mình xem luôn ạ" khi kho trống.
  /\b(?:de\s+)?em\s+gui\s+(?:ngay\s+|luon\s+|lien\s+)?(?:can|nha|vai can|may can)\b/,
  // "Dạ được, em ghi nhận lịch chiều thứ 7 cho mình ạ" — nhận hẹn xem khi chưa có căn nào.
  /\b(?:ghi nhan|chot|sap xep|len|dat)\s+(?:lich|gio)\s+(?:xem|chieu|sang|toi|trua|mai|thu|cuoi tuan|\d)/,
  // 14/09: "Chị xem những căn này có hợp không ạ?" khi chưa gửi căn nào.
  /\b(?:nhung|may|cac|mot so)\s+can\s+(?:nay|do|tren|ben duoi|sau day|em vua gui)\b/,
  // "em đang có vài căn…", "bên em hiện có 3 căn", "em có nhà mặt tiền…"
  /\b(?:em|ben em|minh|kho)\s+(?:(?:dang|hien|van|cung|con|da|san)\s+)*co\s+(?:san\s+)?(?:(?:vai|mot vai|mot so|nhieu|may|mot|hai|ba|bon|nam|\d+)\s+)?(?:can|lo|nen|mau|nha|lua chon|san pham)\b/,
  // 14/09 lần 4: "Hiện kho em còn vài căn ở khu đó" — chữ "còn" thay "có". "còn căn nào" (hỏi) không bắt.
  /\b(?:kho|ben em|em)(?:\s+em)?\s+(?:(?:dang|hien|van|cung)\s+)*con\s+(?:(?:vai|mot vai|mot so|nhieu|may|it|\d+)\s+(?:can|lo|nen|nha)|can\s+(?:ho|mat tien|hem|pho|\d))\b(?!\s+nao)/,
  // "có vài căn đúng ý chị", "có 2 lựa chọn"
  /\bco\s+(?:(?:vai|mot vai|mot so|nhieu|may|hai|ba|\d+)\s+)(?:can|lo|nen|lua chon)\b/,
  // "để em xem căn nào phù hợp nhất" — nói như đang cầm sẵn danh sách.
  /\b(?:xem|chon|loc)\s+(?:xem\s+)?(?:trong\s+)?(?:may\s+)?can\s+nao\s+(?:phu hop|hop|ok|dep|ung)/,
  // 20/09/2026 (bắn thật mau-y-C): "để em kiểm tra hẻm 4m Nguyễn Trãi rồi báo liền", "Em kiểm tra kho
  // rồi báo mình liền", "Đang kiểm tra … sắp báo mình liền" — hai lượt né thay vì nói thẳng chưa có.
  // 23/09/2026 (bắn thật): bot xưng "cháu" với khách lớn tuổi — "để cháu tìm … cháu sẽ báo chú liền".
  /\b(?:de\s+)?(?:em|chau)\s+(?:kiem tra|check|xem|tim|loc|ra soat|doi chieu)\b[^.?!]*\b(?:roi|se|sap)?\s*bao\s+(?:lai\s+)?(?:anh\/chi|anh|chi|minh|em|chau|chu|co|bac|lien|ngay|sau|som)\b/,
  // 23/09/2026: "Dạ em tìm kiếm liền ạ", "để em tìm từ từ ạ", "em lọc kho … liền", "để cháu tìm kiếm trong kho".
  /\b(?:de\s+)?(?:em|chau)\s+(?:tim kiem|tim|loc|kiem)\s+(?:(?:lien|ngay|luon|tu tu|trong kho|kho|them)\b|can\s+(?:khop|hop|phu hop))/,
  /\b(?:dang|sap|se)\s+(?:kiem tra|tim|loc|ra soat)\b[^.?!]*\b(?:sap|se|roi)\s+bao\b/,
  // 23/09/2026 (bắn thật, người thuê Q7, kho trống): "Dạ em lọc căn 2PN Quận 7 quanh 15 triệu cho anh nhé :)" — hứa lọc
  // mà không gửi căn nào. Câu HỎI ("em lọc căn cho anh theo khu vực nào ạ?") không bắt.
  /^(?![^?]*\?)[^?]*\b(?:de\s+)?(?:em|chau)\s+(?:se\s+)?(?:tim kiem|tim|loc|kiem|chon)\s+(?:(?:vai|may|mot so)\s+)?(?:can|nha|phong)\b[^.?!]*\bcho\s+(?:anh\/chi|anh|chi|minh|chu|co|bac|ong|ba|di|cau|ban)\b/,
  /\bkiem tra kho\b/,
];

// Khách đang HỎI có hàng không ("có căn nào quận 10 không em", "còn nhà nào
// tầm 5 tỷ không"). Chỉ khi đó một câu "Dạ có em." trơ trọi mới là lời hứa có
// hàng — "có hỗ trợ vay không em" → "Dạ có ạ." là câu trả lời khác hẳn.
export function laHoiCoHang(text: string): boolean {
  const kd = boDau(text);
  return /\b(?:co|con)\s+(?:(?:can|nha|lo|nen|mau|cai|dat)(?:\s+(?:nao|gi))?|(?:vai|may)\s+can)\b.*?(?:\b(?:khong|ko|k|hong|hem|chua)\b|\?|\bnao\b)/.test(kd);
}

export function laHuaCoHang(cau: string, hoiHang = true): boolean {
  const kd = boDau(cau.trim());
  return HUA_CO_HANG.some((re, i) => (i > 0 || hoiHang) && re.test(kd));
}

const tachCau = (s: string): string[] => s.split(/(?<=[.!?…])\s+/).filter((c) => c.trim());

/**
 * Bỏ các câu hứa có hàng; chèn `loiThat` đúng chỗ câu đầu tiên bị bỏ (để "Dạ được
 * chị." đứng trước vẫn tự nhiên). Không có câu nào vi phạm → trả nguyên mảng.
 */
export function chanHuaCoHang(replies: string[], loiThat: string, hoiHang = true): { replies: string[]; daChan: boolean } {
  let daChan = false;
  let daChen = false;
  const ra: string[] = [];
  for (const r of replies) {
    const giu: string[] = [];
    for (const c of tachCau(r)) {
      if (!laHuaCoHang(c, hoiHang)) { giu.push(c); continue; }
      daChan = true;
      if (!daChen) {
        const loi = giu.length || ra.length ? loiThat.charAt(0).toLocaleUpperCase("vi") + loiThat.slice(1) : `Dạ ${loiThat}`;
        giu.push(loi);
        daChen = true;
      }
    }
    const moi = giu.join(" ").trim();
    if (moi) ra.push(moi);
  }
  return daChan ? { replies: ra, daChan } : { replies, daChan };
}

// ── Hiểu nhầm ý khách thì xin lỗi (23/09/2026, FR-218 b) ──────────────────────
// Chủ dự án 23/09: "Nếu mà hiểu nhầm ý khách thì phải xin lỗi". Câu lệnh đã dặn; đây là lưới khi model quên:
// khách nói rõ là bot hiểu / ghi sai mà không bong bóng nào có "xin lỗi" → chèn một câu xin lỗi ngắn trước
// bong bóng lời đầu tiên (sau các dòng máy 🤖 💾 📝). "sai rồi" trần KHÔNG tính — chủ nhà hay tự sửa số của mình.
export const HIEU_NHAM_RE =
  /\b(?:hieu (?:nham|sai|lam|lon|khong dung)|nham y|sai y|(?:khong|ko|k) phai y|(?:khong|ko|k) phai (?:vay|the|nhu vay)(?: dau)?\b|dau co (?:noi|hoi|bao|nhan)|(?:ghi|luu|nghe|doc) (?:nham|sai|lon)|tra loi (?:sai|lac|khong dung|ko dung)|lac de|noi gi vay|y (?:toi|tui|anh|chi|minh|em|chu|co|bac|con) la)\b/;
export function laKhachBaoHieuNham(cau: string): boolean {
  return HIEU_NHAM_RE.test(boDau(cau));
}
export function themXinLoiKhiHieuNham(khach: string, replies: string[], ac?: string | null): string[] {
  if (!laKhachBaoHieuNham(khach)) return replies;
  if (replies.some((r) => /\bxin loi\b/.test(boDau(r)))) return replies;
  const cau = ac && ac !== "mình" ? `Dạ em xin lỗi ${ac}, em hiểu nhầm ạ.` : "Dạ em xin lỗi, em hiểu nhầm ạ.";
  const i = replies.findIndex((r) => !/^\s*(?:🤖|💾|📝|👤)/u.test(r));
  if (i < 0) return [...replies, cau];
  // Câu mở "Dạ …" của bong bóng đó thành phần sau lời xin lỗi — bỏ "Dạ" lặp.
  const sau = replies[i].replace(/^\s*Dạ[,!.]?(?:\s+|$)/, "").trim();
  const ghep = sau ? `${cau} ${sau.charAt(0).toUpperCase()}${sau.slice(1)}` : cau;
  return [...replies.slice(0, i), ghep, ...replies.slice(i + 1)];
}

// ── Không nhận là người thật (13/09/2026) ──────────────────────────────────
// Lượt bắn 13/09: khách "em là người hay máy vậy" → model "Em là người thật,
// không phải máy đâu anh/chị." Câu lệnh dặn "không thuyết minh về AI" và model
// hiểu thành "chối là AI". Nói dối về bản chất trợ lý là không được, dù khách
// thích giọng người thật tới đâu. Câu nào nhận là người / chối là máy thì thay
// bằng câu thật; phần còn lại (câu hỏi quay lại việc) giữ nguyên.
const NHAN_LA_NGUOI: RegExp[] = [
  // 17/09/2026 (Zalo thật): "cháu là người hỗ trợ" — bot xưng cháu và nhận là người "hỗ trợ / tư vấn".
  /\b(?:em|minh|toi|tui|chau)\s+(?:la\s+|dung la\s+)?(?:mot\s+)?(?:nguoi\s+(?:that|ho tro|tu van|phu trach|ban hang)|con nguoi|nguoi\s+binh thuong|nhan vien)\b/,
  /\b(?:khong|ko|chang|dau)\s+(?:phai\s+)?(?:la\s+)?(?:may|bot|robot|chatbot|ai|tri tue nhan tao)\b(?!\s*(?:lanh|giat|bom|nuoc|phat|in|tinh|cung|ca\b|nay|kia|khac|biet|lam))/,
];
export function laNhanLaNguoi(cau: string): boolean {
  const kd = boDau(cau);
  return NHAN_LA_NGUOI.some((re) => re.test(kd));
}
export function chanNhanLaNguoi(replies: string[], ac: string): string[] {
  let daThay = false;
  const ra: string[] = [];
  for (const r of replies) {
    const giu: string[] = [];
    for (const c of tachCau(r)) {
      if (!laNhanLaNguoi(c)) { giu.push(c); continue; }
      if (!daThay) {
        giu.push(`Em là trợ lý AI bên AI Ơi Nhà Đất, việc gì cần người thật thì có anh/chị phụ trách khu vực theo sát ${ac} ạ.`);
        daThay = true;
      }
    }
    const moi = giu.join(" ").trim();
    if (moi) ra.push(moi);
  }
  return daThay ? ra : replies;
}

// ── Hồ sơ người mua: model hay ĐIỀN BỊA (14/09/2026, bắn 16 hội thoại) ──────
// "cần mua gấp trong tháng này, quận bình thạnh tầm 8 tỷ, nhà mặt tiền" → lưu mục
// đích "để ở" (khách không nói); "cuối tuần anh đi xem nhà, rảnh chiều thứ 7" → lưu
// "khi nào cần dọn: chiều thứ 7" (đó là giờ XEM NHÀ); "hỏi hoài vậy, có căn nào thì
// gửi đi" → hoàn cảnh "Khách muốn xem danh sách căn ngay" (thái độ, không phải hoàn
// cảnh); "anh có 2 tỷ, vay thêm được không…" → hoàn cảnh = chép nguyên câu. Câu
// dặn đã ghi "CHỈ ghi điều khách NÓI RÕ. Không suy diễn." mà vẫn lọt, nên chặn bằng
// code ở ba trường hay bịa nhất. Chỉ xét câu khách VỪA nhắn — đó là nguồn duy nhất
// của thứ lưu trong lượt này.
const MUC_DICH_RE = /\b(de o|o gia dinh|cho gia dinh o|dau tu|kinh doanh|buon ban|cho thue lai|cho thue|lam van phong|mo shop|mo quan|dong tien|luot song|an cu)\b/;
const THOI_HAN_RE = /\b(gap|som|don vao|don ve|chuyen vao|chuyen ve|chot|trong thang|thang nay|thang sau|thang toi|tuan nay|tuan sau|cuoi nam|dau nam|nam nay|nam sau|truoc tet|sau tet|khong voi|tu tu|thang \d{1,2})\b/;
const XEM_NHA_RE = /\b(xem nha|coi nha|di xem|qua xem|toi xem|hen xem|ranh)\b/;
const THAI_DO_RE = /\b(khach|nguoi dung)\b|\b(muon xem|hoi hoai|buc|kho chiu|sot ruot|quan tam den|muon hieu|quan trong)\b/;

export function locHoSoMua(profile: Record<string, unknown>, text: string): { profile: Record<string, unknown>; bo: string[] } {
  const kd = boDau(text);
  const ra = { ...profile };
  const bo: string[] = [];
  const xoa = (k: string) => { if (ra[k] != null && ra[k] !== "") { bo.push(k); ra[k] = null; } };
  if (ra.purpose && !MUC_DICH_RE.test(kd)) xoa("purpose");
  if (ra.timeline && (!THOI_HAN_RE.test(kd) || (XEM_NHA_RE.test(kd) && !/\b(don|chuyen|chot|gap)\b/.test(kd)))) xoa("timeline");
  if (typeof ra.notes === "string" && ra.notes) {
    const kn = boDau(ra.notes).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length >= 2);
    const chuKhach = new Set(kd.replace(/[^a-z0-9 ]+/g, " ").split(/\s+/));
    const trung = kn.length ? kn.filter((w) => chuKhach.has(w)).length / kn.length : 0;
    // Chép gần nguyên câu khách (≥ 85% chữ nằm sẵn trong câu, và dài) hoặc là lời tả thái độ.
    if ((kn.length >= 6 && trung >= 0.85) || THAI_DO_RE.test(boDau(ra.notes))) xoa("notes");
  }
  // 24/09/2026 (bắn thật sau #266): "tìm nhà quận 5 tầm 6 tới 7 tỷ, có phòng ngủ dưới trệt…" → model ghi
  // alley "hẻm xe hơi" dù khách không nói chữ nào về đường vào — và từ FR-216 b alley LỌC CỨNG kho (bỏ căn hẻm
  // xe máy). Chỉ giữ khi câu khách có nói tới đường vào.
  if (ra.alley && !/\b(?:hem|hxh|hxm|kiet|ngo|xe hoi|o to|oto|xe tai|xe may|mat tien|mt|mat duong|mat pho|duong truoc|7 cho|4 cho)\b/.test(kd)) xoa("alley");
  return { profile: ra, bo };
}

// ── Bot tự xưng "chúng mình" (14/09) — luật giọng: em xưng "em", bên công ty là "bên em";
// "mình" chỉ để GỌI khách. "căn hộ có ban công chúng mình có nhiều" đọc như khách với bot
// là một phe.
// Kèm: model gõ dính "Emghi nhận…" (lượt bắn 14/09 lần 3) — tách lại khi "em" dính đúng
// một động từ bot hay dùng; không có từ tiếng Việt nào mở bằng "emghi"/"emtìm".
export function suaTuXungMua(s: string): string {
  return s
    .replace(/(^|[\s,.!?])(C|c)húng (mình|tôi|tớ)(?![\p{L}])/gu, (_m, dau, c) => `${dau}${c === "C" ? "Bên" : "bên"} em`)
    .replace(/(^|[^\p{L}])([Ee]m)(ghi|tìm|lọc|gửi|báo|xem|hiểu|cập|kiểm|sẽ|đã|đang)(?![\p{L}])/gu, "$1$2 $3")
    // Lần 4: "…thì bạn cũng bị ảnh hưởng" — bot gọi khách "mình"/anh/chị, không "bạn". Chỉ
    // thay khi "bạn" làm chủ ngữ (sau là động từ / hết câu); "bạn bè", "người bạn" giữ.
    .replace(
      /(^|[\s,.!?])(?<!(?:người|các|những|một|với|cho|của|hai|ba) )([Bb])ạn(?=\s+(?:cũng|sẽ|nên|có|cần|muốn|đang|phải|được|chỉ|không|là|hãy|thấy|đã|vẫn|tìm|mua|thuê|xem|hỏi)(?![\p{L}])|\s*[,.!?]|$)/gu,
      (_m, dau, b) => `${dau}${b === "B" ? "Mình" : "mình"}`,
    );
}

// ── Dò mục đích khi không cần (14/09/2026, bắn 16 hội thoại lần 3) ─────────
// Câu dặn đã ghi "đủ khu vực + giá thì ngừng dò" và "không hỏi người THUÊ về mục đích",
// lượt bắn vẫn còn: thuê căn hộ Q7 15 triệu → "mình cần căn hộ để ở hay để cho thuê lại
// vậy ạ?"; "anh có 2 tỷ… mua nhà 4 tỷ quận 6" → "hẻm hay mặt tiền, để ở hay đầu tư ạ?".
// Chỉ bỏ CÂU HỎI kiểu "để ở hay đầu tư"; câu khác giữ nguyên. Người gọi quyết khi nào áp.
// Lần 4: model đổi chữ — "Mình ở hoặc đầu tư ạ?", "Mình đang tìm mua hay để ở nhà Quận 5 vậy?".
const HOI_MUC_DICH_RE =
  /\b(?:de o|o that|o gia dinh|tu o|o)\b.{0,40}\b(?:hay|hoac)\b.{0,40}\b(?:dau tu|kinh doanh|cho thue lai|cho thue|buon ban)\b|\b(?:dau tu|kinh doanh|cho thue lai|mua|thue)\b.{0,40}\b(?:hay|hoac)\b.{0,20}\b(?:de o|tu o)\b|\bmuc dich\b/;
export function laHoiMucDich(cau: string): boolean {
  return cau.includes("?") && HOI_MUC_DICH_RE.test(boDau(cau));
}
export function boHoiMucDich(replies: string[]): { replies: string[]; daBo: boolean } {
  let daBo = false;
  const ra: string[] = [];
  for (const r of replies) {
    if (/^(📋|💾|🤖|📝)/u.test(r)) { ra.push(r); continue; }
    const cau = tachCau(r);
    const giu = cau.filter((c) => !laHoiMucDich(c));
    if (giu.length !== cau.length) daBo = true;
    const moi = giu.join(" ").trim();
    if (moi) ra.push(moi);
  }
  // Bỏ hết thì thà giữ nguyên còn hơn gửi khách một lượt im lặng.
  if (!daBo || !ra.length) return { replies, daBo: false };
  return { replies: ra, daBo };
}

/**
 * Gộp ghi chú hoàn cảnh theo TỪNG Ý (tách ở ";" và xuống dòng). Ý mới đã nằm
 * trong ý cũ thì bỏ; ý mới bao trùm ý cũ thì thay. Trả null khi không có gì mới.
 */
export function gopGhiChu(cu: string | null | undefined, moi: string | null | undefined, tran = 500): string | null {
  const tach = (s: string | null | undefined, re: RegExp) =>
    String(s ?? "").split(re).map((x) => x.trim().replace(/[.。]+$/, "")).filter(Boolean);
  // Lần 4: "cần gần bệnh viện" ≡ "muốn gần bệnh viện" — bỏ động từ mong muốn khi so.
  const khoa = (s: string) =>
    boDau(s).replace(/[^a-z0-9]+/g, " ").replace(/\b(?:can|muon|thich|uu tien|mong)\b/g, " ").replace(/\s+/g, " ").trim();
  const y = tach(cu, /[;\n]+/);
  let doi = false;
  const timY = (m: string) => {
    const km = khoa(m);
    return y.findIndex((x) => {
      const kx = khoa(x);
      // Ý quá ngắn ("gần chợ") mà so "nằm trong" thì nuốt nhầm ý khác — so bằng.
      if (kx.length < 8 || km.length < 8) return kx === km;
      return kx.includes(km) || km.includes(kx);
    });
  };
  for (const ca of tach(moi, /[;\n]+/)) {
    // Cả cụm không dính ý cũ nào thì mới tách tiếp ở dấu phẩy (14/09 lần 3): cũ "cần gần
    // trường tiểu học Quận 3", mới "4 người ở cùng, cần gần trường tiểu học" — so nguyên
    // cụm thì lưu thành "…Quận 3; 4 người ở cùng, cần gần trường tiểu học".
    const manh = timY(ca) < 0 && /,\s+/.test(ca) ? tach(ca, /,\s+/) : [ca];
    for (const m of manh) {
      if (!khoa(m)) continue;
      const i = timY(m);
      if (i < 0) { y.push(m); doi = true; }
      else if (khoa(m).length > khoa(y[i]).length) { y[i] = m; doi = true; }
    }
  }
  if (!doi) return null;
  return y.join("; ").slice(-tran);
}

/**
 * Câu mở đầu là lời GHI NHẬN CÓ NỘI DUNG ("Dạ em sửa lại 6 tỷ 5…", "Em ghi lại:
 * hẻm xe hơi 4m…"). "Dạ em ghi nhận rồi ạ." trơ trọi KHÔNG tính — bong bóng code
 * nói rõ ghi gì thì phải giữ bong bóng đó.
 */
export function laCauGhiNhan(tin: string): boolean {
  return laCauGhiNhanMot(tin);
}

/**
 * Bỏ các câu ghi nhận CÓ nội dung ("Dạ em ghi 9 tỷ 5, 4 phòng ngủ rồi ạ.") khỏi các
 * bong bóng — dùng khi bong bóng 💾 đã báo đúng thứ đã lưu (FR-207). Không đụng bản
 * nháp (📋), 💾, 📝. Câu đầu bị bỏ mà câu đầu cũ mở bằng "Dạ" thì câu còn lại mở
 * bằng "Dạ" để khỏi cụt lủn. Bong bóng rỗng thì bỏ.
 */
export function boCauGhiNhan(replies: string[]): string[] {
  const ra: string[] = [];
  for (const r of replies) {
    if (/^(📋|💾|🤖|📝)/u.test(r)) { ra.push(r); continue; }
    const cau = tachCau(r);
    // 22/09/2026 (bộ đo giọng B04, chủ dự án chốt): "Dạ em sửa lại giá 7 tỷ 5 rồi ạ" là lời XÁC NHẬN
    // sau câu "à nhầm" của chủ nhà — giữ, dù 🤖 đã in giá mới. Chỉ bỏ lời "ghi/cập nhật" thường.
    const giu = cau.filter((c) => !laCauGhiNhanMot(c) || laCauSuaLai(c));
    if (giu.length === cau.length) { ra.push(r); continue; }
    if (!giu.length) continue;
    let dau = giu[0];
    if (giu[0] !== cau[0] && /^dạ\s/iu.test(cau[0]) && !/^dạ\s/iu.test(dau)) {
      dau = `Dạ ${dau.charAt(0).toLocaleLowerCase("vi")}${dau.slice(1)}`;
    }
    ra.push([dau, ...giu.slice(1)].join(" "));
  }
  return ra;
}

/** "Dạ em sửa lại …", "Em đổi lại …" — lời xác nhận SỬA (khác lời ghi thường). */
function laCauSuaLai(tin: string): boolean {
  return /^(?:da|vang)?[\s,]*(?:(?:anh\/chi|anh|chi|minh)[\s,]+)?(?:em\s+)?(?:da\s+)?(?:sua|doi)\s+lai\b/.test(boDau(tin.trim()));
}

function laCauGhiNhanMot(tin: string): boolean {
  const dau = boDau(tachCau(tin.trim())[0] ?? "");
  // 14/09: "Dạ chị, em ghi lại: …" — cho phép đại từ gọi khách chen giữa "Dạ" và "em".
  // 22/09/2026 (bắn thật sau deploy #182, nhánh mua): "Dạ em đã lưu nhu cầu: mua nhà Quận 5…" lặp sau 🤖
  // "Đã lưu nhu cầu" — thêm động từ "lưu" ("lưu ý" không tính: phần còn lại quá ngắn).
  const m = /^(?:da|vang)?[\s,]*(?:(?:anh\/chi|anh|chi|minh)[\s,]+)?(?:em\s+)?(?:da\s+)?(?:ghi|sua|cap nhat|chinh|luu)(?:\s+(?:lai|nhan|ro|chuan))?\b/.exec(dau);
  if (!m) return false;
  const conLai = dau.slice(m[0].length)
    .replace(/\b(?:roi|xong|duoc|het|luon|vao|tin|cho|lai|a|nha|nhe|anh|chi|em|minh|ha|nghe)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
  return conLai.length >= 3;
}

/**
 * FR-177 (kịch bản sếp: "hỏi đúng MỘT thông tin"). 15/09/2026 (bắn thật): model vẫn
 * thỉnh thoảng hỏi hai câu một lượt ("…tầng mấy ạ? Có sổ hồng chưa ạ?"). Giữ tới hết
 * CÂU HỎI ĐẦU TIÊN, bỏ mọi câu đứng sau nó; bong bóng 📋/💾/📝 không đụng. Chỉ dùng
 * cho phía BÁN — phía mua được phép gộp 2–3 ý (HUMAN_CHAT_RULES).
 */
export function motCauHoi(replies: string[]): string[] {
  return replies.map((r) => {
    if (/^(📋|💾|🤖|📝)/u.test(r)) return r;
    const cau = tachCau(r);
    const i = cau.findIndex((c) => /\?\s*$/.test(c));
    if (i < 0 || i === cau.length - 1) return r;
    return cau.slice(0, i + 1).join(" ");
  });
}

/**
 * Câu hỏi ngược có ĐÁP ÁN CỦA HỆ THỐNG (15/09/2026, bắn thật F2): "bên bạn có cần mình
 * gửi hình không hay sao" — model được dặn trả lời trước mà vẫn bỏ qua, chỉ hỏi phường.
 * Chuyện gửi ảnh là luật của mình (FR-185: gửi vào chat là vào kho), nên trả lời tiền
 * định, không trông vào model. Không nhận ra thì null → model tự trả lời như cũ.
 */
export function dapHoiNguocTienDinh(hoi: string, ac: string, phi?: string | null): string | null {
  const kd = boDau(hoi);
  const ra: string[] = [];
  // "bên em là bot hả?" / "người thật hay máy?" — nói thật, một câu (TONE).
  if (/\b(bot|may|robot|ai|tu dong|nguoi that|nguoi hay may)\b/.test(kd) && /\b(la|phai|hay|ha|khong|ko|a|dung)\b/.test(kd) && !/\b(may lanh|may giat|may nuoc|may bom)\b/.test(kd)) {
    ra.push("Dạ em là trợ lý AI bên AI Ơi Nhà Đất, việc cần người thật thì có anh chị phụ trách theo sát mình ạ.");
  }
  // "phí sao?" — theo luật phí, hệ thống biết nhãn chính chủ / môi giới.
  if (phi && /\b(phi|hoa hong|hoa hong|phan tram|bao nhieu %|mat tien gi|ton gi|tinh sao)\b/.test(kd) && !/\bphi quan ly\b/.test(kd)) {
    ra.push(`Dạ ${phi} ạ.`);
  }
  if (/\b(anh|hinh|video|clip)\b/.test(kd) && /\b(gui|can|co|chup|up|dang|them)\b/.test(kd) && !/\b(tien|phi|gia|ty|trieu)\b/.test(kd)) {
    ra.push(`Dạ ${ac} gửi ảnh thẳng vào đây là em cất vào tin luôn ạ.`);
  }
  return ra.length ? ra.join(" ") : null;
}

/**
 * Model TRẢ LỜI CÂU LỆNH thay vì trả lời khách (15/09/2026, bắn thật P2 — Groq): "Em hiểu
 * rồi ạ. Em là Kh•ai… Khi chủ nhà hỏi ngược, em trả lời câu đó TRƯỚC… Sẵn sàng nhận hội
 * thoại." Tin gửi chủ nhà không bao giờ nói về "chủ nhà" ở ngôi thứ ba hay nhắc số từ.
 */
export function laLoiMeta(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  const kd = boDau(t);
  if (/\b(san sang nhan|em hieu roi a|cau hoi cuoi (?:tin )?(?:la|bat buoc)|\d+\s*[–-]\s*\d+ tu\b|khuon cau|theo luat phi|huong dan he thong|cau lenh|hoi thoai\b.*\bcho chu nha|ngoi thu|system prompt)\b/.test(kd)) return true;
  // Nói về "chủ nhà"/"khách" ở ngôi thứ ba kèm động từ chỉ đạo → đang đọc lại lời dặn.
  return /\b(chu nha|khach)\b/.test(kd) && /\b(hoi nguoc|tra loi truoc|mot tin duy nhat|viet mot tin|khong lap)\b/.test(kd);
}


// ── Tự xưng theo khách (16/09/2026, Zalo thật) ───────────────────────────────
// Khách xưng "chú" ("Chào cháu chú có căn nhà này cần giao bán") mà bot đáp "Dạ em…".
// Mọi câu tiền định lẫn câu model đều viết "em"; đổi ở MỘT chỗ trên đường ra thay
// vì sửa hơn 60 chuỗi. Chỉ đổi chữ "em" đứng riêng (không đụng "em gái", "kem",
// "xem"); "tụi em / bên em" → "tụi cháu / bên cháu" là đúng ý. Khách anh/chị → giữ nguyên.
const EM_RIENG = /(?<![\p{L}])(em|Em|EM)(?![\p{L}])/gu;
export function doiTuXung(replies: string[], xungHo: string | null | undefined, nhomTuoi?: string | null): string[] {
  // 22/09/2026: "chào cháu" chưa rõ chú hay cô (`nhom_tuoi = lon_tuoi`, chưa có `xung_ho`) → vẫn xưng cháu.
  if (!(xungHo && LON_TUOI.has(xungHo)) && nhomTuoi !== "lon_tuoi") return replies;
  return replies.map((r) =>
    r.replace(EM_RIENG, (_m, w: string) => w === "EM" ? "CHÁU" : w === "Em" ? "Cháu" : "cháu")
      // "em gái / em trai" là người thứ ba — trả lại.
      .replace(/cháu (gái|trai|bé|út)\b/g, "em $1")
  );
}

// ── 18/09/2026 (chủ dự án: "tắt cái mỗi câu trả lời đều khen đi, lâu lâu thì khen thôi") ──
/** Câu có dáng lời KHEN / nhận xét căn nhà (tiền định, so trên chữ có dấu lẫn không dấu). */
export const KHEN_RE =
  /\b(?:rất|lắm|tiện(?! ích)|ổn định|sáng sủa|đẹp|thích|chốt nhanh|hợp lý|thuận tiện|hút khách|dễ bán|chuộng|được giá|tốt|mạnh|ngon|lý tưởng|đáng giá|khách (?:hỏi|tìm|ưa)|rat|lam|sang sua|dep|chot nhanh|hop ly|thuan tien|hut khach|de ban|chuong|ly tuong)\b/iu;

/** Ba tin gần nhất của bot có câu khen chưa — có thì lượt này KHÔNG khen nữa ("lâu lâu"). */
export function vuaKhen(botGanDay: Array<string | null | undefined>): boolean {
  return botGanDay.slice(-3).some((b) => KHEN_RE.test(b ?? ""));
}

/**
 * Bỏ câu KHEN khỏi tin bot, giữ câu hỏi và câu ghi nhận. Tách theo dấu chấm / xuống dòng;
 * câu có "?" hoặc không có dáng khen thì giữ. Bỏ hết mà không còn gì thì trả nguyên văn.
 */
export function boCauKhen(reply: string): string {
  const cau = reply.split(/(?<=[.!])\s+|\n+/).map((c) => c.trim()).filter(Boolean);
  const giu = cau.filter((c) => c.includes("?") || !KHEN_RE.test(c));
  if (!giu.length || giu.length === cau.length) return reply;
  return giu.join(" ").replace(/^\s*[,;]\s*/, "").trim();
}

// ── Lời nói VỚI BOT, không phải dữ liệu căn nhà (21/09/2026, chủ dự án "làm cả 4") ──
// Bắn thật: "xóa sạch data của anh đi để anh test lại" lúc duyệt → nguyên câu vào `bo_sung` rồi gửi
// lại nháp; "ok em đăng đi, mà cái dòng phù hợp đọc kỳ quá" (vế sau) cũng vậy. Câu nói về hệ thống /
// dữ liệu / bản nháp / cách bot hỏi là lời nói với bot: không ghi vào tin, không gửi lại nháp.
export function laNoiVoiBot(text: string): boolean {
  const kd = boDau((text ?? "").trim());
  if (!kd) return false;
  if (/\b(data|du lieu|reset|test|he thong|con bot|bot|may (?:hoi|tra loi)|system)\b/.test(kd)) return true;
  // Nhận xét về câu/dòng/bản nháp/tin nhắn của bot: "cái dòng phù hợp đọc kỳ quá", "bản nháp dài quá".
  return /\b(dong|cau hoi|cau nay|ban nhap|tin nhan|noi dung|chu nay)\b/.test(kd) &&
    /\b(ky qua|ky vay|doc ky|kho hieu|dai qua|ngan qua|lap lai|sai chinh ta|xau|khong hay|thua)\b/.test(kd);
}

/** Khách xin XOÁ/RESET dữ liệu — bot không tự làm được, phải nói thật. */
export function laXinXoaDuLieu(text: string): boolean {
  const kd = boDau((text ?? "").trim());
  // 22/09/2026 (kịch bản E): "xoá căn 1 khỏi hệ thống của tui" cũng là xin xoá dữ liệu.
  return /\b(xoa|reset|don|go)\b/.test(kd) && /\b(data|du lieu|tin|ho so|thong tin|sach|he thong|tai khoan|can \d|can nay|can do|can kia)\b/.test(kd);
}

/**
 * 22/09/2026 (kịch bản E): môi giới "khách nào hỏi thì cho tui số của họ nha" — bot từng gật "Dạ em hiểu anh chị
 * tự liên hệ khách rồi". Người mua bên này KHÔNG để lại số (bất biến DH); mọi liên hệ qua bot và CTV.
 */
export function laXinSoKhach(text: string): boolean {
  const kd = boDau((text ?? "").trim());
  return /\b(?:cho|gui|xin|lay|dua|bao|chuyen)\b[^.?!]{0,25}\b(?:so|sdt|so dien thoai|zalo|lien he|contact|thong tin)\b[^.?!]{0,20}\b(?:khach|ho|nguoi mua|nguoi hoi|nguoi ta|khach hang|ben mua)\b/.test(kd) ||
    /\b(?:so|sdt|zalo|so dien thoai)\s+(?:cua\s+)?(?:khach|ho|nguoi mua|khach hang|ben mua)\b/.test(kd) && /\b(?:cho|gui|xin|lay|dua|bao|chuyen|de)\b/.test(kd);
}

/** Ô của tin mà câu "xoá/bỏ … nhầm" đang nhắc tới; nhãn để đọc lên. */
export const O_XIN_BO: Array<[string, RegExp, string]> = [
  ["do_rong_hem", /\b(?:hem|hxh|ngo|duong vao)\b/, "hẻm"],
  ["gia", /\bgia\b/, "giá"],
  ["phuong", /\bphuong\b|\bp\s*\d{1,2}\b/, "phường"],
  ["dien_tich", /\bdien tich\b|\bm2\b|\bngang\b|\bdai\b/, "diện tích"],
  ["so_phong_ngu", /\bphong ngu\b|\bpn\b/, "số phòng ngủ"],
  ["ket_cau", /\b(?:tang|lau|tret|tam)\b/, "số tầng"],
  ["phap_ly", /\b(?:so hong|so do|phap ly|hoan cong)\b/, "pháp lý"],
  ["huong", /\bhuong\b/, "hướng"],
  ["vi_tri", /\b(?:dia chi|so nha|duong|vi tri)\b/, "địa chỉ"],
];

/**
 * 22/09/2026 (kịch bản C, bắn thật): "em xoá cái hẻm 4m ghi nhầm đi" — chủ nhà xin BỎ một thứ đã ghi,
 * không phải dữ liệu mới. Bản trước đọc thành địa chỉ (street = nguyên câu, tin lên web như thế) và
 * "hẻm 4m" trong câu đè lại hẻm 3.5m vừa sửa. Nhận: động từ xoá/bỏ/gỡ + (nhầm/sai/lộn/dư) hoặc "xoá … đi",
 * KHÔNG phải xin xoá cả dữ liệu (`laXinXoaDuLieu`). Trả ô đang nhắc (null = không đoán ra ô).
 */
export function laXinBoTruong(text: string): { truong: string | null; nhan: string | null } | null {
  const kd = boDau((text ?? "").trim());
  if (!kd || laXinXoaDuLieu(text)) return null;
  // "bỏ qua câu này đi" là xin BỎ QUA câu hỏi (đường hoãn/FR-177 g), không phải bỏ dữ liệu.
  if (/\bbo qua\b/.test(kd)) return null;
  const coXoa = /\b(?:xoa|bo|go|huy|xoa bo)\b/.test(kd);
  if (!coXoa) return null;
  // 22/09/2026 (kịch bản E): "xoá căn 1 khỏi hệ thống đi" từng bị bắt thành "xin bỏ ô" — luật "xoá … đi" quá rộng.
  // Nay: có chữ nhầm/sai, HOẶC nêu rõ một ô kèm lời giục (đi/giúp/dùm). Xoá tin/căn/dữ liệu đi đường `laXinXoaDuLieu`.
  const o0 = O_XIN_BO.find(([, re]) => re.test(kd));
  const coNham = /\b(?:nham|sai|lon|du|thua|ghi lon|ghi nham)\b/.test(kd);
  const coGiuc = /\b(?:di|gium|dum|giup|ho)\b/.test(kd);
  if (!coNham && !(o0 && coGiuc)) return null;
  // "bỏ hẻm 4m, hẻm đúng là 3m5" — có SỐ MỚI kèm thì là lời sửa, đi đường sửa (không phải xin bỏ suông).
  const soMoi = kd.replace(/\b(?:xoa|bo|go|huy)\b[^,;.]*?\b(?:nham|sai|lon|du|thua|di)\b/, "");
  if (/\d/.test(soMoi) && /\b(?:dung la|thuc ra|chu khong|chu ko|thanh|la)\b/.test(soMoi)) return null;
  const o = O_XIN_BO.find(([, re]) => re.test(kd));
  return { truong: o?.[0] ?? null, nhan: o?.[2] ?? null };
}

/**
 * 22/09/2026 (kịch bản C): bong bóng code "Dạ em sửa lại Phường 2 rồi ạ." rồi model "Phường 2 em sửa lại
 * rồi ạ." — câu ngắn dưới ngưỡng `boCauTrung`. Đã có lời sửa tiền định thì bỏ MỌI câu "sửa lại/đổi lại/cập
 * nhật … rồi" của model, dù nó không mở đầu bằng "Dạ em". Không đụng 📋/💾/🤖/📝.
 */
export function boCauSuaLaiModel(replies: string[]): string[] {
  return locCauTrongBongBong(replies, (c) => {
    const kd = boDau(c);
    return /\b(?:sua|doi|cap nhat|chinh)\s+lai\b/.test(kd) && /\b(?:roi|xong)\b/.test(kd) && !/\?/.test(c);
  });
}

/**
 * "anh/chị" có gạch chéo là chữ máy (TONE_RULES cấm model, nhưng câu tiền định vẫn dùng khi chưa biết
 * cách gọi — bắn thật 21/09: "Nhà mình phường mấy anh/chị nhỉ?"). Người bán hàng thật nói "anh chị"
 * (không gạch) khi chưa biết nam hay nữ. Áp ở đường ra, chỉ khi CHƯA biết cách gọi.
 */
export function boGachCheo(s: string): string {
  return (s ?? "").replace(/anh\/chị/g, "anh chị").replace(/Anh\/chị/g, "Anh chị").replace(/ANH\/CHỊ/g, "ANH CHỊ");
}

/**
 * Lọc CÂU trong từng bong bóng theo một luật, GIỮ NGUYÊN xuống dòng: bong bóng 📝/📋 nhiều dòng
 * ("📝 Em ghi nhận: …\nSai chỗ nào … nhắn lại") được tách theo dòng rồi theo câu; dòng nào không
 * mất câu nào thì giữ nguyên chữ gốc. Không bỏ gì thì trả đúng mảng cũ (so `===` được).
 */
function locCauTrongBongBong(replies: string[], bo: (cau: string) => boolean): string[] {
  let daBo = false;
  const ra: string[] = [];
  for (const r of replies) {
    const dongMoi: string[] = [];
    for (const dong of r.split("\n")) {
      const cac = tachCau(dong);
      const giu = cac.filter((c) => !bo(c));
      if (giu.length === cac.length) { dongMoi.push(dong); continue; }
      daBo = true;
      const gop = giu.join(" ").trim();
      if (gop) dongMoi.push(gop);
    }
    const moi = dongMoi.join("\n").trim();
    if (moi) ra.push(moi);
  }
  return daBo ? ra : replies;
}

/**
 * Bỏ câu LẶP giữa các bong bóng (22/09/2026, bộ đo giọng B08): câu tiền định "Dạ em là trợ
 * lý AI…" đứng trước, model đọc lịch sử rồi chép lại gần nguyên văn ở bong bóng sau → chủ
 * nhà đọc hai lần. Câu ≥ 6 từ (bỏ từ đệm) mà ≥ 80% từ đã nằm trong một câu trước đó thì bỏ;
 * câu ngắn ("Dạ.", "Anh ơi?") giữ nguyên vì trùng là chuyện thường.
 */
export function boCauTrung(replies: string[]): string[] {
  // Trùng là trùng Ý, không cần trùng chữ: "Dạ em là trợ lý AI bên AI Ơi Nhà Đất, việc cần người
  // thật thì có anh chị phụ trách theo sát mình ạ" và "Em là trợ lý AI bên AI Ơi Nhà Đất, việc gì
  // cần người thật thì có anh chị phụ trách khu vực theo sát anh ạ" là một câu nói hai lần.
  const DEM = new Set(["da", "a", "nha", "nhe", "em", "anh", "chi", "chu", "co", "bac", "minh", "oi", "la", "thi", "gi", "cung", "voi", "va"]);
  const tuCua = (c: string) => new Set(boDau(c).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t && !DEM.has(t)));
  const daThay: Set<string>[] = [];
  return locCauTrongBongBong(replies, (c) => {
    const tu = tuCua(c);
    if (tu.size < 6) return false;
    const trung = daThay.some((cu) => {
      let chung = 0;
      for (const t of tu) if (cu.has(t)) chung++;
      return chung / Math.min(tu.size, cu.size) >= 0.8;
    });
    if (!trung) daThay.push(tu);
    return trung;
  });
}

/**
 * Bỏ câu KHEN KHÔNG CÓ CĂN CỨ (22/09/2026, bộ đo giọng B01/B15/B16): chủ nhà nói "hẻm 5m"
 * mà bot khẳng định "ô tô vào được", "xuyên thoáng", "nở hậu" khi chủ chưa nói. TONE_RULES
 * cấm khen điều khách không nói nhưng model vẫn lọt → chặn bằng code. Chỉ áp cho câu MODEL
 * viết (bản nháp / bảng tiền định đọc từ DB không qua đây). Chỉ bỏ câu KHẲNG ĐỊNH (không có
 * dấu hỏi) mang từ khoá mà `bangChung` (chữ chủ nhà đã gõ, đã bỏ dấu) không có. Câu hỏi
 * ("ô tô vào được không anh?") giữ — hỏi là đúng việc.
 */
const KHEN_CAN_BANG_CHUNG: Array<[RegExp, RegExp]> = [
  [/\b(?:o to|oto|xe hoi|xe oto)\b/, /\b(?:o to|oto|xe hoi|xe oto|xe 4 banh|4 banh|hxh)\b/],
  [/\bxuyen thoang\b/, /\bxuyen thoang\b|\bthoang\b/],
  [/\bno hau\b/, /\bno hau\b/],
  [/\bhoan cong\b/, /\bhoan cong\b/],
  [/\b(?:so hong rieng|so rieng|shr)\b/, /\b(?:so hong rieng|so rieng|shr|so hong)\b/],
];
export function boKhenKhongCanCu(replies: string[], bangChung: string): string[] {
  const bc = boDau(bangChung ?? "");
  return locCauTrongBongBong(replies, (c) => {
    if (/\?/.test(c)) return false;
    const kd = boDau(c);
    return KHEN_CAN_BANG_CHUNG.some(([khen, chung]) => khen.test(kd) && !chung.test(bc));
  });
}

// ── 23/09/2026 (bắn thật 5 tin bán + 2 mua, chủ dự án "sửa hết 5 lỗi đi") ─────────────────────────────
// Lỗi 4: "Hẻm 2m5 ngang 4m thì nhà mình chốn rất được khách tìm" — khen hẻm XE MÁY (TONE: hẻm 3m là hẻm xe máy,
// đừng khen). Lỗi 5: chủ nói "ô tô đậu ngay trước cửa" → bot "Hẻm 5m ô tô vào tận nhà là khách sẵn sàng cọc nhanh,
// … bán gấp hay …?" — câu có "?" nên lưới cũ (bỏ nguyên câu, chừa câu hỏi) không đụng. Ở đây soi theo MỆNH ĐỀ
// (tách dấu phẩy): mệnh đề không có "?" mà khen sai thì bỏ, phần hỏi giữ.
const KHEN_KD = /\b(?:rat|lam|chuong|duoc khach|khach (?:tim|chuong|thich|hoi|ua|san sang)|hut khach|de ban|chot nhanh|coc nhanh|ly tuong|tuyet|dep)\b/;
function hemNhoTrong(kd: string): boolean {
  if (/\bhem xe may\b/.test(kd)) return true;
  const m = /\bhem\s*(?:rong\s*)?(\d+(?:[.,]\d+)?)\s*m(?:et)?\s*(\d)?(?!\d)/.exec(kd);
  if (!m) return false;
  const rong = Number(m[1].replace(",", ".")) + (m[2] ? Number(m[2]) / 10 : 0);
  return rong > 0 && rong < 3.5;
}
const VAO_NHA_KD = /\b(?:vao tan nha|vao toi nha|vao nha|vao tan cua|vao trong nha|dau trong nha|de xe (?:hoi )?trong nha)\b/;
const VAO_NHA_CHUNG = /\b(?:vao (?:tan |toi |duoc |trong )?nha|trong nha|gara|ga ra|garage|dau trong nha)\b/;
/** Mệnh đề khen không có căn cứ (lời MODEL, không phải bảng đọc từ DB). */
export function laKhenSai(menhDe: string, bangChung: string): boolean {
  if (/\?/.test(menhDe)) return false;
  const kd = boDau(menhDe);
  const bc = boDau(bangChung ?? "");
  if (VAO_NHA_KD.test(kd) && !VAO_NHA_CHUNG.test(bc)) return true;
  if (KHEN_KD.test(kd) && (hemNhoTrong(kd) || (/\bhem\b/.test(kd) && hemNhoTrong(bc) && !/\b(?:mat tien|xe hoi|o to|oto)\b/.test(bc)))) return true;
  return KHEN_CAN_BANG_CHUNG.some(([khen, chung]) => khen.test(kd) && !chung.test(bc));
}
export function boMenhDeKhenSai(replies: string[], bangChung: string): string[] {
  const ra: string[] = [];
  for (const r of replies) {
    const dong = r.split("\n").map((d) => tachCau(d).map((c) => {
      const cacMd = c.split(/,\s+/);
      if (cacMd.length === 1) return laKhenSai(c, bangChung) ? "" : c;
      const giu = cacMd.filter((md) => !laKhenSai(md, bangChung));
      if (giu.length === cacMd.length) return c;
      const gop = giu.join(", ").trim();
      return gop ? gop.charAt(0).toUpperCase() + gop.slice(1) : "";
    }).filter(Boolean).join(" ").trim()).filter(Boolean).join("\n").trim();
    if (dong) ra.push(dong);
  }
  return ra.length ? ra : replies;
}

// Lỗi 3: bot viết "#BDS-NP-Q5-0004 · Hùng Vương …" cho khách MUA — FR-178 (a) cấm đọc mã tin cho khách, mua lẫn
// bán. Mã theo sau là dấu "·"/":"/"-" (liệt kê) thì bỏ mã + dấu; mã đứng trong câu thì thay bằng tên đường của
// căn (kho), không có thì bỏ. Mã vẫn được đọc TRƯỚC khi lọc để ghi quan tâm / hẹn / gửi ảnh (FR-32).
const MA_TIN_KHACH_RE = /(?:#\s?)?\bBDS-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{3,5}\b(\s*[·:\-–]\s*)?/gi;
export function boMaTinKhach(replies: string[], nhanCan: Record<string, string>): string[] {
  return replies.map((r) => {
    if (/^\s*(?:🤖|💾|📝|📋)/u.test(r)) return r;
    return r.replace(MA_TIN_KHACH_RE, (m: string, sep: string | undefined) => {
      if (sep) return "";
      const ma = m.replace(/^#\s?/, "").replace(/[\s·:\-–]+$/, "").trim().toUpperCase();
      return nhanCan[ma] ?? "";
    })
      .replace(/\bcăn\s+căn\b/gi, "căn").replace(/[ \t]{2,}/g, " ").replace(/\s+([,.?!])/g, "$1").trim();
  }).filter(Boolean);
}

/**
 * Bỏ câu MÂU THUẪN với căn đang nói (22/09/2026, bộ đo giọng M06): kho ghi "hẻm 6m" mà bot
 * nói với khách mua "mặt tiền kinh doanh". Chỉ soi hai cặp đối nhau rõ ràng: mặt tiền ↔ hẻm,
 * sổ riêng ↔ sổ chung. Câu hỏi giữ nguyên. Không có dữ liệu bên nào thì không đụng.
 */
export type CanDoiChieu = { access_type?: string | null; alley_width_m?: number | null; legal_status?: string | null; location_raw?: string | null; description?: string | null };
export function boMauThuanCan(replies: string[], can: CanDoiChieu | null | undefined): string[] {
  if (!can) return replies;
  const mo = boDau(`${can.location_raw ?? ""} ${can.description ?? ""}`);
  const laHem = can.access_type != null ? /^hem/.test(can.access_type) : (can.alley_width_m != null || /\bhem\b/.test(mo)) && !/\bmat tien\b/.test(mo);
  const laMatTien = can.access_type != null ? can.access_type === "mat_tien" : /\bmat tien\b/.test(mo) && !/\bhem\b/.test(mo);
  const soRieng = can.legal_status === "so_hong_rieng";
  const soChung = can.legal_status === "so_hong_chung";
  return locCauTrongBongBong(replies, (c) => {
    if (/\?/.test(c)) return false;
    const kd = boDau(c);
    return (laHem && /\bmat tien\b/.test(kd) && !/\bhem\b/.test(kd)) ||
      (laMatTien && /\bhem\b/.test(kd) && !/\bmat tien\b/.test(kd)) ||
      (soRieng && /\bso (?:hong )?chung\b/.test(kd)) ||
      (soChung && /\bso (?:hong )?rieng\b|\bshr\b/.test(kd));
  });
}

/**
 * Gọt TÊN RIÊNG BỊA sau loại tiện ích (22/09/2026, bắn thật sau deploy #181): kho nói "gần chợ Hoà Bình",
 * khách hỏi "gần chợ không", model đáp "gần chợ Hàng Thịt" — tên do model điền vào chỗ trống. Tên viết hoa
 * đứng sau chợ / trường / bệnh viện / công viên / siêu thị / chùa / nhà thờ / bến xe mà không nằm trong
 * `nguCanh` (kho + căn khách nhắc + dự án + lịch sử, đã bỏ dấu) thì bỏ tên, giữ loại: "gần chợ lắm".
 * Tên có trong ngữ cảnh giữ nguyên. Không bỏ gì thì trả đúng mảng cũ.
 */
// 22/09/2026 (FR-114 e): thêm dự án / chung cư / cao ốc — bot kể dự án theo quận từ kho, tên ngoài kho là bịa.
const LOAI_TIEN_ICH = "chợ|trường|bệnh viện|công viên|siêu thị|chùa|nhà thờ|bến xe|trung tâm thương mại|dự án|chung cư|cao ốc|khu dân cư";
export function boTenRiengBia(replies: string[], nguCanh: string): string[] {
  const nc = boDau(nguCanh ?? "").replace(/\s+/g, " ");
  // \p{Lu} chứ không phải [A-ZÀ-Ỹ]: dải À-Ỹ lẫn cả chữ THƯỜNG có dấu (đ, ú…), làm "chợ An Đông đúng" nuốt "đúng".
  // Tên = chữ hoa mở đầu, tới 3 từ nối tiếp (chữ hoa hoặc SỐ: "Sunrise Quận 5", "Tháng 2"); không nuốt dấu cách cuối.
  const re = new RegExp(`\\b(${LOAI_TIEN_ICH})\\s+(\\p{Lu}[\\p{L}\\d]*(?:[\\s.-](?:\\p{Lu}[\\p{L}\\d]*|\\d+)){0,3})`, "gu");
  let daBo = false;
  const ra = replies.map((r) => r.replace(re, (m, loai: string, ten: string) => {
    const t = ten.trim().replace(/[.\-]+$/, "");
    if (!t) return m;
    if (nc.includes(boDau(t).replace(/\s+/g, " "))) return m;
    daBo = true;
    return loai;
  }).replace(/[ \t]{2,}/g, " ").replace(/\s+([,.!?])/g, "$1"));
  return daBo ? ra : replies;
}

// ── 23/09/2026 (bắn 26 tin kịch bản bán/mua, căn Trần Bình Trọng) ──────────────────────────────
/**
 * Dữ kiện BỊA về căn: khách hỏi "nhà hướng gì, có dính quy hoạch không" → model "Dạ căn này hướng Đông, thoáng
 * và sáng lắm ạ. Chưa có quy hoạch gì…" trong khi kho KHÔNG có hai dữ kiện đó. Câu KHẲNG ĐỊNH hướng / quy hoạch /
 * lộ giới / năm xây mà `nguCanh` (kho + căn khách nhắc + dự án — dữ liệu, KHÔNG gồm câu bot cũ) không chứa thì
 * bỏ. Trả nhãn các mục đã bỏ để tầng trên nói thật và mở việc hỏi chủ. Câu hỏi ("?") giữ nguyên.
 */
export function chanBiaDuKien(replies: string[], nguCanh: string): { replies: string[]; bo: string[] } {
  const nc = boDau(nguCanh ?? "").replace(/\s+/g, " ");
  const bo = new Set<string>();
  const coQuyHoach = /\b(?:quy hoach|lo gioi)\b/.test(nc);
  const ra = locCauTrongBongBong(replies, (c) => {
    if (/\?/.test(c)) return false;
    const kd = boDau(c);
    const h = /\bhuong\s+(dong|tay|nam|bac)\b/.exec(kd);
    if (h && !new RegExp(`\\bhuong\\W{0,3}(?:\\w+\\W{0,3})?${h[1]}\\b`).test(nc)) { bo.add("hướng nhà"); return true; }
    if (!coQuyHoach && (
      /\b(?:khong|chua|ko|chang)\s+(?:co\s+|bi\s+|dinh\s+|vuong\s+|nam trong\s+)*(?:quy hoach|lo gioi)\b/.test(kd) ||
      /\b(?:dinh|bi|vuong|nam trong)\s+(?:quy hoach|lo gioi)\b/.test(kd) ||
      /\bquy hoach\s+(?:sach|ro rang|on|chuan|khong)\b/.test(kd)
    )) { bo.add("quy hoạch"); return true; }
    const nx = /\bxay\s+(?:tu\s+)?(?:nam\s+)?(\d{4})\b/.exec(kd);
    if (nx && !nc.includes(nx[1])) { bo.add("năm xây"); return true; }
    return false;
  });
  return { replies: bo.size ? ra : replies, bo: [...bo] };
}

/** Câu hứa gửi hình ngay ("Em gửi hình liền đây", "gửi ảnh anh xem nè"). */
// Kèm lời MỜI xem hình ("Anh xem hình trước nhé?") — căn 0 ảnh thì mời cũng là hứa suông (bắn lại sau #193).
const HUA_GUI_HINH_RE = /\b(?:(?:em|chau|de em|de chau)\s+(?:se\s+)?gui\s+(?:ngay\s+|lien\s+|luon\s+)?(?:hinh|anh)|gui\s+(?:hinh|anh)\s+(?:lien|ngay|luon|ne|nha|lien day|ngay day)|(?:xem|coi)\s+(?:hinh|anh)\s+(?:truoc|khong|ko|nhe|nha|ne|luon|thu)\b[^.!]*\?|(?:muon|co muon)\s+(?:xem|coi)\s+(?:hinh|anh)\b[^.!]*\?)/;
export function laHuaGuiHinh(cau: string): boolean {
  return HUA_GUI_HINH_RE.test(boDau(cau));
}
/**
 * Căn chưa có tấm hình nào mà bot hứa "em gửi hình liền đây" (bắn thật 23/09: tin 0 ảnh, hai khách nghe hứa).
 * Câu hứa thay bằng `loiThat` (một lần); không câu nào hứa thì trả đúng mảng cũ.
 */
export function chanHuaGuiHinh(replies: string[], loiThat: string): string[] {
  const ra = locCauTrongBongBong(replies, (c) => laHuaGuiHinh(c));
  if (ra === replies) return replies;
  // Lời thật đứng ở chỗ bong bóng đầu tiên có câu hứa.
  const i = replies.findIndex((r) => tachCau(r).some((c) => laHuaGuiHinh(c)));
  const out = [...ra];
  out.splice(Math.min(Math.max(i, 0), out.length), 0, loiThat);
  return out;
}

/** Câu hứa đi HỎI CHỦ NHÀ ("để em hỏi lại chủ nhà rồi báo", "em xác nhận lại với chủ"). */
export function laHuaHoiChu(replies: string[]): boolean {
  return /\b(?:hoi|xac nhan|check|kiem tra)\s+(?:lai\s+)?(?:voi\s+|ben\s+|y\s+)?chu(?:\s+nha)?\b/.test(boDau(replies.join(" ")));
}

/**
 * Bot tự xưng bằng từ gọi KHÁCH (bắn thật 23/09): khách là chú, model đáp "Dạ, chú ghi nhớ rồi ạ" — đúng ra
 * "cháu ghi nhớ". Chỉ sửa khi chú/cô/bác đứng ngay trước động từ tự thuật của bot (ghi nhớ, ghi nhận, lưu, tìm,
 * báo, gửi…) ở đầu câu hoặc sau "Dạ,"/"để". "chú xem nhà" (khách làm) không đụng: "xem" không nằm trong danh sách.
 */
export function suaBotXungNhamKhach(replies: string[], goi: string | null | undefined): string[] {
  if (!goi || !LON_TUOI.has(goi)) return replies;
  const re = new RegExp(
    `(^|[.!?]\\s+|Dạ,?\\s+|[Đđ]ể\\s+)(${goi}|${goi.charAt(0).toUpperCase()}${goi.slice(1)})\\s+(ghi nhớ|ghi nhận|ghi lại|lưu lại|đã lưu|sẽ tìm|tìm kiếm|tìm|lọc|báo lại|báo|gửi|kiểm tra)(?![\\p{L}])`,
    "gu",
  );
  let doi = false;
  const ra = replies.map((r) => r.replace(re, (_m, dau: string, _x: string, dong: string) => {
    doi = true;
    return `${dau}${dau === "" || /[.!?]\s+$/.test(dau) ? "Cháu" : "cháu"} ${dong}`;
  }));
  return doi ? ra : replies;
}

/**
 * Lời khen NGƯỢC NGHĨA (bắn thật 23/09, nhánh bán): "Căn góc view thoáng khó bán lắm cô" — ý là hiếm, dễ bán.
 * "khó bán lắm" đứng sau một ưu điểm trong cùng câu (không phải câu hỏi) → "khó kiếm lắm".
 */
export function suaKhenNguocNghia(replies: string[]): string[] {
  const re = /((?:góc|view|thoáng|đẹp|rộng|mới|sáng|yên tĩnh|hẻm xe hơi|mặt tiền)[^.!?]{0,40}?)khó bán lắm/giu;
  let doi = false;
  const ra = replies.map((r) => r.replace(re, (_m, truoc: string) => { doi = true; return `${truoc}khó kiếm lắm`; }));
  return doi ? ra : replies;
}

/**
 * Bot đoán PHƯỜNG của một địa danh (bắn thật 23/09): "Dạ chú, chợ An Đông là khu P12 Quận 5 phải không ạ?" —
 * không ai nói P12, dữ liệu không có. Câu gắn địa danh với một số phường mà ngữ cảnh không chứa số phường đó
 * thì bỏ. Trả nhãn địa danh đã bỏ (để tầng trên nói câu ghi nhận thay).
 */
export function boDoanPhuongDiaDanh(replies: string[], nguCanh: string): { replies: string[]; bo: string | null } {
  const nc = boDau(nguCanh ?? "");
  let bo: string | null = null;
  const ra = locCauTrongBongBong(replies, (c) => {
    const kd = boDau(c);
    const m = /\b(cho|truong|benh vien|cong vien|sieu thi|chua|nha tho|ben xe)\s+([a-z]+(?:\s+[a-z]+){0,3}?)\s+(?:la|o|thuoc|nam o|nam)\s+(?:khu\s+|khu vuc\s+)?(?:p\.?\s*|phuong\s+)(\d{1,2})\b/.exec(kd);
    if (!m) return false;
    if (new RegExp(`\\b(?:p\\.?\\s*|phuong\\s+)0?${Number(m[3])}\\b`).test(nc)) return false;
    bo = `${m[1]} ${m[2]}`;
    return true;
  });
  return bo ? { replies: ra, bo } : { replies, bo: null };
}

/**
 * Câu hỏi VỌNG LẠI câu khách (bắn thật 23/09): khách "mai 9h sáng em qua xem được không" → bot hỏi ngược "Mai 9h
 * sáng có được không?". Câu hỏi ≥ 4 từ mà ≥ 80% từ đã có trong câu khách thì bỏ — chỉ khi còn câu khác để gửi.
 */
export function boCauVongLai(replies: string[], text: string): string[] {
  const tuKhach = new Set(boDau(text).split(/[^a-z0-9]+/).filter(Boolean));
  const ra = locCauTrongBongBong(replies, (c) => {
    if (!/\?\s*$/.test(c.trim())) return false;
    const tu = boDau(c).split(/[^a-z0-9]+/).filter(Boolean).filter((w) => !["da", "a", "nha", "nhe", "vay"].includes(w));
    if (tu.length < 4) return false;
    return tu.filter((w) => tuKhach.has(w)).length / tu.length >= 0.8;
  });
  return ra.length ? ra : replies;
}

/**
 * Căn BỊA khi kho trống (bắn lại 23/09 sau deploy #193): kho lọc theo "gần chợ An Đông" ra rỗng, model vẫn tả
 * "căn này hẻm xe hơi 4m P12, 50m2, 7,9 tỷ — gần chợ chỉ khoảng 600m". Tầng trên chỉ gọi khi KHÔNG có căn nào
 * trong tay model. Câu tả một căn cụ thể = có số tiền cụ thể (7,9 tỷ / 8 tỷ 2) hoặc diện tích (50m2) + chữ căn/nhà/
 * hẻm/phường, và KHÔNG phải câu nhắc tiêu chí khách ("tầm/khoảng/dưới/lọc/tìm"). Bỏ CẢ BONG BÓNG chứa câu đó
 * (câu hỏi "Chú có quan tâm không ạ?" đi kèm cũng thành vô nghĩa).
 */
export function boCanBia(replies: string[]): string[] {
  const laCanBia = (c: string): boolean => {
    // Câu nêu MÃ TIN thật ("#BDS-Q5-0006") là căn lấy từ lượt trước (căn tương tự, căn đã gợi) — không phải bịa.
    if (/#?\b[A-Z]{2,5}(?:-[A-Z0-9]{1,15}){1,4}\b/.test(c)) return false;
    const kd = boDau(c);
    // Câu nhắc TIÊU CHÍ khách: "tầm/khoảng/dưới/trên" đứng NGAY trước số tiền, hoặc lời lọc/tìm/chưa có.
    if (/\b(?:tam|khoang|duoi|tren|tu)\s+\d+(?:[.,]\d+)?\s*(?:ty|ti|trieu)\b|\b(?:do lai|loc|tim|nhu cau|tieu chi|chua co)\b/.test(kd)) return false;
    const coGia = /\b\d+(?:[.,]\d+)?\s*(?:ty|ti)(?:\s*\d{1,3})?\b/.test(kd);
    const coDt = /\b\d{2,4}(?:[.,]\d+)?\s*m2\b/.test(kd);
    return (coGia || coDt) && /\b(?:can|nha|hem|p\s*\d{1,2}|phuong)\b/.test(kd);
  };
  const ra = replies.filter((r) => !tachCau(r).some(laCanBia));
  return ra.length === replies.length ? replies : ra;
}

/**
 * FR-214 (e), 23/09/2026 (Zalo chủ dự án): "15 tỉ nhé cháu còn nhà ở quận 11 cũ muốn 7 tỉ" → model đáp "Dạ cháu
 * ghi 15 tỷ căn Long An, 7 tỷ căn Quận 11 rồi cô" trong khi con số 7 tỷ không được ghi vào đâu. Câu NÓI ĐÃ GHI
 * (ghi / lưu / cập nhật / sửa) kèm số tiền mà số đó không khớp (±1%) giá nào trong `tienCo` (giá các tin của
 * người này, đọc lại DB sau khi ghi) thì bỏ. Dòng 🤖/📝/📋 (tiền định) không đụng. Không bỏ gì → mảng cũ.
 */
export function boCauGhiTienKhongCo(replies: string[], tienCo: number[], docTienFn: (s: string) => number | null): string[] {
  const TIEN_RE = /\d+(?:[.,]\d+)?\s*(?:tỷ|tỉ|ty|ti|tỏi|triệu|trieu|tr)(?![\p{L}])(?:\s*\d{1,3}(?![\d.,]|\s*m))?/giu;
  const ra = locCauTrongBongBong(replies, (c) => {
    if (/^[🤖📝📋💾]/u.test(c.trim())) return false;
    if (!/\b(?:ghi|luu|cap nhat|sua)\b/.test(boDau(c))) return false;
    const so = [...c.matchAll(TIEN_RE)].map((m) => docTienFn(m[0])).filter((v): v is number => v != null && v > 0);
    return so.length > 0 && so.some((v) => !tienCo.some((t) => Math.abs(t - v) <= t * 0.01));
  });
  return ra;
}

/**
 * FR-218 b (24/09/2026, chủ dự án test vai mua): khách nói đủ quận + giá ngay tin đầu, kho đã lọc ra căn, mà model
 * vẫn hỏi dò ("ba mẹ ở cùng hay phòng riêng?", "ưu tiên hẻm xe hơi hay mặt tiền?") thay vì đưa căn — lời dặn
 * trong prompt lọt ngẫu nhiên (bắn lại đúng câu đó thì lần sau nó đưa căn). Chặn bằng code: `coNhacCan` soi xem
 * chữ có nhắc căn nào trong kho (mã hoặc tên đường) chưa; chưa thì nơi gọi thay câu hỏi dò bằng `bongBongGoiYCan`.
 */
export type CanGoiY = { code: string; ten: string; dong: string };
export function coNhacCan(chu: string[], cans: CanGoiY[]): boolean {
  const kd = boDau(chu.filter((r) => !/^\s*(?:🤖|💾|📝|📋)/u.test(r)).join("\n"));
  return cans.some((c) => kd.includes(c.code.toLowerCase()) || (c.ten.length >= 4 && kd.includes(boDau(c.ten))));
}
/** Bóng bóng đưa tối đa `n` căn, KHÔNG mã tin (FR-178 a), chỉ thông số có thật trong dòng. */
export function bongBongGoiYCan(cans: CanGoiY[], ac: string, n = 2): string {
  const ds = cans.slice(0, n).map((c) => `- ${c.dong}`).join("\n");
  return `Dạ bên em đang có ${cans.length >= 2 && n >= 2 ? "mấy căn" : "căn"} hợp với ${ac} nè:\n${ds}\n${ac[0].toUpperCase()}${ac.slice(1)} thấy căn nào hợp để em gửi thêm hình và chi tiết ạ?`;
}
/** Bỏ bong bóng CHỈ là câu hỏi dò ngắn (kết thúc "?", ≤ 25 từ); bong bóng báo lưu và câu có nội dung giữ nguyên. */
export function boCauHoiDo(replies: string[]): string[] {
  return replies.filter((r) => /^\s*(?:🤖|💾|📝|📋)/u.test(r) || !(/\?\s*$/.test(r.trim()) && r.trim().split(/\s+/).length <= 25));
}

/**
 * FR-218 c (24/09/2026, bắn thật sau #266): dòng kho đã kèm lời chủ tả + lời dặn "không ghi thì hỏi lại chủ", model
 * vẫn viết "Cả 2 căn đều có phòng ngủ ở tầng trệt cho ba mẹ" cho hai căn không hề ghi điều đó — khách hỏi đúng
 * thứ đó nên model chiều theo. Lưới bằng code cho các ĐẶC ĐIỂM khách hay đòi: câu khẳng định một đặc điểm và
 * gắn với căn (tên đường trong câu, hoặc trong cùng bong bóng) mà dữ liệu căn đó không có → thay câu bằng
 * "…em hỏi lại chủ rồi báo". Câu hỏi và câu phủ định ("không có thang máy") giữ nguyên.
 */
export type CanDuLieu = { ten: string; du_lieu: string };
const DAC_DIEM: Array<{ ten: string; re: RegExp }> = [
  { ten: "phòng ngủ ở tầng trệt", re: /\bphong ngu (?:o |tai |duoi |ngay )?(?:tang )?tret\b|\btret (?:co |la |lam )?(?:\d |mot )?phong ngu\b|\bphong (?:ngu )?(?:cho |de )?(?:ba me|ong ba|nguoi gia)[^.?!]{0,20}\btret\b/ },
  { ten: "thang máy", re: /\bthang may\b/ },
  { ten: "sân thượng", re: /\bsan thuong\b/ },
  { ten: "sân vườn / sân sau", re: /\bsan (?:vuon|sau|truoc|rong)\b|\bdat trong\b/ },
  { ten: "chỗ đậu ô tô trong nhà", re: /\b(?:gara|garage|ga ra)\b|\b(?:de|dau|cat) (?:xe hoi|o to|oto) (?:trong|vao) nha\b|\b(?:xe hoi|o to|oto) vao (?:tan |trong )?nha\b/ },
  { ten: "tầng hầm", re: /\btang ham\b|\bham de xe\b/ },
];
const PHU_DINH_DD = /\b(?:khong|ko|chua|chang|khong he)\s+(?:co\s+)?/;
export function boDacDiemKhongCo(replies: string[], cans: CanDuLieu[]): { replies: string[]; bo: string[] } {
  const bo: string[] = [];
  if (!cans.length) return { replies, bo };
  const duLieu = cans.map((c) => ({ ten: boDau(c.ten), dl: boDau(c.du_lieu) })).filter((c) => c.ten.length >= 4);
  const ra = replies.map((r) => {
    if (/^\s*(?:🤖|💾|📝|📋)/u.test(r)) return r;
    const canBong = duLieu.filter((c) => boDau(r).includes(c.ten));
    const cau = r.split(/(?<=[.!?\n])/);
    let doi = false;
    const moi = cau.map((c) => {
      const kd = boDau(c);
      if (/\?\s*$/.test(c.trim())) return c;
      const dd = DAC_DIEM.find((d) => d.re.test(kd));
      if (!dd) return c;
      const truoc = kd.slice(0, kd.search(dd.re));
      if (PHU_DINH_DD.test(truoc.slice(-25))) return c;
      const canCau = duLieu.filter((x) => kd.includes(x.ten));
      const ds = canCau.length ? canCau : canBong;
      if (!ds.length || ds.every((x) => dd.re.test(x.dl))) return c;
      doi = true;
      bo.push(dd.ten);
      return (c.match(/^\s*/)?.[0] ?? "") + `Còn ${dd.ten} thì em hỏi lại chủ từng căn rồi báo mình nha.` + (c.match(/\s*$/)?.[0] ?? "");
    });
    return doi ? moi.join("").replace(/(Còn [^.]+ thì em hỏi lại chủ từng căn rồi báo mình nha\.\s*){2,}/g, "$1").replace(/[ \t]{2,}/g, " ").trim() : r;
  });
  return { replies: ra, bo };
}
