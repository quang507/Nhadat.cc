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
  /**
   * Câu không khớp câu đang hỏi nhưng khớp RÕ một fact khác → ghi vào đó
   * (FR-177 e: hỏi một đường, trả lời một nẻo thì VẪN ghi). Không nhận ra
   * fact nào thì tầng trên ghi nguyên văn vào fact `bo_sung`.
   */
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

  // Ảnh (FR-177 a): ảnh thật đi đường ghiAnhKem, chữ chỉ "khớp" khi chủ nói
  // KHÔNG có ảnh; "chiều gửi" là lời hứa (PROMISE_RE tầng trên đặt nhắc).
  if (question === "hinh_anh") {
    return ketQua(/\b(khong co|ko co|k co|chua co|chua chup|khong chup|ko chup)\b/.test(kd) ? "khop" : "lech");
  }

  if (HOI_SO.has(question)) {
    if (CO_SO.test(kd) || SO_CHU.test(kd)) {
      // Số đi kèm đơn vị của trường KHÁC thì lệch: hỏi năm xây mà nhận "5 tỷ".
      if (question !== "gia" && /\b(ty|ti|trieu|tr)\b/.test(kd)) return ketQua("lech");
      // "80m2": không có ranh giới từ giữa "80" và "m2", nên đừng dùng \b trước m2.
      if (question === "gia" && /(m2|m²|met vuong|\btang\b|\blau\b|\btam\b|\bngang\b|\brong\b|\bdai\b|\bsau\b|\bhem\b|\bmat tien\b)/.test(kd) && !/\b(ty|ti|toi|trieu|tr|k)\b/.test(kd)) return ketQua("lech");
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
  hinh_anh: "mình gửi giúp em vài tấm ảnh sổ, mặt tiền nhà và hẻm",
  duyet_tin: "bản nháp tin như vậy đã được chưa, hay mình muốn sửa chỗ nào",
};

// ── FR-177 e: chủ nhà đang nói FACT NÀO? ─────────────────────────────────────
// Chỉ nhận khi câu có NHÃN hoặc ĐƠN VỊ rõ ("ngang 5", "80m2", "5 tỷ", "hẻm 4m",
// "3 lầu", "2 phòng ngủ", "sổ hồng", "hướng đông", "phường 5", "xây 2010").
// Một con số trần ("16m nha") thì KHÔNG đoán — về `bo_sung`, người đọc sau.
// Đáp án là chuỗi ĐÃ BỎ DẤU cho các trường số (parse_vnd/boc_thong_so phía DB
// đọc được "ty"/"trieu"), còn trường chữ (pháp lý, hướng, quy hoạch, nội thất)
// giữ nguyên văn để tầng DB bóc theo từ khoá có dấu.
type NhanDien = { question: string; answer: string };
const SO = "(\\d+(?:[.,]\\d+)?)";
export function nhanDienFact(text: string): NhanDien | null {
  const goc = text.trim();
  const kd = boDau(goc);
  let m: RegExpExecArray | null;
  if (/\b(so hong|so do|so chung|so rieng|hoan cong|vi bang|hop dong|hdmb|shr|shc|giay tay|cam ngan hang|dang the chap)\b/.test(kd)) {
    return { question: "phap_ly", answer: goc };
  }
  if ((m = new RegExp(`\\b(?:hem|hem rong|hem truoc nha)\\s*(?:rong\\s*)?(?:la\\s*)?${SO}\\s*(?:m|met)?\\b`).exec(kd)) ||
      (m = new RegExp(`${SO}\\s*(?:m|met)\\s*hem\\b`).exec(kd))) {
    return { question: "do_rong_hem", answer: `hẻm ${m[1]}m` };
  }
  if (/\b(hem xe hoi|hem oto|hem o to|xe hoi (?:vao|toi|tới) (?:duoc|tan|toi)|hem xe tai)\b/.test(kd)) {
    return { question: "do_rong_hem", answer: goc };
  }
  if ((m = new RegExp(`\\b(?:ngang|rong|mat tien|mt)\\s*(?:la\\s*)?${SO}\\s*(?:m|met)?\\b`).exec(kd)) &&
      !/\b(dai|sau)\b/.test(kd)) {
    return { question: "mat_tien", answer: `${m[1]}m` };
  }
  if ((m = new RegExp(`${SO}\\s*(?:m2|m²|met vuong|mv)\\b`).exec(kd)) ||
      (m = new RegExp(`${SO}\\s*x\\s*${SO}`).exec(kd))) {
    return { question: "dien_tich", answer: m[0].replace(/\s+/g, " ") };
  }
  if ((m = new RegExp(`${SO}\\s*(?:ty|ti|toi|trieu|tr)\\b(?:\\s*${SO})?(?:\\s*(?:ruoi|thuong luong|tl))?`).exec(kd))) {
    return { question: "gia", answer: m[0].trim() };
  }
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
  if (/\bhuong\s*(dong|tay|nam|bac)\b/.test(kd)) return { question: "huong", answer: goc };
  if (/\b(quy hoach|lo gioi|giai toa)\b/.test(kd)) return { question: "quy_hoach", answer: goc };
  if (/\bnoi that\b/.test(kd)) return { question: "noi_that", answer: goc };
  if (/\b(de o|cho thue|kinh doanh|mo quan|mo shop|chdv|dau tu|van phong|buon ban)\b/.test(kd)) {
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
  loai_bds: "co_ban", phuong: "co_ban", dien_tich: "co_ban", dien_tich_dat: "co_ban",
  dien_tich_tim_tuong: "co_ban", tho_cu: "co_ban", gia: "co_ban", mat_tien: "co_ban",
  huong: "phu", quy_hoach: "phu", nam_xay: "phu",
};
const LIEN_QUAN: Record<string, string[]> = {
  mat_tien: ["dien_tich_dat", "dien_tich", "dien_tich_tim_tuong", "tho_cu"],
  dien_tich: ["mat_tien", "gia"], dien_tich_dat: ["mat_tien", "tho_cu", "gia"],
  dien_tich_tim_tuong: ["gia"], tho_cu: ["gia"],
  gia: ["phuong"], phuong: ["dien_tich_dat", "dien_tich", "dien_tich_tim_tuong"],
  loai_bds: ["phuong"],
  do_rong_hem: ["ket_cau", "mat_tien"], do_rong_duong: ["mat_tien"],
  ket_cau: ["so_phong_ngu", "phap_ly"], tang: ["so_phong_ngu"], so_phong_ngu: ["phap_ly"],
  phap_ly: ["hinh_anh"], hinh_anh: [],
};
export type CauThieu = { fact_key: string; priority?: number; nhom?: string | null };
export function chonCauKe(vuaNoi: string[], conThieu: CauThieu[]): string | undefined {
  if (!conThieu.length) return undefined;
  const nhom = (c: CauThieu) => c.nhom ?? NHOM_FACT[c.fact_key] ?? "chuyen_mon";
  const dau = conThieu[0];
  const ungVien = conThieu.filter((c) => nhom(c) === nhom(dau)).map((c) => c.fact_key);
  for (const k of [...vuaNoi].reverse()) {
    for (const lq of LIEN_QUAN[k] ?? []) {
      if (ungVien.includes(lq)) return lq;
    }
  }
  return dau.fact_key;
}

// ── FR-177 c: chủ nhà GẬT bản nháp? (AGREE_RULES, bản tiền định) ─────────────
// Gật = câu chỉ gồm từ đồng ý + tiểu từ, không có từ phủ định/sửa; hoặc emoji
// vui, like, tim. "ok nhưng sửa giá" là KHÔNG gật — sửa đi trước.
const TU_GAT = new Set(["da","vang","ok","oke","okie","okay","u","uh","um","duoc","dc","chuan","dung","dong","y","chot","len","dang","vay","tot","hay","dep","on","nhat","tri","xin","cam","on","yes","yep"]);
const TU_DEM = new Set(["nha","nhe","nhen","em","e","a","roi","do","day","luon","di","thoi","ha","rat","qua","lam","cu","the","nhu","tin","vay","cho","chi","anh","minh","toi","ne","het","cai","nay","ma"]);
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
