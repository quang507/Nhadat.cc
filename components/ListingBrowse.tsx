import Link from "next/link";
import ListingCard from "@/components/ListingCard";
import { coverByCode } from "@/lib/photos";
import { supabase, type Listing } from "@/lib/supabase";
import { zaloLink } from "@/lib/format";

const PAGE_SIZE = 24;
const TY = 1_000_000_000;
const TR = 1_000_000;

// Bộ lọc giá theo loại giao dịch (FR-123 — port ý tưởng search NhaDat-Radar).
// Lọc số phòng ngủ chờ dữ liệu có cấu trúc (nằm rải trong listing_facts).
const GIA: Record<string, { key: string; label: string; min?: number; max?: number }[]> = {
  ban: [
    { key: "duoi-5", label: "Dưới 5 tỷ", max: 5 * TY },
    { key: "5-8", label: "5–8 tỷ", min: 5 * TY, max: 8 * TY },
    { key: "8-12", label: "8–12 tỷ", min: 8 * TY, max: 12 * TY },
    { key: "tren-12", label: "Trên 12 tỷ", min: 12 * TY },
  ],
  cho_thue: [
    { key: "duoi-10tr", label: "Dưới 10 tr/tháng", max: 10 * TR },
    { key: "10-20tr", label: "10–20 tr", min: 10 * TR, max: 20 * TR },
    { key: "tren-20tr", label: "Trên 20 tr", min: 20 * TR },
  ],
};
const DT = [
  { key: "duoi-40", label: "Dưới 40 m²", max: 40 },
  { key: "40-60", label: "40–60 m²", min: 40, max: 60 },
  { key: "60-100", label: "60–100 m²", min: 60, max: 100 },
  { key: "tren-100", label: "Trên 100 m²", min: 100 },
];
const XEP = [
  { key: "moi", label: "Mới nhất" },
  { key: "gia-tang", label: "Giá thấp → cao" },
  { key: "gia-giam", label: "Giá cao → thấp" },
  { key: "dt-lon", label: "Diện tích lớn" },
];
const PN = [1, 2, 3, 4]; // "từ N phòng ngủ trở lên" (FR-128)

type Params = { phuong?: string; trang?: string; gia?: string; dt?: string; xep?: string; pn?: string };

export default async function ListingBrowse({
  deal,
  title,
  basePath,
  searchParams,
}: {
  deal: "ban" | "cho_thue";
  title: string;
  basePath: string;
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.trang) || 1);
  const gia = GIA[deal].find((g) => g.key === sp.gia);
  const dt = DT.find((d) => d.key === sp.dt);
  const xep = XEP.find((x) => x.key === sp.xep) ?? XEP[0];

  let query = supabase
    .from("listings")
    .select("*", { count: "exact" })
    .eq("deal", deal)
    .in("status", ["dang_ban", "dang_quan_tam"]) // FR-139: chỉ tin đang lên kệ
    .not("price_raw", "is", null)
    .neq("price_raw", "");
  if (sp.phuong) query = query.eq("ward", sp.phuong);
  if (gia?.min) query = query.gte("price_vnd", gia.min);
  if (gia?.max) query = query.lt("price_vnd", gia.max);
  if (gia) query = query.gt("price_vnd", 0);
  if (dt?.min) query = query.gte("area_m2", dt.min);
  if (dt?.max) query = query.lt("area_m2", dt.max);
  if (dt) query = query.gt("area_m2", 0);
  const pn = PN.includes(Number(sp.pn)) ? Number(sp.pn) : null;
  if (pn) query = query.gte("bedrooms", pn);
  query =
    xep.key === "gia-tang" ? query.order("price_vnd", { ascending: true, nullsFirst: false })
    : xep.key === "gia-giam" ? query.order("price_vnd", { ascending: false, nullsFirst: false })
    : xep.key === "dt-lon" ? query.order("area_m2", { ascending: false, nullsFirst: false })
    : query.order("created_at", { ascending: false });
  query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data, count } = await query;
  const listings = (data ?? []) as Listing[];
  const covers = await coverByCode(listings.map((l) => l.code)); // FR-148
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Link giữ nguyên các lọc khác, đổi một tham số (trang reset về 1)
  const withParam = (patch: Partial<Params>) => {
    const merged: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...sp, trang: undefined, ...patch })) {
      if (v) merged[k] = String(v);
    }
    const qs = new URLSearchParams(merged).toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const chip = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm transition ${
      active
        ? "border-brand bg-brand font-semibold text-white"
        : "border-line bg-white hover:border-brand hover:text-brand"
    }`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-extrabold md:text-3xl">
        {title} {sp.phuong ? `— ${sp.phuong}` : "Quận 5"}
      </h1>
      <p className="mt-1 text-sm text-mute">
        {total} tin · hỏi chi tiết bất kỳ căn nào qua Zalo
      </p>

      {/* Bộ lọc giá / diện tích / sắp xếp — link thuần, không JS */}
      <div className="mt-5 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs font-semibold uppercase tracking-wide text-mute">Giá</span>
          {GIA[deal].map((g) => (
            <Link key={g.key} href={withParam({ gia: sp.gia === g.key ? undefined : g.key })} className={chip(sp.gia === g.key)}>
              {g.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs font-semibold uppercase tracking-wide text-mute">Diện tích</span>
          {DT.map((d) => (
            <Link key={d.key} href={withParam({ dt: sp.dt === d.key ? undefined : d.key })} className={chip(sp.dt === d.key)}>
              {d.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs font-semibold uppercase tracking-wide text-mute">Phòng ngủ</span>
          {PN.map((n) => (
            <Link key={n} href={withParam({ pn: sp.pn === String(n) ? undefined : String(n) })} className={chip(sp.pn === String(n))}>
              {n}+ PN
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs font-semibold uppercase tracking-wide text-mute">Xếp theo</span>
          {XEP.map((x) => (
            <Link key={x.key} href={withParam({ xep: x.key === "moi" ? undefined : x.key })} className={chip(xep.key === x.key)}>
              {x.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {listings.map((l) => (
          <ListingCard key={l.id} listing={l} photo={l.code ? covers[l.code] : null} />
        ))}
      </div>

      {listings.length === 0 && (
        <div className="mt-10 rounded-king border border-line bg-white p-8 text-center">
          <p className="font-semibold">Chưa có tin nào khớp bộ lọc này.</p>
          <p className="mt-1 text-sm text-mute">
            Nới bớt một tiêu chí, hoặc nhắn Zalo — có khi hàng chưa kịp lên web.
          </p>
          <a
            href={zaloLink(`empty:${sp.phuong ?? deal}`)}
            className="mt-4 inline-block rounded-full bg-zalo px-5 py-2.5 font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
          >
            Hỏi qua Zalo
          </a>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link href={withParam({ trang: String(page - 1) })} className="rounded-full border border-line bg-white px-4 py-2 transition hover:border-brand">
              ← Trước
            </Link>
          )}
          <span className="px-3 text-mute tabular-nums">Trang {page}/{totalPages}</span>
          {page < totalPages && (
            <Link href={withParam({ trang: String(page + 1) })} className="rounded-full border border-line bg-white px-4 py-2 transition hover:border-brand">
              Sau →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
