import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ListingCard from "@/components/ListingCard";
import TrackView from "@/components/TrackView";
import { supabase, type Listing } from "@/lib/supabase";
import {
  formatArea,
  formatPrice,
  placeholderImg,
  sanitizeDescription,
  zaloLink,
} from "@/lib/format";

export const revalidate = 300;

async function getListing(code: string): Promise<Listing | null> {
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  return data as Listing | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const listing = await getListing(decodeURIComponent(code));
  if (!listing) return { title: "Không tìm thấy tin" };
  const loc = [listing.ward, listing.district ?? "Quận 5"].filter(Boolean).join(", ");
  return {
    title: `${listing.deal === "cho_thue" ? "Cho thuê" : "Bán"} nhà đất ${loc} — ${formatPrice(listing.price_vnd, listing.price_raw)} · #${listing.code}`,
    description: sanitizeDescription(listing.description).slice(0, 155),
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode);
  const listing = await getListing(code);
  if (!listing) notFound();

  const [factsRes, relatedRes] = await Promise.all([
    supabase
      .from("listing_facts")
      .select("question, answer")
      .eq("listing_id", listing.id)
      .limit(20),
    supabase
      .from("listings")
      .select("*")
      .eq("deal", listing.deal)
      .neq("id", listing.id)
      .in("status", ["dang_ban", "dang_quan_tam"])
      .not("price_raw", "is", null)
      .neq("price_raw", "")
      .eq("ward", listing.ward ?? "")
      .limit(4),
  ]);
  const facts = factsRes.data ?? [];
  const related = (relatedRes.data ?? []) as Listing[];

  const loc = [listing.ward, listing.district ?? "Quận 5"].filter(Boolean).join(", ");
  const desc = sanitizeDescription(listing.description);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <TrackView code={code} listingId={listing.id} />
      <nav className="mb-4 text-sm text-mute">
        <Link href="/" className="hover:text-brand">Trang chủ</Link>
        {" / "}
        <Link href={listing.deal === "cho_thue" ? "/cho-thue" : "/mua-ban"} className="hover:text-brand">
          {listing.deal === "cho_thue" ? "Cho thuê" : "Mua bán"}
        </Link>
        {" / "}
        <span className="text-navy">#{listing.code}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-king bg-navy/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={placeholderImg(code)}
              alt={loc}
              className="aspect-[16/10] w-full object-cover"
            />
          </div>
          <p className="mt-2 text-xs text-mute/70">
            Ảnh thật của căn này gửi qua Zalo — nhắn “cho em xem hình #{listing.code}”.
          </p>

          <h1 className="mt-5 text-2xl font-extrabold md:text-3xl">
            {listing.deal === "cho_thue" ? "Cho thuê" : "Bán"} nhà đất {loc}
          </h1>

          {/* FR-139: căn đã chốt vẫn mở được link cũ nhưng nói thật với khách */}
          {listing.status === "da_chot" && (
            <div className="mt-3 rounded-king border border-navy/20 bg-navy/5 px-4 py-3 text-sm font-semibold text-navy">
              Căn này đã giao dịch xong. Nhắn Zalo để tụi em gửi các căn tương tự đang bán nha.
            </div>
          )}
          {listing.status === "dang_quan_tam" && (
            <div className="mt-3 inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
              🔥 Đang được nhiều khách quan tâm
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-6 rounded-king border border-line bg-white p-4">
            <div>
              <p className="text-xs text-mute">Giá</p>
              <p className="text-xl font-bold text-brand">
                {formatPrice(listing.price_vnd, listing.price_raw)}
              </p>
            </div>
            <div>
              <p className="text-xs text-mute">Diện tích</p>
              <p className="text-xl font-bold">{formatArea(listing.area_m2)}</p>
            </div>
            <div>
              <p className="text-xs text-mute">Khu vực</p>
              <p className="text-xl font-bold">{loc}</p>
            </div>
            <div>
              <p className="text-xs text-mute">Mã tin</p>
              <p className="text-xl font-bold">#{listing.code}</p>
            </div>
          </div>

          {desc && (
            <div className="mt-6">
              <h2 className="text-lg font-bold">Mô tả</h2>
              <p className="mt-2 whitespace-pre-line leading-7 text-navy/80">{desc}</p>
            </div>
          )}

          {facts.length > 0 && (
            <div className="mt-6">
              <h2 className="text-lg font-bold">Đã xác minh với chủ nhà</h2>
              <ul className="mt-2 divide-y divide-line rounded-king border border-line bg-white">
                {facts.map((f, i) => (
                  <li key={i} className="flex gap-3 p-3 text-sm">
                    <span className="min-w-32 font-medium text-mute">{f.question}</span>
                    <span>{f.answer}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Khối CTA Zalo mang ngữ cảnh (FR-13/14) */}
        <aside className="h-fit rounded-king border border-line bg-white p-5 shadow-sm lg:sticky lg:top-20">
          <p className="font-bold">Hỏi về căn #{listing.code}</p>
          <p className="mt-1 text-sm text-mute">
            Còn không? Hẻm rộng bao nhiêu? Sổ sách sao? — nhắn Zalo, tụi em trả
            lời ngay, chưa rõ thì đi hỏi chủ nhà giùm anh chị.
          </p>
          <a
            href={zaloLink(`#${listing.code}`)}
            className="mt-4 block rounded-full bg-zalo py-3 text-center font-bold text-white transition hover:opacity-90 active:scale-[0.98]"
          >
            Chat Zalo về căn này
          </a>
          <p className="mt-3 text-center text-xs text-mute/70">
            Miễn phí · không cần để lại số điện thoại
          </p>
          {listing.price_vnd && listing.price_vnd > 0 && (
            <Link
              href={`/tinh-lai-vay?price=${listing.price_vnd}`}
              className="mt-3 block rounded-full border border-line py-2.5 text-center text-sm font-semibold transition hover:border-brand hover:text-brand"
            >
              Tính lãi vay với giá căn này
            </Link>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 text-xl font-extrabold">Cùng khu {listing.ward}</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        </section>
      )}
    </div>
  );
}
