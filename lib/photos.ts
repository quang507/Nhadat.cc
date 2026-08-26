// FR-148: ảnh thật của tin nằm trên Supabase Storage, bucket `listing-photos`,
// đường dẫn "<mã tin>/<tên file>" (vd "BDS-Q5-0164/01.jpg"). Chủ dự án up qua
// Supabase → Storage; web và bot đọc chung qua view `listing_photos_v`.
// Tin chưa có ảnh thì rơi về ảnh minh hoạ (placeholderImg).
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";

// Hai trang /mua-ban và /cho-thue đọc searchParams nên Next dựng chúng LẠI TỪ
// ĐẦU mỗi request (build in ƒ, không ISR được vì tổ hợp bộ lọc là vô hạn).
// Không bọc cache thì mỗi lượt tải là +1 query ảnh nữa. unstable_cache đặt kết
// quả vào Data Cache của Next (trên Vercel là kho dùng chung giữa các lambda),
// khoá theo chính tham số truyền vào — trùng bộ lọc là dùng lại, khỏi hỏi DB.
const TTL = 300;

/** Ảnh bìa (tấm đầu theo tên file) cho một loạt mã tin — dùng cho lưới thẻ. */
export const coverByCode = unstable_cache(
  _coverByCode,
  ["listing-covers"],
  { revalidate: TTL, tags: ["listing-photos"] },
);

async function _coverByCode(
  codes: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const list = [...new Set(codes.filter(Boolean) as string[])];
  if (!list.length) return {};
  const { data } = await supabase
    .from("listing_photos_v")
    .select("code, url, path")
    .in("code", list)
    .order("path");
  const cover: Record<string, string> = {};
  for (const r of data ?? []) {
    if (!cover[r.code as string]) cover[r.code as string] = r.url as string;
  }
  return cover;
}

/** Toàn bộ ảnh của một tin, xếp theo tên file — dùng cho trang chi tiết. */
export const photosOfCode = unstable_cache(
  _photosOfCode,
  ["listing-photos"],
  { revalidate: TTL, tags: ["listing-photos"] },
);

async function _photosOfCode(code: string, limit = 12): Promise<string[]> {
  const { data } = await supabase
    .from("listing_photos_v")
    .select("url, path")
    .eq("code", code)
    .order("path")
    .limit(limit);
  return (data ?? []).map((r) => r.url as string);
}
