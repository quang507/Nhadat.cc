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

const UA = "nhadatcc-geocoder/1.0 (admin.buyerside@nhadat.cc)";
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
async function traDiaDanh(cum: string): Promise<{ osm_id: string; ten: string; lat: number; lng: number } | null> {
  for (const q of [`${cum}, Thành phố Hồ Chí Minh`, `${boDau(cum)}, Ho Chi Minh City`]) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=vn&q=${encodeURIComponent(q)}`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(4000) },
      );
      const r = (await res.json())?.[0];
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
  const diem = (LOAI_OSM.has(gan.loai) ? await traDiaDanh(`${TEN_LOAI[gan.loai]} ${gan.ten}`) : null) ??
    await traDiaDanh(gan.ten);
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
