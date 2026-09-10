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
  // 20260909i: câu hỏi bù sau đăng + loại mới.
  "so_wc", "cach_mat_tien", "no_hau", "phi_gui_xe", "mat_do_xd", "tang_cao_toi_da", "fit_out",
  "so_phong", "ty_le_lap_day", "doanh_thu", "chieu_cao", "tai_trong_san", "tram_bien_ap",
]);
// Trường có đơn vị tiền hợp lệ ("120 triệu/tháng" là doanh thu, không phải giá bán lạc chỗ).
const TIEN_OK = new Set(["gia", "doanh_thu", "phi_quan_ly", "phi_gui_xe", "gia_dien_nuoc", "tien_coc"]);
// Câu hỏi CÓ/KHÔNG: "có", "không", "rồi", "chưa" là câu trả lời đủ (không phải ack).
const HOI_CO_KHONG = new Set([
  "hem_thong", "ngap_nuoc", "the_chap", "thuong_luong", "can_goc", "thang_may", "pccc", "len_tho_cu", "gap",
  "ranh_gioi", "xu_ly_nuoc_thai", "duong_container", "nguon_nuoc", "hien_trang_su_dung", "so_huu",
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
};

// Câu hỏi ngược của chủ nhà: có dấu hỏi hoặc mở đầu bằng từ để hỏi.
const CAU_HOI_RE = /\?|^\s*(?:phi|bao nhieu|sao|the nao|nhu the nao|bao gio|khi nao|em la|ben em|co phai|lam sao|toi co|toi phai|minh phai|co can)\b/;

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
  ["so_huu", "thoi_han_su_dung"],
  ["hien_trang", "hien_trang_su_dung", "ket_cau"],
  ["noi_that", "fit_out"],
  ["tiem_nang", "muc_dich", "nganh_hang_phu_hop"],
  ["phap_ly", "the_chap"],
];
const cungHo = (a: string, b: string) => a === b || HO_FACT.some((h) => h.includes(a) && h.includes(b));
export const cungHoFact = cungHo;

export function phanLoaiCauTraLoi(question: string, text: string): KetQuaKhop {
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
      const coCauDangHoi = nd && nd.question !== question && nhanDienNhieuFact(text).some((f) => cungHo(f.question, question));
      if (nd && !coCauDangHoi && nd.question !== "bo_sung" && !cungHo(nd.question, question) &&
          !(HOI_CO_KHONG.has(question) && /^\s*(co|khong|ko|k|chua|roi|da)\b/.test(kd0))) {
        const xh = batXungHo(text);
        return { loai: "lech", chuyenSang: nd, ...(xh ? { xungHo: xh } : {}) };
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
  if (HOI_CO_KHONG.has(question) &&
      /^\s*(co|khong|ko|k|chua|roi|da|cut|thong|ngap|kho|cam tay|the chap|ngan hang|dang o|cho thue|trong|lau dai|50 nam|tl|thuong luong|cung duoc|de o)\b/.test(kd)) {
    return { loai: "khop", ...(xungHo ? { xungHo } : {}) };
  }
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
      // Trường TIỀN (giá, doanh thu, phí, cọc, điện nước) thì đơn vị tiền là đúng.
      if (!TIEN_OK.has(question) && /\b(ty|ti|trieu|tr)\b/.test(kd)) return ketQua("lech");
      // "80m2": không có ranh giới từ giữa "80" và "m2", nên đừng dùng \b trước m2.
      if (question === "gia" && /(m2|m²|met vuong|\btang\b|\blau\b|\btam\b|\bngang\b|\brong\b|\bdai\b|\bsau\b|\bhem\b|\bmat tien\b)/.test(kd) && !/\b(ty|ti|toi|trieu|tr|k)\b/.test(kd)) return ketQua("lech");
      return ketQua("khop");
    }
    // "chưa rõ / không nhớ" là câu trả lời hợp lệ cho năm xây, phí quản lý…
    if (/\b(khong nho|ko nho|chua ro|khong ro|ko ro|khong biet|ko biet|chua biet|khong co|ko co|mien phi)\b/.test(kd)) return ketQua("khop");
    return ketQua("lech");
  }

  // Phường: "5", "phường 5", "p5", "Nguyễn Cư Trinh", "xã Phong Phú" đều nhận; "ừ" thì không.
  if (question === "phuong") {
    return ketQua(CO_SO.test(kd) || /\bphuong\b|\bp\s*\d|\bxa\b|\bthi tran\b/.test(kd) || chu.length >= 3 ? "khop" : "lech");
  }
  // Vị trí: cần dấu hiệu địa chỉ thật (đường / hẻm / số nhà / mốc), KHÔNG chỉ vì
  // có con số — "lên thổ cư 300m2", "thời hạn đến 2060" từng đi vào địa chỉ.
  if (question === "vi_tri") {
    const coDiaChi = /\b(duong|hem|hxh|so nha|dia chi|ngo|kdc|khu|toa|block|thap|chung cu|cu xa|du an|kp|ap|xa|phuong|quan|gan|doi dien|nga|cho|truong|benh vien|cong vien|lo|mat tien|mt|pho)\b/.test(kd) ||
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
const FACT_PHU: Array<[string, RegExp, (m: RegExpExecArray) => string]> = [
  // "cần bán gấp 5 tỷ" → câu chính là gấp, giá vẫn phải ghi.
  ["gia", /\b(\d+(?:[.,]\d+)?)\s*(ty|ti|toi|trieu|tr)\b(?:\s*(\d+(?:[.,]\d+)?))?(?:\s*(ruoi))?/, (m) => `${m[1]} ${m[2] === "toi" ? "tỏi" : m[2] === "ty" || m[2] === "ti" ? "tỷ" : "triệu"}${m[3] ? ` ${m[3]}` : ""}${m[4] ? " rưỡi" : ""}`],
  ["so_phong_ngu", /\b(\d{1,2})\s*(?:phong ngu|pn|phong)\b(?!\s*(?:tro|cho thue|khach|tam|dich vu|bep|wc))/, (m) => m[1]],
  ["so_wc", /\b(\d{1,2})\s*(?:wc|toilet|ve sinh)\b/, (m) => m[1]],
  ["huong", /\bhuong\s*((?:dong|tay|nam|bac)(?:\s*(?:dong|tay|nam|bac))?)\b/, (m) => `hướng ${m[1]}`],
  ["mat_tien", /\b(?:ngang|mat tien|mt)\s*(?:la\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|met)?\b/, (m) => `${m[1]}m`],
  ["no_hau", /\bno hau\s*(?:la\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|met)?\b/, (m) => `${m[1]}m`],
];
export function nhanDienNhieuFact(text: string): NhanDien[] {
  const out: NhanDien[] = [];
  const them = (nd: NhanDien | null) => { if (nd && !out.some((x) => x.question === nd.question)) out.push(nd); };
  them(nhanDienFact(text));
  const manh = text.split(/[,;\n]|\s+va\s+|\s+và\s+/i).map((s) => s.trim()).filter((s) => s.length >= 2);
  if (manh.length > 1) for (const s of manh) them(nhanDienFact(s));
  const kd = boDau(text);
  for (const [q, re, lay] of FACT_PHU) {
    const m = re.exec(kd);
    if (m) them({ question: q, answer: lay(m) });
  }
  return out;
}
export function nhanDienFact(text: string): NhanDien | null {
  const goc = text.trim();
  const kd = boDau(goc);
  const kdD = boDauGiuDoDai(goc);
  const catGoc = (mm: RegExpExecArray) => goc.slice(mm.index, mm.index + mm[0].length).trim();
  let m: RegExpExecArray | null;
  if (/\b(so hong|so do|so chung|so rieng|hoan cong|vi bang|hop dong|hdmb|shr|shc|giay tay|cam ngan hang|dang the chap)\b/.test(kd)) {
    return { question: "phap_ly", answer: goc };
  }
  // 10/09/2026 (chủ dự án): GẤP bắt ở MỌI lượt — "cần bán gấp", "không gấp, bán được
  // giá thì thôi", "không vội". Trả nguyên văn; tầng DB (sync_cols) đọc ra true/false.
  if (laGap(goc) || /\b(khong|ko|k|chua|chang|dau co)\s*(?:can\s*)?(?:gap|voi)\b|\bduoc gia thi thoi\b|\bkhong voi\b|\btu tu\b|\bban duoc gia\b/.test(kd)) {
    if (!/\bgap\s*(doi|ba|lan|ruoi|\d)/.test(kd)) return { question: "gap", answer: goc };
  }
  // 09/09 tối: những thứ CÓ SỐ nhưng không phải giá/diện tích — xét TRƯỚC giá,
  // kẻo "doanh thu 120 triệu/tháng" đè giá bán, "phí quản lý 15 nghìn/m2" rơi bo_sung.
  if (/\b(doanh thu|thu ve|dong tien|thu nhap|tien thue thu)\b/.test(kd)) return { question: "doanh_thu", answer: goc };
  if (/\b(phi quan ly|phi ql|phi dich vu|phi bao tri)\b/.test(kd)) return { question: "phi_quan_ly", answer: goc };
  if (/\b(phi gui xe|phi giu xe|tien gui xe)\b/.test(kd)) return { question: "phi_gui_xe", answer: goc };
  if (/\b(san truoc|san sau|san vuon|co san|san rong|san dau xe)\b/.test(kd) && /\d/.test(kd)) return { question: "san_vuon", answer: goc };
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
  // "tầng 12" (chung cư), "thuê tối thiểu 1 năm", "hợp để ở / kinh doanh được" — 09/09 tối lần 2 rơi bo_sung.
  if ((m = /\b(?:tang|lau)\s*(?:thu\s*)?(\d{1,2})\b(?!\s*(?:lau|tang|tam|phong|m\b|met|x|%|(?:moi|mot|1)?\s*nam))/.exec(kd)) &&
      !/\b\d+\s*(?:lau|tang|tam)\b/.test(kd) && !/\btang\s*(?:gia|them|len)\b|\d\s*%/.test(kd)) {
    return { question: "tang", answer: m[1] };
  }
  if (/\b(thue toi thieu|toi thieu \d+ (?:nam|thang)|hop dong \d+ (?:nam|thang)|thoi han thue|ky \d+ nam|thue \d+ nam)\b/.test(kd)) {
    return { question: "thoi_han_thue", answer: goc };
  }
  if ((/^\s*(?:hop|de|nha)?\s*(?:hop )?(?:de o|o gia dinh|o|kinh doanh|buon ban|cho thue|lam van phong|mo shop|mo quan|lam cua hang)(?:\s|$|,)/.test(kd) && kd.split(/\s+/).length <= 8) ||
      (/\b(o hoac|hoac lam|deu duoc|lam can ho dich vu|lam chdv|hop (?:de )?(?:o|kinh doanh|cho thue|lam))\b/.test(kd) && kd.split(/\s+/).length <= 14 &&
        !/\b(showroom|lam xuong|van phong cong ty|nha hang|benh vien|truong hoc|lam kho)\b/.test(kd))) {
    return { question: "tiem_nang", answer: goc };
  }
  // Nội thất: "để lại máy lạnh, bếp", "full nội thất", "nhà trống".
  if (/\b(de lai|full noi that|noi that (?:co ban|day du|full)|may lanh|tu lanh|giuong|bep|ban giao (?:tho|trong|nha trong)|nha trong)\b/.test(kd) && !/\b(mat tien|m2|ty|trieu)\b/.test(kd)) {
    return { question: "noi_that", answer: goc };
  }
  // "phường Tân Hưng" (tên chữ, câu ngắn) — phường số bắt ở dưới.
  if (/^\s*(?:phuong|p\.)\s+[a-z][a-z ]{2,25}\s*$/.test(kd) && !/\d/.test(kd)) return { question: "phuong", answer: goc };
  // Đường VÀO đất/xưởng: chất liệu, xe tải — không phải địa chỉ.
  if (/\b(duong (?:be tong|nhua|dat|dal|cap phoi)|xe tai (?:vao|vo|chay)|duong vao)\b/.test(kd)) return { question: "duong_vao", answer: goc };
  // Vị trí cụ thể: "đường Trần Bình Trọng", "hẻm 123/45 Nguyễn Trãi", "số 12
  // Lê Lợi", "123/4 An Dương Vương". "hẻm 4m" (độ rộng) không rơi vào đây vì
  // sau số là đơn vị mét, không phải "/" hay tên đường.
  if (/\b(duong|pho)\s+[a-z]{2,}/.test(kd) ||
      /\b(?:hem|hxh)\s*\d+(?:\/\d+)+\b/.test(kd) ||
      // "hẻm 123 Trần Bình Trọng": số hẻm rồi TÊN ĐƯỜNG (chữ), không phải "hẻm 4m".
      /\b(?:hem|hxh)\s*\d+[a-z]?\s+(?!m\b|met\b|xe\b|rong\b|thong\b|cut\b)[a-z]{2,}/.test(kd) ||
      /\b(?:so|so nha|dia chi)\s*\d+[a-z]?(?:\/\d+)*\s+[a-z]{2,}/.test(kd) ||
      /^\s*\d+[a-z]?(?:\/\d+[a-z]?)+\s+[a-z]{2,}/.test(kd)) {
    return { question: "vi_tri", answer: goc };
  }
  // Độ rộng hẻm: có đơn vị mét, hoặc số nhỏ (≤ 30) đứng cuối / trước dấu câu —
  // "hẻm 123 Trần Bình Trọng" là địa chỉ (đã bắt ở trên), không phải "hẻm 123m".
  if ((m = new RegExp(`\\b(?:hem|hem rong|hem truoc nha)\\s*(?:rong\\s*)?(?:la\\s*)?${SO}\\s*(?:m|met)\\b`).exec(kd)) ||
      (m = new RegExp(`\\b(?:hem|hem rong|hem truoc nha)\\s*(?:rong\\s*)?(?:la\\s*)?(\\d{1,2}(?:[.,]\\d+)?)\\s*(?=$|[,.;!?]|\\s+(?:xe|o to|oto|thong|cut|nha|em|anh|chi|a\\b))`).exec(kd)) ||
      (m = new RegExp(`${SO}\\s*(?:m|met)\\s*hem\\b`).exec(kd))) {
    return { question: "do_rong_hem", answer: `hẻm ${m[1]}m` };
  }
  if (/\b(hem xe hoi|hem oto|hem o to|xe hoi (?:vao|toi|tới) (?:duoc|tan|toi)|hem xe tai)\b/.test(kd)) {
    return { question: "do_rong_hem", answer: goc };
  }
  // 20260909i: "cách mặt tiền 50m" là KHOẢNG CÁCH, không phải chiều ngang.
  if ((m = new RegExp(`\\bcach\\s*(?:mat tien|duong lon|duong chinh|mt)\\s*(?:khoang|tam|chung)?\\s*${SO}\\s*(?:m|met)?\\b`).exec(kd))) {
    return { question: "cach_mat_tien", answer: `${m[1]}m` };
  }
  if ((m = new RegExp(`\\b(?:ngang|rong|mat tien|mt)\\s*(?:la\\s*)?${SO}\\s*(?:m|met)?\\b`).exec(kd)) &&
      !/\b(dai|sau)\b/.test(kd)) {
    return { question: "mat_tien", answer: `${m[1]}m` };
  }
  if ((m = new RegExp(`${SO}\\s*(?:m2|m²|met vuong|mv)\\b`).exec(kd)) ||
      (m = new RegExp(`${SO}\\s*x\\s*${SO}`).exec(kd))) {
    return { question: "dien_tich", answer: m[0].replace(/\s+/g, " ") };
  }
  // Giá: khớp trên bản bỏ dấu GIỮ ĐỘ DÀI rồi cắt đúng đoạn gốc ("18 tỷ", "4 tỷ 5").
  if ((m = new RegExp(`${SO}\\s*(?:ty|ti|toi|trieu|tr)\\b(?:\\s*${SO})?(?:\\s*(?:ruoi|thuong luong|tl))?`).exec(kdD))) {
    return { question: "gia", answer: catGoc(m) };
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
  if (/\bhuong\s*(dong|tay|nam|bac)\b/.test(kd)) return { question: "huong", answer: goc };
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
  if ((m = new RegExp(`\\bno hau\\s*(?:la\\s*)?${SO}\\s*(?:m|met)?\\b`).exec(kd))) return { question: "no_hau", answer: `${m[1]}m` };
  if (/\b(ngap|dong nuoc|khong ngap|ko ngap|kho rao|cao rao)\b/.test(kd) && /\b(mua|nuoc|ngap|cao rao|kho rao)\b/.test(kd)) {
    return { question: "ngap_nuoc", answer: goc };
  }
  if (/\b(hem thong|hem cut|quay dau|thong ra|khong thong|ko thong)\b/.test(kd)) return { question: "hem_thong", answer: goc };
  if (/\b(dang the chap|the chap|cam ngan hang|so cam tay|cam tay|trong ngan hang|ket sat)\b/.test(kd)) return { question: "the_chap", answer: goc };
  if (/\b(thuong luong|\btl\b|bot chut|fix|cung duoc|con bot|gia net|gia chot)\b/.test(kd) && !/\d\s*(ty|ti|trieu|tr)\b/.test(kd)) {
    return { question: "thuong_luong", answer: goc };
  }
  if (/\b(dang o|dang cho thue|de trong|nha trong|con o|dang thue)\b/.test(kd) && !/\b(noi that|ban giao)\b/.test(kd)) return { question: "hien_trang_su_dung", answer: goc };
  if (/\b(ly do|dinh cu|ke tien|can tien|doi nha|chuyen cho|di nuoc ngoai|chia tai san)\b/.test(kd)) return { question: "ly_do_ban", answer: goc };
  if (/\b(truong hoc|truong tieu hoc|cong chung|phong gym|gym|gan cho\b|cho gan\b|sieu thi|benh vien gan)\b/.test(kd)) return { question: "tien_ich_gan", answer: goc };
  if (/\b(can goc|lo goc)\b/.test(kd)) return { question: "can_goc", answer: goc };
  if (/\bthang may\b/.test(kd)) return { question: "thang_may", answer: goc };
  if (/\bview\b/.test(kd)) return { question: "view", answer: goc };
  if (/\b(pccc|phong chay)\b/.test(kd)) return { question: "pccc", answer: goc };
  if ((m = /\b(\d{1,3})\s*(?:phong|can)\s*(?:cho thue|dich vu|khach)\b/.exec(kd))) return { question: "so_phong", answer: m[1] };
  if ((m = /\b(?:lap day|kin phong|full phong)\s*(?:khoang|tam)?\s*(\d{1,3})\s*%/.exec(kd)) || (m = /(\d{1,3})\s*%\s*(?:lap day|kin phong)/.exec(kd))) return { question: "ty_le_lap_day", answer: `${m[1]}%` };
  if (/\bdoanh thu\b|\bthu ve\b.*\bthang\b|\bdong tien\b/.test(kd)) return { question: "doanh_thu", answer: goc };
  if ((m = new RegExp(`\\b(?:cao|thong thuy|chieu cao)\\s*(?:khoang|tam)?\\s*${SO}\\s*(?:m|met)\\b`).exec(kd)) && /\b(xuong|kho|thong thuy|tran)\b/.test(kd)) return { question: "chieu_cao", answer: `${m[1]}m` };
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
  if (/\b(lau dai|so huu lau dai|den nam 20\d\d|thoi han su dung|50 nam)\b/.test(kd)) return { question: /\b(can ho|chung cu)\b/.test(kd) ? "so_huu" : "thoi_han_su_dung", answer: goc };
  if (/\b(mat do xay dung|mat do xd)\b/.test(kd)) return { question: "mat_do_xd", answer: goc };
  if (/\b(vuong vuc|bop hau|thop hau|meo|hinh dang)\b/.test(kd)) return { question: "hinh_dang", answer: goc };
  if (new RegExp(`\\bfit.?out\\s*(?:khoang|tam)?\\s*${SO}\\s*(?:ngay|thang|tuan)`).test(kd) || new RegExp(`\\b(?:mien phi|free)\\s*${SO}\\s*(?:ngay|thang|tuan)\\s*(?:sua|sua chua|setup|lam noi that)`).test(kd)) return { question: "fit_out", answer: goc };
  if (/\b(showroom|van phong cong ty|lam xuong|truong hoc|benh vien|nha hang)\b/.test(kd) && /\b(hop|phu hop|lam|mo)\b/.test(kd)) return { question: "muc_dich", answer: goc };
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
  dien_tich_tim_tuong: "co_ban", tho_cu: "co_ban", gia: "co_ban", gap: "co_ban", mat_tien: "co_ban",
  huong: "phu", quy_hoach: "phu", nam_xay: "phu",
};
const LIEN_QUAN: Record<string, string[]> = {
  mat_tien: ["dien_tich_dat", "dien_tich", "dien_tich_tim_tuong", "tho_cu"],
  dien_tich: ["mat_tien", "gia"], dien_tich_dat: ["mat_tien", "tho_cu", "gia"],
  dien_tich_tim_tuong: ["gia"], tho_cu: ["gia"],
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
  phap_ly: ["tien_coc", "tiem_nang", "hinh_anh"], tiem_nang: ["hinh_anh"],
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
  const ungVien = xep.filter((c) => nhom(c) === nhom(dau)).map((c) => c.fact_key);
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
