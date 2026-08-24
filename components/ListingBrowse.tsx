import Link from "next/link";
import ListingCard from "@/components/ListingCard";
import { supabase, type Listing } from "@/lib/supabase";
import { zaloLink } from "@/lib/format";

const PAGE_SIZE = 24;

export default async function ListingBrowse({
  deal,
  title,
  basePath,
  searchParams,
}: {
  deal: "ban" | "cho_thue";
  title: string;
  basePath: string;
  searchParams: Promise<{ phuong?: string; trang?: string }>;
}) {
  const { phuong, trang } = await searchParams;
  const page = Math.max(1, Number(trang) || 1);

  let query = supabase
    .from("listings")
    .select("*", { count: "exact" })
    .eq("deal", deal)
    .not("price_raw", "is", null)
    .neq("price_raw", "")
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (phuong) query = query.eq("ward", phuong);

  const { data, count } = await query;
  const listings = (data ?? []) as Listing[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageUrl = (p: number) =>
    `${basePath}?${new URLSearchParams({
      ...(phuong ? { phuong } : {}),
      ...(p > 1 ? { trang: String(p) } : {}),
    }).toString()}`.replace(/\?$/, "");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-extrabold md:text-3xl">
        {title} {phuong ? `— ${phuong}` : "Quận 5"}
      </h1>
      <p className="mt-1 text-sm text-navy/60">
        {total} tin · cập nhật liên tục · hỏi chi tiết bất kỳ căn nào qua Zalo
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
      </div>

      {listings.length === 0 && (
        <div className="mt-10 rounded-xl border border-navy/10 bg-cream p-8 text-center">
          <p className="font-semibold">Chưa có tin nào khớp bộ lọc này.</p>
          <p className="mt-1 text-sm text-navy/60">
            Nhắn Zalo cho tụi em — có khi hàng chưa kịp lên web.
          </p>
          <a
            href={zaloLink(`empty:${phuong ?? deal}`)}
            className="mt-4 inline-block rounded-lg bg-zalo px-5 py-2.5 font-semibold text-white"
          >
            Hỏi qua Zalo
          </a>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link href={pageUrl(page - 1)} className="rounded-lg border border-navy/15 px-4 py-2 hover:border-brand">
              ← Trước
            </Link>
          )}
          <span className="px-3 text-navy/60">Trang {page}/{totalPages}</span>
          {page < totalPages && (
            <Link href={pageUrl(page + 1)} className="rounded-lg border border-navy/15 px-4 py-2 hover:border-brand">
              Sau →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
