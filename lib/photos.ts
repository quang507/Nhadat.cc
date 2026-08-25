// FR-148: ảnh thật của tin nằm trên Supabase Storage, bucket `listing-photos`,
// đường dẫn "<mã tin>/<tên file>" (vd "BDS-Q5-0164/01.jpg"). Chủ dự án up qua
// Supabase → Storage; web và bot đọc chung qua view `listing_photos_v`.
// Tin chưa có ảnh thì rơi về ảnh minh hoạ (placeholderImg).
import { supabase } from "@/lib/supabase";

/** Ảnh bìa (tấm đầu theo tên file) cho một loạt mã tin — dùng cho lưới thẻ. */
export async function coverByCode(
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
export async function photosOfCode(code: string, limit = 12): Promise<string[]> {
  const { data } = await supabase
    .from("listing_photos_v")
    .select("url, path")
    .eq("code", code)
    .order("path")
    .limit(limit);
  return (data ?? []).map((r) => r.url as string);
}
