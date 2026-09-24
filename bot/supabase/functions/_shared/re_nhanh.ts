// FR-223 — đọc tin + fact rồi áp bảng rẽ nhánh (`extraction/re-nhanh.ts`, hàm thuần) lên danh sách câu còn
// thiếu của view `listing_missing_facts`. Mọi chỗ chọn câu hỏi kế (chat-reply, ask-seller) đi qua đây để câu
// nhánh ("sổ hồng riêng" → hỏi hoàn công, "chưa có sổ" → hỏi bao giờ ra sổ…) giống nhau ở mọi đường.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { ghiLoi } from "./claude.ts";
import { apReNhanh, canReNhanh, type CauThem } from "./extraction/re-nhanh.ts";

type Thieu = { fact_key: string; priority?: number | null; nhom?: string | null };

export async function thieuCoReNhanh<T extends Thieu>(
  client: SupabaseClient, listingId: string | null | undefined, thieu: T[] | null | undefined, vuaNoi: string[] = [], tinNay = "",
): Promise<Array<T | CauThem>> {
  const ds = (thieu ?? []) as T[];
  // Không luật nào có thể đụng tới lượt này → khỏi đọc DB (giữ trần số truy vấn mỗi lượt, TOIUU-07).
  if (!listingId || !canReNhanh(ds, vuaNoi)) return ds;
  // MỘT truy vấn: tin + fact nhúng (listing_facts chỉ có một khoá ngoại tới listings).
  const { data: l, error: lErr } = await client.from("listings")
    .select("property_type, deal, legal_status, has_completion, rent_income_vnd, listing_facts(question, answer)")
    .eq("id", listingId).maybeSingle();
  if (lErr) {
    await ghiLoi(client, "re-nhanh doc tin", lErr.message);
    return ds;
  }
  if (!l) return ds;
  const r = l as { property_type: string | null; deal: string | null; legal_status: string | null; has_completion: boolean | null; rent_income_vnd: number | null; listing_facts: Array<{ question: string; answer: string | null }> | null };
  return apReNhanh(ds, {
    loai: r.property_type, deal: r.deal, legal_status: r.legal_status, has_completion: r.has_completion,
    // Tin chủ nhà vừa nhắn cũng là bằng chứng: "sổ hồng riêng, hoàn công đủ" — đáp án pháp lý cắt còn "sổ hồng riêng",
    // chữ "hoàn công đủ" chỉ còn trong câu gốc.
    rent_income_vnd: r.rent_income_vnd, facts: [...(r.listing_facts ?? []), ...(tinNay ? [{ question: "_tin_nay", answer: tinNay }] : [])],
  }, vuaNoi);
}
