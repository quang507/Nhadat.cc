// tra-duong.ts — FR-212 (21/09/2026): TỪ ĐIỂN TÊN ĐƯỜNG — chọn kết quả tra `tim_duong()`.
//
// Chủ dự án 21/09: "giờ khách viết tên đường ko dấu hoặc sai 1 vài kí tự nhận ra dc
// ko" → "ok làm bảng duong đi, hẻm bỏ". Bảng `duong` (OSM, theo phường mới) nằm trong
// DB; RPC `tim_duong(p_ten, p_quan)` trả các tên khớp đúng / khớp gần (Levenshtein ≤ 2
// trên chữ bỏ dấu). File này THUẦN (không RPC, không fetch — bot/tests/ranh-gioi.mjs
// canh): quyết định từ danh sách ứng viên, thay tên trong địa chỉ, soạn câu hỏi.
//
// Ba kết quả, theo mức chắc:
//   sua  — khớp ĐÚNG sau bỏ dấu, một tên duy nhất (hoặc duy nhất trong quận đã biết):
//          viết lại theo từ điển, không hỏi — cùng chữ cái, chỉ thêm dấu / sửa hoa thường
//          ("pham the hien" → "Phạm Thế Hiển"). Đúng luật FR-208 h: không đổi chữ cái.
//   hoi  — khớp GẦN (1–2 phép sửa), MỘT ứng viên gần nhất, tên khách gõ đủ dài (≥ 6 chữ
//          cái): HỎI XÁC NHẬN rồi mới ghi (RSK-03) — "Đường mình là Phạm Thế Hiển phải
//          không anh?". Hai ứng viên cùng khoảng cách → không đoán.
//   giu  — không khớp / mơ hồ / tên quá ngắn: giữ nguyên chữ khách gõ. Từ điển Bình
//          Dương – Đồng Nai – Long An còn mỏng trên OSM, đường không có trong từ điển
//          KHÔNG có nghĩa là khách gõ sai.

export type UngVienDuong = { ten: string; khoang_cach: number; quan_cu: string[] | null; phuong: string[] | null; tinh: string[] | null };
export type KetQuaDuong = { loai: "giu" } | { loai: "sua"; ten: string } | { loai: "hoi"; ten: string };
export type GoiYDuong = { goc: string; ten: string; vi_tri: string };

const boDau = (s: string): string =>
  s.normalize("NFC").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
const khoa = (s: string): string => boDau(s).toLowerCase().replace(/\s+/g, " ").trim();
const soChuCai = (s: string): number => (boDau(s).match(/[a-z]/gi) ?? []).length;

/** Chọn kết quả từ danh sách `tim_duong` trả về cho tên khách gõ (`goc`, đã qua chuanTenDuong). */
export function chonDuong(goc: string, ungVien: UngVienDuong[] | null | undefined, quan?: string | null): KetQuaDuong {
  const k = khoa(goc);
  const ds = (ungVien ?? []).filter((u) => u && typeof u.ten === "string" && Number.isFinite(u.khoang_cach));
  if (!ds.length || k.length < 4) return { loai: "giu" };
  const trongQuan = (u: UngVienDuong) => !!quan && (u.quan_cu ?? []).includes(quan);
  // Khớp ĐÚNG (khoảng cách 0): chỉ khác dấu / hoa thường.
  const dung = ds.filter((u) => u.khoang_cach === 0 && khoa(u.ten) === k);
  if (dung.length) {
    const chon = dung.length === 1 ? dung[0] : (dung.filter(trongQuan).length === 1 ? dung.find(trongQuan)! : null);
    if (!chon) return { loai: "giu" };
    return chon.ten === goc.trim() ? { loai: "giu" } : { loai: "sua", ten: chon.ten };
  }
  // Khớp GẦN: tên đủ dài, ứng viên gần nhất là duy nhất (hoặc duy nhất trong quận đã biết).
  if (soChuCai(goc) < 6) return { loai: "giu" };
  const gan = ds.filter((u) => u.khoang_cach >= 1 && u.khoang_cach <= 2).sort((a, b) => a.khoang_cach - b.khoang_cach);
  if (!gan.length) return { loai: "giu" };
  const tot = gan.filter((u) => u.khoang_cach === gan[0].khoang_cach);
  // Lệch quá 1 phép sửa mà chuỗi ngắn (6–7 chữ cái) thì thôi — "Le Lai" ↔ "Le Loi" là hai đường khác.
  if (gan[0].khoang_cach === 2 && soChuCai(goc) < 9) return { loai: "giu" };
  const chon = tot.length === 1 ? tot[0] : (tot.filter(trongQuan).length === 1 ? tot.find(trongQuan)! : null);
  return chon ? { loai: "hoi", ten: chon.ten } : { loai: "giu" };
}

/**
 * Cắt TÊN ĐƯỜNG trần từ cụm địa chỉ đã qua tenDuong()/chuanTenDuong(): bỏ "ở/tại (đường)" đứng đầu, dừng
 * trước phường/quận/hẻm/xã/dấu phẩy. "ở đường trần đình trọng quận 5" → "trần đình trọng". Bắn thật 21/09
 * (mau-tdt): câu trả lời địa chỉ dài đi nguyên cụm vào tim_duong nên không khớp gì.
 */
export function catTenDuong(cum: string): string {
  let s = (cum ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  s = s.replace(/^(?:nằm ở|nam o|ở|o|tại|tai)\s+/iu, "").replace(/^(?:đường|duong|đ\.)\s+(?!(?:số|so)?\s*\d)/iu, "");
  const m = /[,;.(]|(?<![\p{L}])(?:phường|phuong|quận|quan|hẻm|hem|hxh|xã|xa(?!\s+l[oộ])|gần|gan|khu|p\.?\s*\d|q\.?\s*\d)(?![\p{L}])/iu.exec(s);
  if (m) s = s.slice(0, m.index);
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Thay tên đường trong địa chỉ khách gõ: "hem 4m pham the hien p4" + ("pham the hien" →
 * "Phạm Thế Hiển") = "hem 4m Phạm Thế Hiển p4". So bỏ dấu, không phân biệt hoa thường;
 * không thấy thì trả nguyên địa chỉ.
 */
export function theTenDuong(viTri: string, goc: string, moi: string): string {
  const vt = (viTri ?? "").normalize("NFC");
  const g = (goc ?? "").normalize("NFC").trim();
  if (!g) return vt;
  const i = boDau(vt).toLowerCase().indexOf(boDau(g).toLowerCase());
  if (i < 0) return vt;
  return vt.slice(0, i) + moi + vt.slice(i + g.length);
}

/** Câu hỏi xác nhận trước khi ghi (mẫu `duong@goi_y` trong cau_hoi_mau, sửa được ở Dashboard). */
export function cauXacNhanDuong(mau: string, cachGoi: string, goc: string, ten: string): string {
  const Ac = cachGoi.charAt(0).toUpperCase() + cachGoi.slice(1);
  return mau.replace(/\{ac\}/g, cachGoi).replace(/\{Ac\}/g, Ac).replace(/\{goc\}/g, goc.trim()).replace(/\{ten\}/g, ten.trim());
}
