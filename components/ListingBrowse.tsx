import Link from "next/link";
import { unstable_cache } from "next/cache";
import ListingCard from "@/components/ListingCard";
import { coverByCode } from "@/lib/photos";
import { CARD_COLS, supabase, type ListingCard as CardRow } from "@/lib/supabase";
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

// Trang này ĐỌC searchParams nên Next đánh dấu ƒ — dựng lại từng request, ISR
// không với tới (tổ hợp bộ lọc là vô hạn, không prerender được). Chỗ tốn thật
// không phải HTML mà là query Supabase: gói nó vào Data Cache, khoá theo đúng
// bộ lọc. Hai người bấm cùng "Dưới 5 tỷ · Phường 5" trong 5 phút thì DB chỉ bị
// hỏi một lần. Free tier chỉ có 60 max_connections nên đây là chỗ đáng giữ.
type Truy = {
  deal: "ban" | "cho_thue";
  phuong?: string;
  giaMin?: number; giaMax?: number; loGia: boolean;
  dtMin?: number; dtMax?: number; loDt: boolean;
  pn: number | null;
  xep: string;
  page: number;
};

const layTin = unstable_cache(
  async (t: Truy) => {
    let q = supabase
      .from("listings")
      .select(CARD_COLS, { count: "exact" }) // FR-171 j: lưới thẻ không cần mô tả
      .eq("deal", t.deal)
      .in("status", ["dang_ban", "dang_quan_tam"]) // FR-139: chỉ tin đang lên kệ
      .not("price_raw", "is", null)
      .neq("price_raw", "");
    if (t.phuong) q = q.eq("ward", t.phuong);
    if (t.giaMin) q = q.gte("price_vnd", t.giaMin);
    if (t.giaMax) q = q.lt("price_vnd", t.giaMax);
    if (t.loGia) q = q.gt("price_vnd", 0);
    if (t.dtMin) q = q.gte("area_m2", t.dtMin);
    if (t.dtMax) q = q.lt("area_m2", t.dtMax);
    if (t.loDt) q = q.gt("area_m2", 0);
    if (t.pn) q = q.gte("bedrooms", t.pn);
    q =
      t.xep === "gia-tang" ? q.order("price_vnd", { ascending: true, nullsFirst: false })
      : t.xep === "gia-giam" ? q.order("price_vnd", { ascending: false, nullsFirst: false })
      : t.xep === "dt-lon" ? q.order("area_m2", { ascending: false, nullsFirst: false })
      : q.order("created_at", { ascending: false });
    q = q.range((t.page - 1) * PAGE_SIZE, t.page * PAGE_SIZE - 1);
    const { data, count } = await q;
    return { rows: (data ?? []) as CardRow[], total: count ?? 0 };
  },
  ["listing-browse"],
  { revalidate: 300, tags: ["listings"] },
);

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

  const pn = PN.includes(Number(sp.pn)) ? Number(sp.pn) : null;
  const { rows: listings, total } = await layTin({
    deal,
    phuong: sp.phuong,
    giaMin: gia?.min, giaMax: gia?.max, loGia: !!gia,
    dtMin: dt?.min, dtMax: dt?.max, loDt: !!dt,
    pn,
    xep: xep.key,
    page,
  });
  const covers = await coverByCode(listings.map((l) => l.code)); // FR-148
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
    <>
      {/* Dải tiêu đề navy + thẻ lọc trắng nổi đè lên chân dải — đúng chỗ thanh
          "Search Property" của Veedoo, nhưng là link thuần nên không cần JS. */}
      <div className="bg-navy pb-16 pt-10 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <p className="eyebrow text-brand">Kho tin Quận 5</p>
          <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">
            {title} {sp.phuong ? `— ${sp.phuong}` : "Quận 5"}
          </h1>
          <p className="mt-2 text-white/60">
            {total} tin · hỏi chi tiết bất kỳ căn nào qua Zalo
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-12">
        <div className="-mt-10 space-y-3 rounded-king bg-white p-5 shadow-[0_18px_40px_rgba(13,37,61,0.14)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 shrink-0 eyebrow text-mute">Giá</span>
          {GIA[deal].map((g) => (
            <Link key={g.key} href={withParam({ gia: sp.gia === g.key ? undefined : g.key })} className={chip(sp.gia === g.key)}>
              {g.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 shrink-0 eyebrow text-mute">Diện tích</span>
          {DT.map((d) => (
            <Link key={d.key} href={withParam({ dt: sp.dt === d.key ? undefined : d.key })} className={chip(sp.dt === d.key)}>
              {d.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 shrink-0 eyebrow text-mute">Phòng ngủ</span>
          {PN.map((n) => (
            <Link key={n} href={withParam({ pn: sp.pn === String(n) ? undefined : String(n) })} className={chip(sp.pn === String(n))}>
              {n}+ PN
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 shrink-0 eyebrow text-mute">Xếp theo</span>
          {XEP.map((x) => (
            <Link key={x.key} href={withParam({ xep: x.key === "moi" ? undefined : x.key })} className={chip(xep.key === x.key)}>
              {x.label}
            </Link>
          ))}
        </div>
        </div>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {listings.map((l) => (
          <ListingCard key={l.id} listing={l} photo={l.code ? covers[l.code] : null} />
        ))}
      </div>

      {listings.length === 0 && (
        <div className="mt-10 rounded-king bg-white p-10 text-center shadow-[0_2px_14px_rgba(13,37,61,0.06)]">
          <p className="font-semibold">Chưa có tin nào khớp bộ lọc này.</p>
          <p className="mt-1 text-sm text-mute">
            Nới bớt một tiêu chí, hoặc nhắn Zalo — có khi hàng chưa kịp lên web.
          </p>
          <a
            href={zaloLink(`empty:${sp.phuong ?? deal}`)}
            className="mt-5 inline-block rounded-full bg-brand px-6 py-3 font-bold text-white transition hover:bg-brand-dark active:scale-[0.98]"
          >
            Hỏi qua Zalo
          </a>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link href={withParam({ trang: String(page - 1) })} className="rounded-full border border-line bg-white px-5 py-2.5 font-semibold transition hover:border-brand hover:text-brand">
              ← Trước
            </Link>
          )}
          <span className="px-3 text-mute tabular-nums">Trang {page}/{totalPages}</span>
          {page < totalPages && (
            <Link href={withParam({ trang: String(page + 1) })} className="rounded-full border border-line bg-white px-5 py-2.5 font-semibold transition hover:border-brand hover:text-brand">
              Sau →
            </Link>
          )}
        </div>
      )}
      </div>
    </>
  );
}
