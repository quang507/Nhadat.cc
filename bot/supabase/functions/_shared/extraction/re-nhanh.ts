// FR-223 — RẼ NHÁNH câu hỏi theo CÂU TRẢ LỜI (chủ dự án 24/09/2026: "phải nhanh nhạy để rẽ nhánh nếu câu hỏi
// trước trả lời gì thì sau đó sẽ có bộ câu hỏi gì … không hẳn là pháp lý mà các câu rẽ nhánh khác nữa").
//
// `chonCauKe` chọn câu kế theo CHỦ ĐỀ vừa nói (LIEN_QUAN: nói pháp lý → hỏi ảnh). Ở đây chọn theo NỘI DUNG câu
// trả lời: "sổ hồng riêng" và "chưa có sổ" không còn dẫn tới cùng một câu. Code quyết định HỎI GÌ; model chỉ
// viết lại câu cho tự nhiên (FR-222 e).
//
// Hàm THUẦN (luật tầng bóc tách — không model, không DB): đầu vào là loại nhà + các fact đã ghi + vài cột
// của tin; đầu ra là câu phải THÊM vào danh sách còn thiếu và câu phải BỎ khỏi đó. Thêm luật = thêm một dòng
// vào RE_NHANH + ca trong bot/tests/re-nhanh.mjs.

export type NgCanhReNhanh = {
  loai: string | null;
  deal: string | null;
  facts: Array<{ question: string; answer: string | null }>;
  legal_status?: string | null;
  has_completion?: boolean | null;
  rent_income_vnd?: number | string | null;
};
export type CauThem = { fact_key: string; priority: number; nhom: string };

const boDau = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

const NHA_CO_XAY = ["nha_pho", "biet_thu", "nha_cap4", "toa_nha"];
const SO_RIENG = /\b(?:so hong|so do|shr|srh|so rieng|so hong rieng|so do rieng)\b/;
const CHUA_SO = /\b(?:chua co so|chua ra so|cho so|cho ra so|dang lam so|hdmb|hop dong mua ban|vi bang|giay tay|chua so)\b/;
const SO_CHUNG = /\b(?:so chung|dong so huu|chung so|dung ten chung|so dung chung)\b/;
const DANG_CHO_THUE = /\b(?:dang cho thue|dang thue|dang kinh doanh|hop dong thue|khach thue|cho [a-z0-9 ]{1,30} thue)\b/;
const CO_HAN_HD = /\b(?:den|toi|het han|het)\s*(?:nam\s*)?(?:20\d\d|\d{1,2}\/20\d\d)\b|\b\d+\s*nam\s*nua\b/;
const NHA_NAT = /\b(?:nha nat|nha cu nat|dap di xay lai|dap xay lai|mua dat tang nha|dat trong|chua xay)\b/;
const THO_CU_DU = /\b(?:100|full|toan bo|het|du)\b/;

type NgCanhLuat = { loai: string; deal: string; phap: string; tatCa: string; daHoi: Set<string>; c: NgCanhReNhanh };
/** Một Ý CHÍNH của nhánh: khoá fact + dấu hiệu chủ nhà ĐÃ nói ý đó (có thì không hỏi). */
type YChinh = CauThem & { daBiet?: (x: NgCanhLuat) => boolean };

type Luat = {
  id: string;
  /** Tên nhánh — đưa cho model biết đang hỏi thêm về chuyện gì (FR-223 b: "lai", model chọn cách nói). */
  ten: string;
  /** Mô tả để người đọc bảng hiểu vì sao có dòng này. */
  vi: string;
  khi: (c: NgCanhLuat) => boolean;
  /** Câu THÊM chỉ hỏi NGAY SAU khi chủ nhà vừa trả lời một trong các câu này hoặc một ý của CHÍNH nhánh này
   *  ("rẽ nhánh" — không thành cổng chặn bản nháp ở lượt khác). Câu BỎ thì bỏ ở mọi lượt. */
  sau?: string[];
  /** Các ý chính cần thu của nhánh, theo thứ tự hỏi; ý đã biết (fact có sẵn hoặc `daBiet`) thì bỏ qua. */
  them?: YChinh[];
  bo?: string[];
};

const co = (re: RegExp) => ({ tatCa }: NgCanhLuat) => re.test(tatCa);
// Tiền thuê ĐÃ nói: "thuê 30 triệu", "30tr/tháng". Không vượt dấu phẩy và chỉ đơn vị triệu — bắn thật 24/09 (rn-test-g):
// "đang cho ngân hàng thuê, giá 25 tỷ" từng bị đọc thành tiền thuê 25 tỷ nên bot bỏ qua câu hỏi tiền thuê.
const THUE_CO_SO = /\b(?:thue|cho thue|thu ve|thu)\b[^.·,;]{0,20}?\d+(?:[.,]\d+)?\s*(?:trieu|tr)\b|\d+(?:[.,]\d+)?\s*(?:trieu|tr)\b\s*(?:\/|mot|moi)\s*thang/;

/** Bảng rẽ nhánh. Thứ tự không quan trọng: luật nào khớp thì cộng dồn thêm/bỏ; BỎ thắng THÊM. Nguồn: chủ dự án 24/09/2026
 *  (duyệt bảng nháp + chọn kiểu "lai": code chọn nhánh và ý chính, model hỏi từng ý còn thiếu cho tự nhiên). Danh sách ý
 *  chính mỗi nhánh là [giả định BA] — sửa ở đây + ca trong bot/tests/re-nhanh.mjs. */
export const RE_NHANH: Luat[] = [
  {
    id: "so_rieng_hoi_hoan_cong",
    ten: "sổ riêng — hoàn công",
    vi: "Nhà có xây + sổ hồng/sổ đỏ riêng, chưa nhắc hoàn công, không đang cho thuê → hỏi hoàn công",
    khi: ({ loai, deal, phap, tatCa, c }) =>
      NHA_CO_XAY.includes(loai) && deal !== "cho_thue" && SO_RIENG.test(phap) && !CHUA_SO.test(phap) && !SO_CHUNG.test(phap) &&
      !/\bhoan cong\b/.test(tatCa) && c.has_completion == null && !DANG_CHO_THUE.test(tatCa) && !(Number(c.rent_income_vnd ?? 0) > 0),
    sau: ["phap_ly"],
    them: [{ fact_key: "hoan_cong", priority: 16.2, nhom: "co_ban" }],
  },
  {
    id: "chua_so",
    ten: "chưa có sổ",
    vi: "Chưa có sổ / HĐMB / vi bằng / giấy tay → thu: giấy tờ đang có, dự kiến bao giờ ra sổ; không hỏi hoàn công",
    khi: ({ phap }) => CHUA_SO.test(phap),
    sau: ["phap_ly"],
    them: [
      { fact_key: "giay_to_hien_co", priority: 16.2, nhom: "co_ban", daBiet: co(/\b(?:hdmb|hop dong mua ban|vi bang|giay tay|hop dong dat coc|hop dong gop von|so tay)\b/) },
      { fact_key: "du_kien_ra_so", priority: 16.3, nhom: "co_ban",
        daBiet: co(/\b(?:ra so|co so|lay so|nhan so)\b[^.·]{0,20}\b(?:thang|nam|cuoi|dau|quy|tuan|sap)\b|\b(?:thang|cuoi nam|dau nam|quy)\b[^.·]{0,15}\b(?:ra so|co so)\b/) },
    ],
    bo: ["hoan_cong"],
  },
  {
    id: "can_ho_chua_so",
    ten: "căn hộ chưa có sổ",
    vi: "Căn hộ chưa có sổ → thu thêm: đã nhận bàn giao chưa",
    khi: ({ loai, phap }) => loai === "chung_cu" && CHUA_SO.test(phap),
    sau: ["phap_ly", "giay_to_hien_co", "du_kien_ra_so"],
    them: [{ fact_key: "ban_giao", priority: 16.4, nhom: "co_ban", daBiet: co(/\b(?:da nhan nha|nhan ban giao|da ban giao|dang o|chua nhan nha)\b/) }],
  },
  {
    id: "so_chung",
    ten: "sổ chung / đồng sở hữu",
    vi: "Sổ chung / đồng sở hữu → thu: đứng tên chung với ai, các bên đồng ý bán chưa; không hỏi hoàn công",
    khi: ({ phap }) => SO_CHUNG.test(phap),
    sau: ["phap_ly"],
    them: [
      { fact_key: "dong_so_huu_voi", priority: 16.2, nhom: "co_ban", daBiet: co(/\b(?:chung|dung ten)\s+(?:voi|cua)\s+\w+/) },
      { fact_key: "dong_y_ban", priority: 16.3, nhom: "co_ban", daBiet: co(/\b(?:dong y ban|thong nhat ban|deu dong y|da dong y|ca nha dong y)\b/) },
    ],
    bo: ["hoan_cong"],
  },
  {
    id: "dang_cho_thue",
    ten: "nhà đang cho thuê",
    vi: "Tin BÁN đang cho thuê / kinh doanh = nhà đã hoàn thiện (chủ dự án 24/09) → không hỏi hiện trạng, nội thất, hoàn công; thu: hợp đồng thuê tới khi nào, tiền thuê mỗi tháng",
    khi: ({ deal, tatCa, c }) => deal !== "cho_thue" && (DANG_CHO_THUE.test(tatCa) || Number(c.rent_income_vnd ?? 0) > 0),
    sau: ["phap_ly", "hien_trang", "doanh_thu", "kien_thuc", "bo_sung", "tiem_nang"],
    them: [
      // 24/09/2026 (bắn 10 tin): toà nhà CHDV / nhà trọ "đang thu 250 triệu/tháng" là cho thuê TỪNG PHÒNG — không có một
      // hợp đồng thuê chung để hỏi hạn. Chỉ hỏi khi chữ khách nói rõ đang cho (một bên) thuê.
      { fact_key: "han_hop_dong_thue", priority: 16.4, nhom: "co_ban",
        daBiet: (x) => CO_HAN_HD.test(x.tatCa) || /\b(?:tung phong|nhieu phong|khong co hop dong tong)\b/.test(x.tatCa) ||
          (["toa_nha", "phong_tro"].includes(x.loai) && !DANG_CHO_THUE.test(x.tatCa)) },
      { fact_key: "doanh_thu", priority: 16.5, nhom: "co_ban", daBiet: (x) => Number(x.c.rent_income_vnd ?? 0) > 0 || THUE_CO_SO.test(x.tatCa) },
    ],
    // 24/09/2026 (chủ dự án: "đã bảo nhà cho thuê 400tr tháng rồi còn [đòi] thêm tiềm năng sử dụng"): đang cho
    // thuê / kinh doanh LÀ tiềm năng sử dụng, không hỏi lại.
    bo: ["hien_trang", "noi_that", "hoan_cong", "tiem_nang"],
  },
  {
    id: "nha_nat",
    ten: "nhà nát / đất trống",
    vi: "Nhà nát / đất trống / đập xây lại → không hỏi phòng ngủ, toilet, nội thất, tầng phụ, hoàn công",
    khi: ({ tatCa }) => NHA_NAT.test(tatCa),
    bo: ["so_phong_ngu", "so_wc", "noi_that", "tang_phu", "hoan_cong", "hien_trang"],
  },
  {
    id: "tho_cu_mot_phan",
    ten: "đất thổ cư một phần",
    vi: "Đất có thổ cư một phần → hỏi có lên thổ cư được không",
    khi: ({ loai, c, daHoi }) => ["dat", "dat_nong_nghiep"].includes(loai) && daHoi.has("tho_cu") &&
      !THO_CU_DU.test(boDau(c.facts.find((f) => f.question === "tho_cu")?.answer ?? "")),
    sau: ["tho_cu"],
    them: [{ fact_key: "len_tho_cu", priority: 15.5, nhom: "co_ban" }],
  },
];

/** Nhánh chứa một khoá (để lệnh model nói rõ đang hỏi thêm chuyện gì + các ý chính của nhánh). */
export function nhanhCuaKhoa(key: string): { ten: string; cacY: string[] } | null {
  const l = RE_NHANH.find((x) => (x.them ?? []).some((t) => t.fact_key === key));
  return l ? { ten: l.ten, cacY: (l.them ?? []).map((t) => t.fact_key) } : null;
}

/** Câu phải thêm / bỏ cho một tin, theo các câu trả lời đã ghi. Câu đã có fact thì không thêm lại.
 *  `vuaNoi` = câu chủ nhà vừa trả lời lượt này; bỏ trống = chỉ tính câu BỎ (không thêm câu nhánh). */
export function reNhanh(c: NgCanhReNhanh, vuaNoi?: string[]): { them: CauThem[]; bo: Set<string>; luat: string[] } {
  const daHoi = new Set(c.facts.map((f) => f.question));
  // Pháp lý = fact pháp lý + tin vừa nhắn (khi vừa trả lời câu pháp lý, đáp án đã cắt có thể mất nửa sau).
  const phap = boDau(c.facts.filter((f) => f.question === "phap_ly" || f.question === "_tin_nay").map((f) => f.answer ?? "").join(" ") +
    " " + (c.legal_status ?? "").replace(/_/g, " "));
  const tatCa = boDau(c.facts.map((f) => f.answer ?? "").join(" · "));
  const ctx: NgCanhLuat = { loai: c.loai ?? "", deal: c.deal ?? "", phap, tatCa, daHoi, c };
  const them = new Map<string, CauThem>();
  const bo = new Set<string>();
  const luat: string[] = [];
  for (const l of RE_NHANH) {
    if (!l.khi(ctx)) continue;
    luat.push(l.id);
    // Vừa trả lời câu kích HOẶC một ý của chính nhánh này → hỏi tiếp ý còn thiếu kế tiếp (một ý mỗi lượt).
    const kich = [...(l.sau ?? []), ...(l.them ?? []).map((t) => t.fact_key)];
    const reNgay = vuaNoi === undefined || kich.some((k) => vuaNoi.includes(k));
    if (reNgay) {
      for (const t of l.them ?? []) {
        if (daHoi.has(t.fact_key) || them.has(t.fact_key) || t.daBiet?.(ctx)) continue;
        const { daBiet: _b, ...cau } = t;
        them.set(t.fact_key, cau);
      }
    }
    for (const b of l.bo ?? []) bo.add(b);
  }
  return { them: [...them.values()].filter((t) => !bo.has(t.fact_key)), bo, luat };
}

/** Áp rẽ nhánh lên danh sách còn thiếu (từ view `listing_missing_facts`): bỏ câu thừa; câu nhánh vừa kích
 *  (theo `vuaNoi`) đứng ĐẦU danh sách để `chonCauKe` hỏi ngay (priority −1, nhóm cơ bản). */
export function apReNhanh<T extends { fact_key: string; priority?: number | null; nhom?: string | null }>(
  thieu: T[], c: NgCanhReNhanh, vuaNoi: string[] = [],
): Array<T | CauThem> {
  const { them, bo } = reNhanh(c, vuaNoi);
  const giu: Array<T | CauThem> = thieu.filter((t) => !bo.has(t.fact_key) && !them.some((x) => x.fact_key === t.fact_key));
  return [...them.map((t) => ({ ...t, priority: -1, nhom: "co_ban" })), ...giu];
}

/** Có cần đọc DB để rẽ nhánh không: câu vừa trả lời kích một luật THÊM, hoặc danh sách có câu mà luật nào đó BỎ. */
export function canReNhanh(thieu: Array<{ fact_key: string }>, vuaNoi: string[] = []): boolean {
  const coBo = new Set(RE_NHANH.flatMap((l) => l.bo ?? []));
  return RE_NHANH.some((l) => [...(l.sau ?? []), ...(l.them ?? []).map((t) => t.fact_key)].some((k) => vuaNoi.includes(k))) ||
    thieu.some((t) => coBo.has(t.fact_key));
}
