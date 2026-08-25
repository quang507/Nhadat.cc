import Link from "next/link";
import { IconHeart } from "@/components/icons";
import { zaloLink } from "@/lib/format";

const NAV = [
  { href: "/mua-ban", label: "Mua bán" },
  { href: "/cho-thue", label: "Cho thuê" },
  { href: "/ban-do", label: "Bản đồ" },
  { href: "/thong-ke", label: "Giá theo phường" },
  { href: "/moi-gioi", label: "Môi giới" },
  { href: "/raoban", label: "Rao bán" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-baseline gap-0.5 text-2xl font-extrabold">
          <span className="text-navy">nhadat</span>
          <span className="text-brand">.cc</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="transition hover:text-brand">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/yeu-thich"
            aria-label="Tin đã lưu"
            className="grid h-9 w-9 place-items-center rounded-full border border-line text-navy transition hover:border-brand hover:text-brand"
          >
            <IconHeart className="h-4.5 w-4.5" />
          </Link>
          <a
            href={zaloLink("header")}
            className="rounded-full bg-zalo px-4 py-2 text-sm font-semibold text-white shadow transition hover:opacity-90 active:scale-[0.98]"
          >
            Chat Zalo — miễn phí
          </a>
        </div>
      </div>
    </header>
  );
}
