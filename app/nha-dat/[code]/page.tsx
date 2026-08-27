import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ListingCard from "@/components/ListingCard";
import TrackView from "@/components/TrackView";
import { supabase, type Listing } from "@/lib/supabase";
import { coverByCode, photosOfCode } from "@/lib/photos";
import { IconArea, IconBed, IconHouse, IconPin } from "@/components/icons";
import {
  factLabel,
  formatArea,
  formatPrice,
  placeholderImg,
  sanitizeDescription,
  zaloLink,
} from "@/lib/format";

export const revalidate = 300;

// KHÔNG có generateStaticParams thì `revalidate` ở trên là CHỮ CHẾT. Next 15
// xếp route động chưa khai báo param vào nhóm "dựng lại từng request":
// prerender-manifest.dynamicRoutes rỗng → không có ISR → mỗi lượt xem một tin
// là 3 query Supabase + 1 query ảnh, và Vercel chạy hẳn một lambda.
// Đo tại chỗ 26/08 (next start, production build):
//   /                 → x-nextjs-cache: HIT, Cache-Control: s-maxage=300
//   route [param] bất kỳ → Cache-Control: private, no-cache, no-store
// Đây lại đúng là 164 trang SEO — thứ Google cào nhiều nhất. Khai báo sẵn mã
// tin đang lên kệ để dựng lúc build; mã lạ (tin mới, tin đã chốt mở link cũ)
// vẫn render on-demand vì dynamicParams mặc định = true, và render xong cũng
// được nằm trong cache 5 phút như các trang kia.
export async function generateStaticParams() {
  const { data } = await supabase
    .from("listings")
    .select("code")
    .in("status", ["dang_ban", "dang_quan_tam"])
    .not("code", "is", null);
  return (data ?? []).map((l) => ({ code: l.code as string }));
}

const TYPE_LABEL: Record<string, string> = {
  nha_pho: "Nhà phố",
  nha_cap4: "Nhà cấp 4",
  chung_cu: "Chung cư",
  dat: "Đất",
  biet_thu: "Biệt thự",
  phong_tro: "Phòng trọ",
  mat_bang: "Mặt bằng",
};

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

  const [factsRes, relatedRes, photos] = await Promise.all([
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
    photosOfCode(code), // FR-148
  ]);
  const facts = factsRes.data ?? [];
  const related = (relatedRes.data ?? []) as Listing[];
  const relCovers = await coverByCode(related.map((l) => l.code));

  const loc = [listing.ward, listing.district ?? "Quận 5"].filter(Boolean).join(", ");
  const desc = sanitizeDescription(listing.description);
  const title = listing.location_raw?.split(",")[0]?.trim() || `Nhà đất ${loc}`;

  // Khối thông số nổi (Veedoo) — chỉ đưa vào ô nào tin này THẬT SỰ có
  const stats = [
    listing.property_type && TYPE_LABEL[listing.property_type]
      ? { Icon: IconHouse, label: "Loại hình", value: TYPE_LABEL[listing.property_type] }
      : null,
    listing.area_m2
      ? { Icon: IconArea, label: "Diện tích", value: formatArea(listing.area_m2) }
      : null,
    listing.bedrooms
      ? { Icon: IconBed, label: "Phòng ngủ", value: `${listing.bedrooms} PN` }
      : null,
  ].filter(Boolean) as Array<{ Icon: (p: { className?: string }) => React.ReactElement; label: string; value: string }>;

  return (
    <>
      <TrackView code={code} listingId={listing.id} />

      {/* Dải tiêu đề navy — bản Veedoo, nhưng bỏ ảnh nền (ảnh kho quá nhỏ để trải ngang) */}
      <div className="bg-navy py-10 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <nav className="text-sm text-white/55">
            <Link href="/" className="hover:text-brand">Trang chủ</Link>
            <span className="px-2">–</span>
            <Link href={listing.deal === "cho_thue" ? "/cho-thue" : "/mua-ban"} className="hover:text-brand">
              {listing.deal === "cho_thue" ? "Cho thuê" : "Mua bán"}
            </Link>
          </nav>
          <h1 className="mt-2.5 text-3xl font-extrabold [text-wrap:balance] md:text-4xl">{title}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-white/70">
            <IconPin className="h-4 w-4 text-brand" />
            {loc} <span className="text-white/40">· #{listing.code}</span>
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-14 pt-8">
        {/* FR-148: ảnh thật up theo mã tin (bucket listing-photos/<mã>/…) */}
        <div className="relative">
          <div className="relative overflow-hidden rounded-king bg-navy/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[0] ?? placeholderImg(code)}
              alt={loc}
              className="aspect-[16/9] w-full object-cover"
            />
            {/* Dòng chữ dưới gallery đã nói "ảnh thật gửi qua Zalo", nhưng nó
                nằm dưới tấm ảnh to này — người lướt nhanh chỉ thấy ảnh. Dán
                nhãn ngay TRÊN ảnh mới thật sự là nói. */}
            {photos.length === 0 && (
              <span className="absolute bottom-3 right-4 rounded-full bg-navy/80 px-3 py-1.5 text-xs font-semibold text-white">
                Ảnh minh hoạ — chưa có ảnh thật của căn này
              </span>
            )}
          </div>

          {/* Khối thông số NỔI đè chân ảnh — chữ ký của Veedoo (docs/01) */}
          {stats.length > 0 && (
            <div className="mx-auto -mt-10 w-[92%] rounded-king bg-navy px-6 py-6 text-white shadow-[0_18px_40px_rgba(13,37,61,0.28)] md:-mt-14 md:w-[86%] md:px-10 md:py-8">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                {stats.map(({ Icon, label, value }) => (
                  <div key={label} className="text-center">
                    <Icon className="mx-auto h-6 w-6 text-white" />
                    <p className="eyebrow mt-2.5 text-brand">{label}</p>
                    <p className="mt-1 text-2xl font-extrabold">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {photos.length > 1 && (
          <div className="mt-5 grid grid-cols-4 gap-3">
            {photos.slice(1, 9).map((url) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={url}
                src={url}
                alt={loc}
                className="aspect-[4/3] w-full rounded-shot object-cover"
              />
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-mute/80">
          {photos.length
            ? `${photos.length} ảnh thật của căn này. Cần thêm góc nào, nhắn Zalo tụi em gửi liền.`
            : `Ảnh thật của căn này gửi qua Zalo — nhắn “cho em xem hình #${listing.code}”.`}
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {/* FR-139: căn đã chốt vẫn mở được link cũ nhưng nói thật với khách */}
            {listing.status === "da_chot" && (
              <div className="mb-6 rounded-king border border-navy/15 bg-white px-5 py-4 font-semibold text-navy">
                Căn này đã giao dịch xong. Nhắn Zalo để tụi em gửi các căn tương tự đang bán nha.
              </div>
            )}
            {listing.status === "dang_quan_tam" && (
              <div className="mb-6 inline-block rounded-full bg-brand/10 px-4 py-1.5 text-sm font-bold text-brand">
                Đang được nhiều khách quan tâm
              </div>
            )}

            <div className="rounded-king bg-white p-6 shadow-[0_2px_14px_rgba(13,37,61,0.06)]">
              <p className="eyebrow text-brand">Giá</p>
              <p className="mt-1.5 text-4xl font-extrabold text-brand tabular-nums">
                {formatPrice(listing.price_vnd, listing.price_raw)}
              </p>
              {desc && (
                <>
                  <h2 className="mt-8 text-lg font-extrabold">Mô tả</h2>
                  <p className="mt-2.5 whitespace-pre-line leading-7 text-navy/80">{desc}</p>
                </>
              )}
            </div>

            {facts.length > 0 && (
              <div className="mt-5 rounded-king bg-white p-6 shadow-[0_2px_14px_rgba(13,37,61,0.06)]">
                <h2 className="text-lg font-extrabold">Đã xác minh với chủ nhà</h2>
                <ul className="mt-3 divide-y divide-line">
                  {/* FR-104: answer là chữ chính chủ gõ trong Zalo, hay kèm SĐT —
                      phải lọc y như description, đừng in thẳng ra web. */}
                  {facts.map((f, i) => (
                    <li key={i} className="flex gap-4 py-3 text-sm">
                      {/* FR-165: nhãn tiếng Việt, không in thẳng khoá DB
                          ("do_rong_hem", "phap_ly") ra mặt khách. */}
                      <span className="min-w-36 font-semibold text-mute">{factLabel(f.question)}</span>
                      <span>{sanitizeDescription(f.answer)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Khối CTA Zalo mang ngữ cảnh (FR-13/14) */}
          <aside className="h-fit rounded-king bg-white p-6 shadow-[0_2px_14px_rgba(13,37,61,0.06)] lg:sticky lg:top-20">
            <p className="text-lg font-extrabold">Hỏi về căn #{listing.code}</p>
            <p className="mt-2 text-sm leading-6 text-mute">
              Còn không? Hẻm rộng bao nhiêu? Sổ sách sao? — nhắn Zalo, tụi em trả
              lời ngay, chưa rõ thì đi hỏi chủ nhà giùm anh chị.
            </p>
            <a
              href={zaloLink(`#${listing.code}`)}
              className="mt-5 block rounded-full bg-brand py-3.5 text-center font-bold text-white transition hover:bg-brand-dark active:scale-[0.98]"
            >
              Chat Zalo về căn này
            </a>
            <p className="mt-3 text-center text-xs text-mute/80">
              Miễn phí · không cần để lại số điện thoại
            </p>
            {listing.price_vnd && listing.price_vnd > 0 && (
              <Link
                href={`/tinh-lai-vay?price=${listing.price_vnd}`}
                className="mt-3 block rounded-full border border-line py-3 text-center text-sm font-bold transition hover:border-brand hover:text-brand"
              >
                Tính lãi vay với giá căn này
              </Link>
            )}
          </aside>
        </div>

        {related.length > 0 && (
          <section className="mt-14">
            <p className="eyebrow text-brand">Gợi ý</p>
            <h2 className="mb-6 mt-1.5 text-2xl font-extrabold">Cùng khu {listing.ward}</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((l) => (
                <ListingCard key={l.id} listing={l} photo={l.code ? relCovers[l.code] : null} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
