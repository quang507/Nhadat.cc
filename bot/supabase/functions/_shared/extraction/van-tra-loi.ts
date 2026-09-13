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
  // "có vài căn đúng ý chị", "có 2 lựa chọn"
  /\bco\s+(?:(?:vai|mot vai|mot so|nhieu|may|hai|ba|\d+)\s+)(?:can|lo|nen|lua chon)\b/,
  // "để em xem căn nào phù hợp nhất" — nói như đang cầm sẵn danh sách.
  /\b(?:xem|chon|loc)\s+(?:xem\s+)?(?:trong\s+)?(?:may\s+)?can\s+nao\s+(?:phu hop|hop|ok|dep|ung)/,
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

// ── Không nhận là người thật (13/09/2026) ──────────────────────────────────
// Lượt bắn 13/09: khách "em là người hay máy vậy" → model "Em là người thật,
// không phải máy đâu anh/chị." Câu lệnh dặn "không thuyết minh về AI" và model
// hiểu thành "chối là AI". Nói dối về bản chất trợ lý là không được, dù khách
// thích giọng người thật tới đâu. Câu nào nhận là người / chối là máy thì thay
// bằng câu thật; phần còn lại (câu hỏi quay lại việc) giữ nguyên.
const NHAN_LA_NGUOI: RegExp[] = [
  /\b(?:em|minh|toi|tui)\s+(?:la\s+|dung la\s+)?(?:mot\s+)?(?:nguoi\s+that|con nguoi|nguoi\s+binh thuong)\b/,
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
  return { profile: ra, bo };
}

// ── Bot tự xưng "chúng mình" (14/09) — luật giọng: em xưng "em", bên công ty là "bên em";
// "mình" chỉ để GỌI khách. "căn hộ có ban công chúng mình có nhiều" đọc như khách với bot
// là một phe.
export function suaTuXungMua(s: string): string {
  return s.replace(/(^|[\s,.!?])(C|c)húng (mình|tôi|tớ)(?![\p{L}])/gu, (_m, dau, c) => `${dau}${c === "C" ? "Bên" : "bên"} em`);
}

/**
 * Gộp ghi chú hoàn cảnh theo TỪNG Ý (tách ở ";" và xuống dòng). Ý mới đã nằm
 * trong ý cũ thì bỏ; ý mới bao trùm ý cũ thì thay. Trả null khi không có gì mới.
 */
export function gopGhiChu(cu: string | null | undefined, moi: string | null | undefined, tran = 500): string | null {
  const tach = (s: string | null | undefined) =>
    String(s ?? "").split(/[;\n]+/).map((x) => x.trim().replace(/[.。]+$/, "")).filter(Boolean);
  const khoa = (s: string) => boDau(s).replace(/[^a-z0-9]+/g, " ").trim();
  const y = tach(cu);
  let doi = false;
  for (const m of tach(moi)) {
    const km = khoa(m);
    if (!km) continue;
    const i = y.findIndex((x) => {
      const kx = khoa(x);
      // Ý quá ngắn ("gần chợ") mà so "nằm trong" thì nuốt nhầm ý khác — so bằng.
      if (kx.length < 8 || km.length < 8) return kx === km;
      return kx.includes(km) || km.includes(kx);
    });
    if (i < 0) { y.push(m); doi = true; }
    else if (khoa(m).length > khoa(y[i]).length) { y[i] = m; doi = true; }
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
    if (/^(📋|💾|📝)/u.test(r)) { ra.push(r); continue; }
    const cau = tachCau(r);
    const giu = cau.filter((c) => !laCauGhiNhanMot(c));
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

function laCauGhiNhanMot(tin: string): boolean {
  const dau = boDau(tachCau(tin.trim())[0] ?? "");
  // 14/09: "Dạ chị, em ghi lại: …" — cho phép đại từ gọi khách chen giữa "Dạ" và "em".
  const m = /^(?:da|vang)?[\s,]*(?:(?:anh\/chi|anh|chi|minh)[\s,]+)?(?:em\s+)?(?:da\s+)?(?:ghi|sua|cap nhat|chinh)(?:\s+(?:lai|nhan|ro|chuan))?\b/.exec(dau);
  if (!m) return false;
  const conLai = dau.slice(m[0].length)
    .replace(/\b(?:roi|xong|duoc|het|luon|vao|tin|cho|lai|a|nha|nhe|anh|chi|em|minh|ha|nghe)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
  return conLai.length >= 3;
}
