// tim-moc.ts — tìm tin gần MỐC khách muốn ở gần (11/09/2026).
//
// Ba nguồn mốc, rẻ trước đắt sau:
//   1. `tin_gan_moc` (SQL): tien_ich OSM (nạp 3 km quanh mỗi tin) + projects đã
//      có toạ độ, khớp loại và/hoặc tên;
//   2. có TÊN mà kho mình không có mốc nào khớp (`co_moc` = false) → tra
//      Nominatim đúng tên đó, nhớ vào tien_ich cho lần sau, rồi đo lại.
// Khoảng cách luôn do SQL tính — model không bao giờ tự nói số mét.
import { type GanTienIch, kdTen, TEN_LOAI } from "./extraction/tien-ich.ts";
import { trongVung } from "./geocode.ts";

const LOAI_OSM = new Set(["benh_vien", "truong_hoc", "cho", "sieu_thi", "cong_vien"]);

export type TinGan = { code: string; moc: string; khoang_cach_m: number };
type KqRpc = { data: unknown; error: { message: string } | null };
type Db = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<KqRpc>;
  // deno-lint-ignore no-explicit-any
  from: (t: string) => any;
};

const boDau = (s: string): string =>
  s.normalize("NFC").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");

/** Tra một địa danh trong TP.HCM. Chặn kết quả mức thành phố/tỉnh (câu quá rộng). */
// 25/09/2026 (FR-227): gọi thẳng từ edge thì Nominatim trả "Access denied" — nhờ DB gọi qua RPC `tra_nominatim`.
export async function traDiaDanh(db: Db, cum: string): Promise<{ osm_id: string; ten: string; lat: number; lng: number } | null> {
  for (const q of [`${cum}, Thành phố Hồ Chí Minh`, `${boDau(cum)}, Ho Chi Minh City`]) {
    try {
      const { data, error } = await db.rpc("tra_nominatim", { p_q: q, p_cho_giay: 4 });
      if (error) continue;
      const r = Array.isArray(data) ? data[0] : null;
      if (!r || /^(city|state|province|country|municipality|region)$/.test(String(r.addresstype ?? r.type ?? ""))) continue;
      const lat = Number(r.lat), lng = Number(r.lon);
      if (!trongVung(lat, lng)) continue;
      return { osm_id: `${r.osm_type ?? "place"}/${r.osm_id ?? r.place_id}`, ten: String(r.name || cum), lat, lng };
    } catch {
      // mạng chậm / bị chặn: thử câu sau, hết thì coi như không tìm được mốc
    }
  }
  return null;
}

/**
 * Tin đang lên kệ gần mốc `gan`. `loi` = RPC hỏng (nơi gọi ghi sổ, bỏ lọc);
 * `khongThayMoc` = có tên nhưng không định vị được nơi đó (bot hỏi lại khách).
 */
export async function timTinGanMoc(
  db: Db,
  gan: GanTienIch,
  deal: string | null,
): Promise<{ tin: TinGan[]; loi?: string; khongThayMoc?: boolean }> {
  const goi = (lat: number | null = null, lng: number | null = null, ten: string | null = null) =>
    db.rpc("tin_gan_moc", {
      p_loai: gan.loai, p_ten_re: gan.ten_re, p_lat: lat, p_lng: lng, p_ten: ten,
      p_ban_kinh_m: gan.m, p_deal: deal,
    });
  const { data, error } = await goi();
  if (error) return { tin: [], loi: error.message };
  const tin = (data ?? []) as TinGan[];
  if (tin.length || !gan.ten) return { tin };

  // Có tên mà không ra căn nào: hoặc mốc có nhưng không căn nào gần (xong),
  // hoặc kho mình chưa biết nơi đó → tra đúng tên. `co_moc` hỏng thì thôi,
  // đừng đốt Nominatim trên một câu trả lời không chắc.
  const { data: co, error: coErr } = await db.rpc("co_moc", { p_loai: gan.loai, p_ten_re: gan.ten_re });
  if (coErr || co !== false) return { tin };
  const diem = (LOAI_OSM.has(gan.loai) ? await traDiaDanh(db, `${TEN_LOAI[gan.loai]} ${gan.ten}`) : null) ??
    await traDiaDanh(db, gan.ten);
  if (!diem) return { tin, khongThayMoc: true };
  // Nhớ cho lần sau: ten_kd gồm cả tên OSM lẫn chữ khách gõ, để `co_moc` lần
  // sau khớp ngay. Đã có điểm OSM đó (osm_id trùng) thì giữ nguyên dòng cũ.
  await db.from("tien_ich").upsert({
    osm_id: diem.osm_id,
    loai: LOAI_OSM.has(gan.loai) ? gan.loai : "dia_diem",
    ten: diem.ten,
    ten_kd: kdTen(`${diem.ten} ${gan.ten}`),
    lat: diem.lat,
    lng: diem.lng,
  }, { onConflict: "osm_id", ignoreDuplicates: true });
  const lai = await goi(diem.lat, diem.lng, diem.ten);
  if (lai.error) return { tin: [], loi: lai.error.message };
  return { tin: (lai.data ?? []) as TinGan[] };
}

const LOAI_HOI = ["benh_vien", "truong_hoc", "cho", "sieu_thi", "cong_vien"] as const;
const lamTron = (m: number) =>
  m >= 1000 ? `${String(Math.round(m / 100) / 10).replace(".", ",")} km` : `${Math.max(50, Math.round(m / 50) * 50)} m`;
function khoangCachM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Các cách gọi một khu vực để thử định vị, đầy đủ trước (SRS-5.1y, bắn thật 02/10): model gửi "chợ An Đông, Quận 5" —
 * cả chuỗi không khớp mốc nào trong `tien_ich` (tên lưu "cho an dong") và Nominatim cũng hụt (sau 07/2025 không còn
 * "Quận 5"). Thêm bản bỏ ĐUÔI hành chính (", quận 5", " p12", " tp hcm"…). Đuôi chỉ cắt khi đứng SAU tên: "Phường An Đông"
 * một mình thì giữ nguyên.
 */
export function ungVienKhuVuc(kv: string): string[] {
  const goc = kv.trim().replace(/\s+/g, " ");
  const ra = [goc];
  const kd = boDau(goc).toLowerCase();
  // Sau dấu phẩy: mọi chữ hành chính. Không có phẩy: "phường" CHỈ khi kèm số — tên đường "Nguyễn Tri Phương" không phải đuôi.
  const m = /\s*,\s*(?:quan|q\b|phuong|p\b|huyen|xa|thi xa|tp|thanh pho|tphcm|hcm|sai gon|saigon)/.exec(kd) ??
    /\s+(?:(?:quan|q|phuong|p)\.?\s*\d+\b|(?:quan|q|huyen|tp|thanh pho)\.?\s+[a-z]|tphcm\b|hcm\b|sai gon\b|saigon\b)/.exec(kd);
  if (m && m.index > 0) {
    const cat = goc.slice(0, m.index).replace(/[,\s]+$/, "").trim();
    if (cat.length >= 3 && cat !== goc) ra.push(cat);
  }
  return ra;
}

/**
 * Công cụ ĐỌC của trợ lý (SRS-5.1y, 02/10/2026): tiện ích quanh một khu vực khách nói. Định vị khu vực theo thứ tự rẻ
 * trước: mã căn trong kho (toạ độ đã geocode) → mốc đã có trong `tien_ich` trùng tên → Nominatim (qua RPC, như
 * `timTinGanMoc`). Rồi đọc `tien_ich` trong hộp quanh điểm đó, đo khoảng cách bằng code — model không bao giờ tự nói số mét.
 * Trả CHỮ cho model đọc; không định vị được / không có dữ liệu thì nói rõ để model nói thật, không kể tên bịa.
 */
export async function timTienIchQuanh(
  db: Db,
  khuVuc: string,
  loai: string,
  banKinhM = 1000,
): Promise<string> {
  const kv = khuVuc.trim().slice(0, 120);
  if (!kv) return "Thiếu khu vực — hỏi khách khu vực cụ thể (đường, phường, quận).";
  const bk = Math.min(3000, Math.max(300, Math.round(Number(banKinhM) || 1000)));
  let diem: { ten: string; lat: number; lng: number } | null = null;
  const ma = /\b([A-Z]{2,5}(?:-[A-Z0-9]{1,12}){1,4})\b/i.exec(kv)?.[1]?.toUpperCase();
  if (ma) {
    const { data } = await db.from("listings").select("code, location_raw, ward, lat, lng").ilike("code", ma).limit(1).maybeSingle();
    const l = data as { code: string; location_raw?: string | null; ward?: string | null; lat?: number | null; lng?: number | null } | null;
    if (l?.lat != null && l?.lng != null) diem = { ten: `căn #${l.code}`, lat: Number(l.lat), lng: Number(l.lng) };
  }
  const ungVien = ungVienKhuVuc(kv);
  for (const uv of ungVien) {
    if (diem) break;
    const kd = kdTen(uv);
    if (kd.length < 4) continue;
    // Nhiều mốc cùng chứa chuỗi ("cho an dong", "cho an dong 2"…) → lấy tên NGẮN nhất, gần chữ khách nhất.
    const { data } = await db.from("tien_ich").select("ten, ten_kd, lat, lng").ilike("ten_kd", `%${kd}%`).limit(10);
    const t = ((data ?? []) as Array<{ ten: string; ten_kd: string; lat: number; lng: number }>)
      .sort((a, b) => a.ten_kd.length - b.ten_kd.length)[0];
    if (t) diem = { ten: t.ten, lat: Number(t.lat), lng: Number(t.lng) };
  }
  for (const uv of ungVien) {
    if (diem) break;
    diem = await traDiaDanh(db, uv);
  }
  if (!diem) return `Không định vị được "${kv}" — hỏi lại khách khu đó ở đường nào / quận nào, KHÔNG đoán.`;
  const dLat = bk / 111320, dLng = bk / (111320 * Math.cos(diem.lat * Math.PI / 180));
  const loaiHoi = (LOAI_HOI as readonly string[]).includes(loai) ? [loai] : [...LOAI_HOI];
  const { data, error } = await db.from("tien_ich").select("loai, ten, lat, lng")
    .in("loai", loaiHoi)
    .gte("lat", diem.lat - dLat).lte("lat", diem.lat + dLat)
    .gte("lng", diem.lng - dLng).lte("lng", diem.lng + dLng)
    .limit(400);
  if (error) throw new Error(error.message);
  const ds = ((data ?? []) as Array<{ loai: string; ten: string; lat: number; lng: number }>)
    .map((t) => ({ ...t, m: khoangCachM(diem!, { lat: Number(t.lat), lng: Number(t.lng) }) }))
    .filter((t) => t.m <= bk)
    .sort((a, b) => a.m - b.m);
  const tenLoai = (l: string) => TEN_LOAI[l as keyof typeof TEN_LOAI] ?? l;
  const dau = `Quanh ${diem.ten} (bán kính ~${lamTron(bk)}, đường chim bay, ước tính - nói "khoảng"):`;
  if (!ds.length) {
    return `${dau} kho dữ liệu bên em CHƯA có ${loaiHoi.length === 1 ? tenLoai(loaiHoi[0]) : "tiện ích"} nào ở đây ` +
      "(kho chỉ nạp quanh các căn đang rao) - nói thật là em chưa có dữ liệu, KHÔNG kể tên nào.";
  }
  const chon = loaiHoi.length === 1
    ? ds.slice(0, 8)
    : loaiHoi.flatMap((l) => ds.filter((t) => t.loai === l).slice(0, 3));
  return `${dau}\n` + chon.map((t) => `- ${tenLoai(t.loai)}: ${t.ten} ~${lamTron(t.m)}`).join("\n");
}
