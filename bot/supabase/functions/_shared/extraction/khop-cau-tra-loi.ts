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
  // FR-186 (09/09/2026, cho thuê): cọc mấy tháng, trượt giá mấy % — đều là số.
  "tien_coc", "truot_gia",
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
  vi_tri: /\b(duong|hem|hxh|so|pho|ngo|kdc|khu|toa|chung cu|cu xa|lo|kp|ap|xa|phuong|quan|gan|doi dien|nga|cho|truong|benh vien|cong vien|du an|block|thap)\b|\d/,
  // FR-186 (09/09/2026): bộ câu hỏi riêng cho đất / biệt thự (chat Gemini
  // 21/06: "vướng cột điện, hố ga", "xây tự do hay theo mẫu CĐT", "compound").
  ha_tang: /\b(cot dien|ho ga|tru dien|cong|duong dam|vuong|khong vuong|ko vuong|sach|khong co|ko co|khong|ko|trong|thoang)\b/,
  xay_dung: /\b(tu do|theo mau|mau|chu dau tu|cdt|quy hoach|xay|tang|lau|khong|ko|duoc)\b/,
  khu_compound: /\b(compound|biet lap|an ninh|bao ve|khu|cong|rieng|khong|ko|mo|tu do|ben ngoai|dan cu)\b/,
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
type NhanDien = { question: string; answer: string };
const SO = "(\\d+(?:[.,]\\d+)?)";
export function nhanDienFact(text: string): NhanDien | null {
  const goc = text.trim();
  const kd = boDau(goc);
  let m: RegExpExecArray | null;
  if (/\b(so hong|so do|so chung|so rieng|hoan cong|vi bang|hop dong|hdmb|shr|shc|giay tay|cam ngan hang|dang the chap)\b/.test(kd)) {
    return { question: "phap_ly", answer: goc };
  }
  // Vị trí cụ thể: "đường Trần Bình Trọng", "hẻm 123/45 Nguyễn Trãi", "số 12
  // Lê Lợi", "123/4 An Dương Vương". "hẻm 4m" (độ rộng) không rơi vào đây vì
  // sau số là đơn vị mét, không phải "/" hay tên đường.
  if (/\b(duong|pho)\s+[a-z]{2,}/.test(kd) ||
      /\b(?:hem|hxh)\s*\d+(?:\/\d+)+\b/.test(kd) ||
      /\b(?:so|so nha|dia chi)\s*\d+[a-z]?(?:\/\d+)*\s+[a-z]{2,}/.test(kd) ||
      /^\s*\d+[a-z]?(?:\/\d+[a-z]?)+\s+[a-z]{2,}/.test(kd)) {
    return { question: "vi_tri", answer: goc };
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
  // FR-186: cho thuê — "cọc 2 tháng", "cọc 1 đóng 3"; "tăng 5%/năm", "trượt giá 10%".
  if ((m = /\bcoc\s*(\d{1,2})\s*(?:thang|th)?\b/.exec(kd)) || (m = /\b(\d{1,2})\s*thang\s*(?:tien\s*)?coc\b/.exec(kd))) {
    return { question: "tien_coc", answer: `cọc ${m[1]} tháng` };
  }
  if ((m = /\b(?:tang|truot gia|len)\s*(?:gia\s*)?(?:khoang\s*)?(\d{1,2})\s*%/.exec(kd)) || (m = /(\d{1,2})\s*%\s*(?:moi|1|mot)?\s*nam\b/.exec(kd))) {
    return { question: "truot_gia", answer: `${m[1]}%/năm` };
  }
  // FR-186: đất — hạ tầng (cột điện, hố ga), xây tự do / theo mẫu; biệt thự — compound.
  if (/\b(cot dien|ho ga|tru dien|duong dam)\b/.test(kd)) return { question: "ha_tang", answer: goc };
  if (/\b(xay tu do|theo mau|mau chu dau tu|mau cdt|xay theo)\b/.test(kd)) return { question: "xay_dung", answer: goc };
  if (/\b(compound|biet lap|khu an ninh|bao ve 24)\b/.test(kd)) return { question: "khu_compound", answer: goc };
  if (/\b(quy hoach|lo gioi|giai toa)\b/.test(kd)) return { question: "quy_hoach", answer: goc };
  if (/\b(noi that|ban giao|nha trong|full nt)\b/.test(kd)) return { question: "noi_that", answer: goc };
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
  loai_bds: "co_ban", phuong: "co_ban", vi_tri: "co_ban", dien_tich: "co_ban", dien_tich_dat: "co_ban",
  dien_tich_tim_tuong: "co_ban", tho_cu: "co_ban", gia: "co_ban", mat_tien: "co_ban",
  huong: "phu", quy_hoach: "phu", nam_xay: "phu",
};
const LIEN_QUAN: Record<string, string[]> = {
  mat_tien: ["dien_tich_dat", "dien_tich", "dien_tich_tim_tuong", "tho_cu"],
  dien_tich: ["mat_tien", "gia"], dien_tich_dat: ["mat_tien", "tho_cu", "gia"],
  dien_tich_tim_tuong: ["gia"], tho_cu: ["gia"],
  gia: ["phuong"], phuong: ["vi_tri", "dien_tich_dat", "dien_tich", "dien_tich_tim_tuong"],
  vi_tri: ["phuong", "do_rong_hem", "dien_tich_dat", "dien_tich"],
  loai_bds: ["phuong"],
  do_rong_hem: ["ket_cau", "mat_tien"], do_rong_duong: ["huong", "ha_tang", "mat_tien"],
  ket_cau: ["so_phong_ngu", "san_vuon", "phap_ly"], tang: ["so_phong_ngu", "huong"], so_phong_ngu: ["huong", "noi_that", "phap_ly"],
  // FR-186 (09/09/2026): chuỗi hỏi giống người cho chung cư / đất / biệt thự / cho thuê.
  huong: ["noi_that", "ha_tang", "phap_ly"], noi_that: ["phap_ly", "tien_coc"],
  ha_tang: ["xay_dung", "phap_ly"], xay_dung: ["phap_ly"],
  san_vuon: ["khu_compound", "do_rong_hem"], khu_compound: ["phap_ly"],
  phap_ly: ["tien_coc", "tiem_nang", "hinh_anh"], tiem_nang: ["hinh_anh"],
  tien_coc: ["thoi_han_thue"], thoi_han_thue: ["truot_gia"], truot_gia: ["hinh_anh"],
  hinh_anh: [],
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
  return /\b(ban|thue|thanh ly|can|ra|di)\s*(?:nha\s*|dat\s*)?gap\b|\bgap\s*(lam|qua|nha|nhe|em|a)?\b|\bcan tien\b|\b(ban|di|ra)\s*nhanh\b/.test(kd);
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
  // "chốt giá 5 tỷ", "bán 5 tỷ rồi" — có số + đơn vị tiền là dữ liệu, không phải báo bán.
  if (/\d\s*(ty|ti|toi|trieu|tr|m2)\b/.test(kd)) return null;
  const banRoi =
    /\b(?:da|vua)\s*(?:ban|cho thue|chot|nhan coc|giao dich|co nguoi (?:mua|thue)|sang ten|xong)\b/.test(kd) ||
    /\b(?:ban|cho thue|chot|giao dich|sang ten)\s*(?:duoc|xong|het|nha|dat|can|no)?\s*(?:roi|xong roi|r)\b/.test(kd) ||
    /\b(?:co nguoi|co khach)\s*(?:mua|thue|coc)\s*(?:roi|r)?\b/.test(kd) ||
    /\b(?:nhan|lay|da)\s*coc\s*(?:roi|xong)?\b/.test(kd) ||
    /\bban (?:duoc|xong) roi\b/.test(kd);
  if (banRoi) return "ban_roi";
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
export type CanChon = { id: string; location_raw?: string | null; ward?: string | null; code?: string | null };
export function chonCanTheoCau(text: string, cans: CanChon[]): CanChon | null {
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
  let tot: CanChon | null = null, diemTot = 0;
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
