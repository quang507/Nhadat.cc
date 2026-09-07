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

export type LoaiCau =
  | "khop"      // đúng là câu trả lời cho câu đang hỏi → ghi fact, đóng câu hỏi
  | "xung_ho"   // dặn cách gọi ("kêu chị nha") → nhớ, KHÔNG ghi fact, hỏi lại
  | "ack"       // tiểu từ / ừ / ok / để coi → không ghi, hỏi lại nhẹ
  | "hoi"       // chủ nhà HỎI ngược ("phí sao em?") → trả lời rồi hỏi lại
  | "lech";     // có nội dung nhưng không khớp câu hỏi → không ghi, hỏi rõ

export type KetQuaKhop = {
  loai: LoaiCau;
  /** Cách xưng hô chủ nhà dặn, chỉ có khi loai = "xung_ho". */
  xungHo?: "anh" | "chị";
  /** Câu không khớp câu đang hỏi nhưng khớp RÕ một fact khác → ghi vào đó. */
  chuyenSang?: { question: string; answer: string };
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

export function batXungHo(text: string): "anh" | "chị" | null {
  const kd = boDau(text);
  const m = XUNG_HO_RE.exec(kd);
  if (!m) return null;
  const tu = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5];
  if (tu === "chi" || tu === "co" || tu === "bac") return tu === "bac" ? "anh" : "chị";
  return "anh";
}

// ── Tiểu từ / ack ────────────────────────────────────────────────────────────
const TIEU_TU =
  /\b(a|u|o|oi|da|vang|em|anh|chi|nha|nhe|nhen|ha|hen|ok|oke|okie|roi|thi|ma|voi|va|do|luon|de|coi|xem|chut|lat|nua|tam|di|ne|ne|ok|uh|uk|um|hmm|hm|yes|yep)\b/g;
const conChu = (kd: string) => kd.replace(TIEU_TU, "").replace(/[^a-z0-9]+/g, "");

const CO_SO = /\d/;
const SO_CHU = /\b(mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi|ruoi)\b/;

// Câu hỏi cần MỘT CON SỐ mới là trả lời.
const HOI_SO = new Set([
  "dien_tich", "dien_tich_dat", "dien_tich_tim_tuong", "tho_cu", "ket_cau", "tang",
  "so_phong_ngu", "nam_xay", "mat_tien", "do_rong_hem", "do_rong_duong",
  "phi_quan_ly", "gia_dien_nuoc", "thoi_han_thue", "gia",
]);

// Từ khoá tối thiểu cho các câu hỏi CHỮ. Không có từ nào trong đây thì coi là
// lệch: "16m nha" không phải hướng, "kêu chị nha" không phải pháp lý.
const TU_KHOA: Record<string, RegExp> = {
  phap_ly: /\b(so|hong|do|hoan cong|giay|hop dong|hdmb|vi bang|phap ly|chung|rieng|chua co so|cho so|ra so|dang lam so|shr|shc)\b/,
  huong: /\b(dong|tay|nam|bac|huong|chua ro|khong ro|ko ro|khong biet|ko biet|chua biet)\b/,
  quy_hoach: /\b(khong|ko|k|chua|co|dinh|vuong|on|sach|quy hoach|lo gioi|treo|giai toa|an toan|khong dinh|ko dinh|chuan)\b/,
  loai_bds: /\b(nha|pho|cap 4|chung cu|can ho|dat|biet thu|phong tro|mat bang|kho|xuong)\b/,
};

// Câu hỏi ngược của chủ nhà: có dấu hỏi hoặc mở đầu bằng từ để hỏi.
const CAU_HOI_RE = /\?|^\s*(?:phi|bao nhieu|sao|the nao|nhu the nao|bao gio|khi nao|em la|ben em|co phai|lam sao|toi co|toi phai|minh phai|co can)\b/;

/**
 * Phân loại câu chủ nhà vừa nhắn so với câu hỏi `question` đang treo.
 * `text` là phần còn lại SAU khi tầng trên đã bóc lời sửa (FR-164).
 */
export function phanLoaiCauTraLoi(question: string, text: string): KetQuaKhop {
  const kd = boDau(text.trim());
  const xungHo = batXungHo(text);
  const chu = conChu(kd.replace(XUNG_HO_RE, " "));

  // Dặn xưng hô mà ngoài ra không còn nội dung → nhớ, hỏi lại.
  if (xungHo && chu.length < 3) return { loai: "xung_ho", xungHo };
  if (chu.length < 2 && !CO_SO.test(kd)) return { loai: "ack" };

  // Chủ nhà hỏi ngược. Có số kèm dấu hỏi ("5 tỷ được không?") vẫn là câu hỏi
  // — bot phải trả lời chứ không lặng lẽ ghi "5 tỷ được không?" làm đáp án.
  if (CAU_HOI_RE.test(kd) && !(HOI_SO.has(question) && /^\s*[\d.,]+\s*(m2|m|ty|ti|tr|trieu|tang|lau|tam|pn)?\s*\?\s*$/.test(kd))) {
    return { loai: "hoi", ...(xungHo ? { xungHo } : {}) };
  }

  const ketQua = (loai: LoaiCau, them: Partial<KetQuaKhop> = {}): KetQuaKhop =>
    ({ loai, ...(xungHo ? { xungHo } : {}), ...them });

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
    if (coDien || (CO_SO.test(kd) && !/\b(ngang|rong|dai|sau|tang|lau|tam|phong|pn|ty|ti|trieu|tr)\b/.test(kd))) {
      return ketQua("khop");
    }
    return ketQua("lech");
  }

  if (HOI_SO.has(question)) {
    if (CO_SO.test(kd) || SO_CHU.test(kd)) {
      // Số đi kèm đơn vị của trường KHÁC thì lệch: hỏi năm xây mà nhận "5 tỷ".
      if (question !== "gia" && /\b(ty|ti|trieu|tr)\b/.test(kd)) return ketQua("lech");
      // "80m2": không có ranh giới từ giữa "80" và "m2", nên đừng dùng \b trước m2.
      if (question === "gia" && /(m2|m²|met vuong|\btang\b|\blau\b|\btam\b)/.test(kd) && !/\b(ty|ti|trieu|tr|k)\b/.test(kd)) return ketQua("lech");
      return ketQua("khop");
    }
    // "chưa rõ / không nhớ" là câu trả lời hợp lệ cho năm xây, phí quản lý…
    if (/\b(khong nho|ko nho|chua ro|khong ro|ko ro|khong biet|ko biet|chua biet|khong co|ko co|mien phi)\b/.test(kd)) return ketQua("khop");
    return ketQua("lech");
  }

  // Phường: "5", "phường 5", "p5", "Nguyễn Cư Trinh" đều nhận; "ừ" thì không.
  if (question === "phuong") {
    return ketQua(CO_SO.test(kd) || /\bphuong\b|\bp\s*\d/.test(kd) || chu.length >= 3 ? "khop" : "lech");
  }

  const tk = TU_KHOA[question];
  if (tk) return ketQua(tk.test(kd) ? "khop" : "lech");

  // Câu hỏi chữ tự do (hiện trạng, nội thất, ngành hàng, sân vườn, giờ giấc…):
  // có nội dung là nhận.
  return ketQua(chu.length >= 3 ? "khop" : "lech");
}

/** Nhãn tiếng Việt ngắn để hỏi lại, KHÔNG lặp nguyên văn câu hỏi trước. */
export const NHAN_HOI_LAI: Record<string, string> = {
  phap_ly: "giấy tờ nhà mình là sổ hồng riêng hay chung, đã hoàn công chưa",
  huong: "nhà mình quay hướng nào",
  dien_tich_dat: "tổng diện tích đất bao nhiêu m2, hoặc ngang bao nhiêu dài bao nhiêu",
  dien_tich: "diện tích bao nhiêu m2",
  ket_cau: "nhà mấy tầng, mấy phòng ngủ",
  quy_hoach: "nhà có dính quy hoạch hay lộ giới gì không",
  nam_xay: "nhà xây năm nào",
  gia: "giá mình muốn bán bao nhiêu",
  phuong: "nhà mình thuộc phường mấy",
  do_rong_hem: "hẻm trước nhà rộng mấy mét, xe hơi vào được không",
};
