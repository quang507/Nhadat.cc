// khop-phuong.ts — KIỂM tên phường AI đọc ra (30/09/2026).
//
// Chủ dự án 30/09 (chat thử): "sao lại nhận tên đúng chữ mới nhận, phải dùng AI để xem chứ, xóa hết mấy luật kia đi, để
// AI nhận mới thông minh" → "dùng api key cho hết các trường hợp". Nên: KHÔNG còn luật dò tên phường trong câu khách.
// AI đọc câu (có danh sách phường mới + cũ trong câu lệnh — `danhSachPhuongChoAi`) và trả tên phường MỚI chuẩn, kể cả
// khi khách nói tên cũ ("Vĩnh Lộc B" → Tân Vĩnh Lộc), gõ sai, thiếu chữ "xã / phường". File này chỉ làm việc máy làm
// chắc: (1) tên AI trả có phải phường có thật (`phuongChuan`); (2) câu khách có THẬT nhắc tới phường đó không — tên
// mới hoặc một tên cũ của nó, cho phép lệch 1–2 chữ cái (`cauNhacPhuong`). AI bịa / cắt tên ("An Hội") thì trượt kiểm.
//
// THUẦN: không fetch, không RPC (bot/tests/ranh-gioi.mjs canh). Dữ liệu ở ds-phuong.ts.
import { PHUONG_CU, PHUONG_MOI } from "./ds-phuong.ts";

export type Phuong = { ten: string; ten_day_du?: string | null; quan_cu?: string | null };

const boDau = (s: string): string =>
  s.normalize("NFC").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
/** Bỏ dấu, chữ thường, bỏ dấu câu, gộp khoảng trắng. */
const phang = (s: string): string =>
  boDau(s).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const TIEN_TO = /^(?:phuong|p|xa|dac khu|thi tran|tt)\s+/;
const DEM_CUOI = /(?:\s+(?:nha|nhe|nhen|hen|a|em|anh|chi|chau|co|chu|bac|di|ong|ba|oi|do|day|luon|roi|ne|nghen|ha))+$/;
const tenTran = (s: string | null | undefined): string => phang(s ?? "").replace(TIEN_TO, "").replace(DEM_CUOI, "").trim();

const MOI: Phuong[] = PHUONG_MOI.map(([ten, ten_day_du, quan_cu]) => ({ ten, ten_day_du, quan_cu }));
const MOI_THEO_KHOA = new Map(MOI.map((w) => [phang(w.ten), w]));
/** Tên mới (ngắn) → các tên (trần) khách có thể nói: tên mới + mọi tên cũ gộp vào nó. */
const TEN_CUA: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>(MOI.map((w) => [w.ten, [phang(w.ten)]]));
  for (const [cu, , moi] of PHUONG_CU) {
    const k = tenTran(cu);
    if (k && !/^\d+$/.test(k)) m.get(moi)?.push(k);
  }
  return m;
})();

/** Tên AI trả ("Phường Tân Vĩnh Lộc", "tân vĩnh lộc", "Xã Vĩnh Lộc") → phường MỚI có thật; không có → null. */
export function phuongChuan(ten: string | null | undefined): Phuong | null {
  const k = tenTran(ten);
  if (!k || /^\d+$/.test(k)) return null;
  return MOI_THEO_KHOA.get(k) ?? null;
}

const lev = (a: string, b: string): number => {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
};

/**
 * Câu khách (hoặc trích dẫn AI đưa) có NHẮC tới phường mới `w` không — bằng tên mới hoặc một tên cũ của nó, đúng số chữ,
 * lệch tối đa 1 chữ cái (tên ≤ 8 ký tự) / 2 chữ cái (dài hơn). Đây là bằng chứng, không phải luật đọc: AI chọn, máy xác nhận.
 */
export function cauNhacPhuong(cau: string | null | undefined, w: Phuong): boolean {
  const tu = phang(cau ?? "").split(" ").filter(Boolean);
  for (const k of TEN_CUA.get(w.ten) ?? [phang(w.ten)]) {
    const n = k.split(" ").length;
    const tran = k.length <= 8 ? 1 : 2;
    for (let i = 0; i + n <= tu.length; i++) {
      const doan = tu.slice(i, i + n).join(" ");
      if (!(doan === k || (k.length >= 5 && Math.abs(doan.length - k.length) <= tran && lev(doan, k) <= tran))) continue;
      // "Vĩnh Lộc B" chứa "vĩnh lộc" — nhưng "vĩnh lộc b" là tên của phường KHÁC (Tân Vĩnh Lộc): không tính là nhắc.
      const dai = tu[i + n];
      if (dai && /^[a-d]$/.test(dai) && (TEN_THUOC.get(`${k} ${dai}`) ?? w.ten) !== w.ten) continue;
      return true;
    }
  }
  return false;
}
/** Tên (trần) → phường mới nó thuộc (tên mới + tên cũ). */
const TEN_THUOC: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [moi, ds] of TEN_CUA) for (const k of ds) if (!m.has(k)) m.set(k, moi);
  return m;
})();

/**
 * Tên AI trả là tên CŨ ("Hiệp Bình Chánh", "Thị trấn Nhà Bè") — AI được dặn đổi sang tên mới nhưng có lúc giữ tên khách
 * nói. Tên cũ chỉ về MỘT phường mới (hoặc chỉ một phần "toàn bộ") → phường mới đó; phường cũ bị chia → null.
 */
export function phuongTuTenCu(ten: string | null | undefined): Phuong | null {
  const k = tenTran(ten);
  if (!k || /^\d+$/.test(k)) return null;
  const dong = PHUONG_CU.filter(([cu]) => tenTran(cu) === k);
  let moi = [...new Set(dong.map(([, , m]) => m))];
  if (moi.length > 1) moi = [...new Set(dong.filter(([, , , tb]) => tb === 1).map(([, , m]) => m))];
  return moi.length === 1 ? MOI.find((w) => w.ten === moi[0]) ?? null : null;
}

/** Trích dẫn có nhắc MỘT phường có thật nào không (dùng để bắt AI trả tên cắt / bịa khi khách nói tên thật). */
export function phuongTrongTrich(cau: string | null | undefined): boolean {
  return MOI.some((w) => cauNhacPhuong(cau, w));
}

/** Tên AI trả hợp lệ VÀ câu khách có nhắc → phường mới; không thì null (không ghi). */
export function chotPhuongAi(tenAi: string | null | undefined, cauKhach: string | null | undefined): Phuong | null {
  const w = phuongChuan(tenAi);
  return w && cauNhacPhuong(cauKhach, w) ? w : null;
}

/**
 * Khối chữ đưa vào câu lệnh AI bóc tách: mọi phường mới (kèm quận cũ) và bảng tên cũ → mới. Nằm trong phần system có
 * cache_control, nên chỉ tính tiền đầy đủ lần đầu mỗi 5 phút.
 */
export function danhSachPhuongChoAi(cau?: string | null): string {
  // 30/09/2026 (bắn thật thu-groq-02): cả 655 tên (~18.000 ký tự) nằm trong câu lệnh bóc tách → câu lệnh ~36.000 ký tự,
  // Groq bản miễn phí trả "Request too large" (413, trần chữ mỗi phút), Gemini đang 503 → AI bóc tách chết cả chuỗi. Có câu
  // khách thì chỉ gửi các phường câu đó NHẮC TỚI (tên mới hoặc cũ, lệch 1–2 chữ cái — `cauNhacPhuong`); không nhắc → "".
  const chon = cau == null ? MOI : MOI.filter((w) => cauNhacPhuong(cau, w));
  if (!chon.length) return "";
  const tenChon = new Set(chon.map((w) => w.ten));
  const moi = chon.map((w) => `${w.ten_day_du} (${w.quan_cu})`).join("; ");
  const theoMoi = new Map<string, string[]>();
  for (const [cu, quan, moiTen, toanBo] of PHUONG_CU) {
    if (!tenChon.has(moiTen)) continue;
    const ds = theoMoi.get(moiTen) ?? [];
    ds.push(`${cu} ${quan.replace(/^(Quận|Huyện|Thành phố|Thị xã) /, "")}${toanBo ? "" : "*"}`);
    theoMoi.set(moiTen, ds);
  }
  const cu = [...theoMoi].map(([m, ds]) => `${m} ← ${ds.join(", ")}`).join("\n");
  return `PHƯỜNG / XÃ MỚI TP.HCM (từ 07/2025; trong ngoặc là quận / huyện cũ):\n${moi}\n\n` +
    `TÊN CŨ → PHƯỜNG MỚI (dấu * = phường cũ bị chia, chỉ một phần vào phường này):\n${cu}`;
}

/** Tên phường đầy đủ để ghi cột ("Phường An Hội Tây"). */
export function tenDayDu(w: Phuong): string {
  return (w.ten_day_du ?? "").trim() || `Phường ${w.ten}`;
}

/**
 * Chữ khách có phải là một TÊN phường chữ (để thử tìm theo nghĩa khi AI không chốt được) — không phải phường số, không
 * phải cả câu dài. "an hoi tai" → true; "phường 4" → false.
 */
export function laTenPhuongChu(s: string | null | undefined): boolean {
  const d = tenTran(s);
  return !!d && !/\d/.test(d) && /[a-z]{2}/.test(d) && d.split(" ").length <= 5;
}

/**
 * Kết quả tìm theo NGHĨA đủ chắc để SỬA LUÔN (chủ dự án 30/09: "nhắc tới gần đúng sẽ biết cái nào đúng và sửa vào, kết
 * hợp với vị trí"): gần nghĩa ≥ 0,9, bỏ xa ứng viên thứ hai ≥ 0,03, VÀ quận cũ khớp quận đã biết của căn nhà.
 */
export function nghiaDuChac(top: { do_gan: number; quan_cu?: string | null } | null | undefined, nhi: { do_gan: number } | null | undefined, quanBiet: string | null | undefined): boolean {
  if (!top || !quanBiet || top.quan_cu !== quanBiet) return false;
  return top.do_gan >= 0.9 && (!nhi || top.do_gan - nhi.do_gan >= 0.03);
}

/** Câu HỎI XÁC NHẬN phường tìm theo nghĩa (vector) — không bao giờ ghi thẳng. */
export function cauHoiPhuongGan(cachGoi: string, w: Phuong): string {
  return `Dạ ${cachGoi} nói ${tenDayDu(w)}${w.quan_cu ? ` (${w.quan_cu} cũ)` : ""} đúng không ạ?`;
}

/** Tên quận / huyện / TP cũ (trần) — "binh thanh", "go vap", "thu duc", "nha be". Phường mới trùng tên quận chỉ tính khi
 * khách nói rõ "phường / xã" trước tên. */
const TEN_QUAN: ReadonlySet<string> = new Set(
  [...PHUONG_MOI.map((r) => r[2]), ...PHUONG_CU.map((r) => r[1]), "Sài Gòn"]
    .map((q) => phang(q).replace(/^(?:quan|huyen|thanh pho|thi xa|tp)\s+/, "")),
);
/** Mỗi tên (trần) khách có thể nói → phường mới + các quận (trần, có tiền tố "quan 2", "thanh pho thu duc") của nó. */
const TEN_DO: ReadonlyArray<{ k: string; moi: string; quan: ReadonlySet<string> }> = (() => {
  const quanMoi = new Map(MOI.map((w) => [w.ten, phang(w.quan_cu ?? "")]));
  const ds = MOI.map((w) => ({ k: phang(w.ten), moi: w.ten, quan: new Set([quanMoi.get(w.ten) ?? ""]) }));
  for (const [cu, quan, moi] of PHUONG_CU) {
    const k = tenTran(cu);
    if (k && !/^\d+$/.test(k)) ds.push({ k, moi, quan: new Set([phang(quan), quanMoi.get(moi) ?? ""]) });
  }
  return ds.filter((d) => d.k.split(" ").length >= 2);
})();
const TRUOC_KHONG_PHAI_PHUONG = /^(?:duong|d|hem|h|ngo|kiet|cau|cu|an|tp|pho|quan|q|huyen|thi)$/;

/**
 * LƯỚI ĐỠ khi AI không trả phường (AI im / model lỗi / AI bỏ sót — bắn thật 30/09: "bán căn hộ bên thảo điền quận 2 cũ"
 * chỉ ra Quận 2). Câu khách nhắc ĐÚNG CHỮ (không lệch) một tên phường mới hoặc cũ, ≥ 2 tiếng, không đứng sau "đường /
 * hẻm / quận…", tên trùng tên quận thì phải có chữ "phường / xã" đứng trước; đã biết quận thì phường phải thuộc quận đó.
 * Ra đúng MỘT phường mới mới trả; hai phường trở lên (phường cũ bị chia, hai tên trong câu) → null, để bot hỏi.
 * Đây không phải luật đọc thay AI (chủ dự án 30/09): AI vẫn đọc trước, lưới này chỉ chạy khi AI không nói gì.
 */
export function phuongNhacTrongCau(cau: string | null | undefined, quan?: string | null): Phuong | null {
  const tu = phang(cau ?? "").split(" ").filter(Boolean);
  const qk = quan ? phang(quan) : null;
  const trung: Array<{ i: number; n: number; moi: string }> = [];
  for (const d of TEN_DO) {
    const kt = d.k.split(" ");
    const n = kt.length;
    for (let i = 0; i + n <= tu.length; i++) {
      if (tu.slice(i, i + n).join(" ") !== d.k) continue;
      const truoc = tu[i - 1] ?? "";
      if (TRUOC_KHONG_PHAI_PHUONG.test(truoc)) continue;
      if (TEN_QUAN.has(d.k) && !/^(?:phuong|p|xa|tt)$/.test(truoc) && !(truoc === "tran" && tu[i - 2] === "thi")) continue;
      const dai = tu[i + n];
      if (dai && /^[a-d]$/.test(dai) && (TEN_THUOC.get(`${d.k} ${dai}`) ?? d.moi) !== d.moi) continue;
      if (qk && !d.quan.has(qk)) continue;
      trung.push({ i, n, moi: d.moi });
    }
  }
  // Tên dài nằm trùm tên ngắn ("tân hưng thuận" trùm "tân hưng") → bỏ tên ngắn.
  const giu = trung.filter((a) => !trung.some((b) => b !== a && b.n > a.n && b.i <= a.i && a.i + a.n <= b.i + b.n));
  const moi = [...new Set(giu.map((a) => a.moi))];
  return moi.length === 1 ? MOI.find((w) => w.ten === moi[0]) ?? null : null;
}

const TEN_HANH_CHINH: ReadonlyArray<string> = [...new Set([
  ...TEN_DO.map((d) => d.k), ...MOI.map((w) => phang(w.ten)), ...TEN_QUAN, "ho chi minh", "hcm", "sai gon", "sg", "long an",
])].filter((k) => k && !/^\d+$/.test(k)).sort((a, b) => b.length - a.length);
/**
 * Câu trả lời ĐỊA CHỈ chỉ gồm tên đơn vị hành chính — phường / xã (mới, cũ), quận / huyện, "quận 2 cũ", "tp hcm" — không có
 * đường, số nhà, hẻm (bắn thật 30/09: "nhà ở vĩnh lộc b bình chánh, hẻm 5m" → ô "vị trí cụ thể" = "vĩnh lộc b bình chánh",
 * rác cho admin). Chữ nào không phải tên hành chính / chữ đệm thì là địa chỉ thật → false.
 */
export function chiLaDonViHanhChinh(s: string | null | undefined): boolean {
  let t = ` ${phang(s ?? "")} `;
  if (!t.trim()) return false;
  let co = false;
  t = t.replace(/\s(?:quan|q|phuong|p|xa)\s*\d{1,2}(?=\s)|\s[qp]\d{1,2}(?=\s)/g, () => { co = true; return " "; });
  for (const k of TEN_HANH_CHINH) {
    if (!t.includes(` ${k} `)) continue;
    co = true;
    t = t.split(` ${k} `).join("  ");
  }
  const con = t.replace(/\s(?:nha|can|o|tai|thuoc|ben|khu|vuc|gan|phuong|p|xa|quan|q|huyen|tp|thanh|pho|thi|tran|tt|tinh|cu|moi|nhe|nhen|a|em|anh|chi|oi|do|day|ne|luon|va|voi)(?=\s)/g, " ");
  return co && con.trim() === "";
}
