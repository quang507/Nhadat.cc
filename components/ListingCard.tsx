import Link from "next/link";
import type { Listing } from "@/lib/supabase";
import { formatArea, formatPrice, placeholderImg } from "@/lib/format";

const TYPE_LABEL: Record<string, string> = {
  nha_pho: "Nhà phố",
  nha_cap4: "Nhà cấp 4",
  chung_cu: "Chung cư",
  dat: "Đất",
  biet_thu: "Biệt thự",
  phong_tro: "Phòng trọ",
  mat_bang: "Mặt bằng",
};

export default function ListingCard({ listing }: { listing: Listing }) {
  const code = listing.code ?? listing.id.slice(0, 8);
  const title =
    listing.location_raw?.split(",")[0]?.trim() ||
    `${listing.ward ?? ""} ${listing.district ?? "Quận 5"}`.trim();
  return (
    <Link
      href={`/nha-dat/${encodeURIComponent(code)}`}
      className="group overflow-hidden rounded-xl border border-navy/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-navy/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={placeholderImg(code)}
          alt={title}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 rounded-md bg-navy/80 px-2 py-0.5 text-xs font-medium text-white">
          {listing.deal === "cho_thue" ? "Cho thuê" : "Bán"}
        </span>
        {listing.property_type && (
          <span className="absolute right-3 top-3 rounded-md bg-white/90 px-2 py-0.5 text-xs font-medium text-navy">
            {TYPE_LABEL[listing.property_type] ?? listing.property_type}
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-4">
        <p className="line-clamp-1 font-semibold group-hover:text-brand">{title}</p>
        <p className="line-clamp-1 text-sm text-navy/60">
          {[listing.ward, listing.district ?? "Quận 5"].filter(Boolean).join(", ")}
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-lg font-bold text-brand">
            {formatPrice(listing.price_vnd, listing.price_raw)}
          </span>
          <span className="text-sm text-navy/60">{formatArea(listing.area_m2)}</span>
        </div>
        <p className="pt-1 text-xs text-navy/40">#{code}</p>
      </div>
    </Link>
  );
}
