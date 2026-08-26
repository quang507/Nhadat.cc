import Link from "next/link";
import FavButton from "@/components/FavButton";
import type { Listing } from "@/lib/supabase";
import { formatArea, formatPrice, placeholderImg } from "@/lib/format";
import { IconArea, IconBed, IconHouse, IconPin } from "@/components/icons";

const TYPE_LABEL: Record<string, string> = {
  nha_pho: "Nhà phố",
  nha_cap4: "Nhà cấp 4",
  chung_cu: "Chung cư",
  dat: "Đất",
  biet_thu: "Biệt thự",
  phong_tro: "Phòng trọ",
  mat_bang: "Mặt bằng",
};

export default function ListingCard({
  listing,
  featured,
  photo,
}: {
  listing: Listing;
  featured?: boolean;
  /** FR-148: ảnh bìa thật (bucket listing-photos theo mã); không có thì ảnh minh hoạ */
  photo?: string | null;
}) {
  const code = listing.code ?? listing.id.slice(0, 8);
  const title =
    listing.location_raw?.split(",")[0]?.trim() ||
    `${listing.ward ?? ""} ${listing.district ?? "Quận 5"}`.trim();
  const loc = [listing.ward, listing.district ?? "Quận 5"].filter(Boolean).join(", ");

  return (
    <Link
      href={`/nha-dat/${encodeURIComponent(code)}`}
      className="group flex h-full flex-col rounded-king bg-white p-2.5 shadow-[0_2px_14px_rgba(13,37,61,0.06)] transition hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(13,37,61,0.13)]"
    >
      {/* Ảnh nằm TRONG khung, bo nhỏ hơn khung một nấc (cách của Veedoo) */}
      <div
        className={`relative overflow-hidden rounded-shot bg-navy/5 ${
          featured ? "aspect-[4/3] sm:aspect-auto sm:min-h-72 sm:flex-1" : "aspect-[4/3]"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo ?? placeholderImg(code)}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
        />
        {/* Giá ĐÈ THẲNG lên ảnh, không chip — chữ trắng trên vệt tối chân ảnh */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/85 via-navy/35 to-transparent pt-12">
          <p
            className={`px-4 pb-3.5 font-extrabold text-white tabular-nums drop-shadow ${
              featured ? "text-3xl" : "text-xl"
            }`}
          >
            {formatPrice(listing.price_vnd, listing.price_raw)}
          </p>
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-navy">
          {listing.deal === "cho_thue" ? "Cho thuê" : "Bán"}
        </span>
        <span className="absolute right-3 top-3">
          <FavButton code={code} small={!featured} />
        </span>
      </div>

      <div className="flex flex-1 flex-col px-2 pb-1.5 pt-3.5">
        <p
          className={`line-clamp-1 font-extrabold transition group-hover:text-brand ${
            featured ? "text-xl" : "text-[17px]"
          }`}
        >
          {title}
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-mute">
          <IconPin className="h-4 w-4 shrink-0 text-brand" />
          <span className="line-clamp-1">
            {loc} <span className="text-mute/60">· #{code}</span>
          </span>
        </p>

        {/* Hàng thông số icon mảnh — chỉ hiện thứ tin này THẬT SỰ có.
            Veedoo còn cột toilet/chỗ đậu xe, kho mình không có nên bỏ. */}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-sm text-mute">
          {listing.property_type && TYPE_LABEL[listing.property_type] && (
            <span className="flex items-center gap-1.5">
              <IconHouse className="h-4 w-4 text-mute/70" />
              {TYPE_LABEL[listing.property_type]}
            </span>
          )}
          {listing.area_m2 ? (
            <span className="flex items-center gap-1.5 tabular-nums">
              <IconArea className="h-4 w-4 text-mute/70" />
              {formatArea(listing.area_m2)}
            </span>
          ) : null}
          {listing.bedrooms ? (
            <span className="flex items-center gap-1.5 tabular-nums">
              <IconBed className="h-4 w-4 text-mute/70" />
              {listing.bedrooms} PN
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
