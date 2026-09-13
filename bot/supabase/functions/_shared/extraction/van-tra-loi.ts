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
  /\b(?:tim|gui|loc|chon|lua|kiem)\s+(?:(?:ra|duoc|san)\s+)?(?:vai|mot vai|mot so|may|\d+)\s+can\b/,
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
  const dau = boDau(tachCau(tin.trim())[0] ?? "");
  const m = /^(?:da|vang)?[\s,]*(?:em\s+)?(?:da\s+)?(?:ghi|sua|cap nhat|chinh)(?:\s+(?:lai|nhan|ro|chuan))?\b/.exec(dau);
  if (!m) return false;
  const conLai = dau.slice(m[0].length)
    .replace(/\b(?:roi|xong|duoc|het|luon|vao|tin|cho|lai|a|nha|nhe|anh|chi|em|minh|ha|nghe)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
  return conLai.length >= 3;
}
