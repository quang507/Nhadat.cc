import Link from "next/link";
import { zaloLink } from "@/lib/format";

const NAV = [
  { href: "/mua-ban", label: "Mua bán" },
  { href: "/cho-thue", label: "Cho thuê" },
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
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-brand">
              {n.label}
            </Link>
          ))}
        </nav>
        <a
          href={zaloLink("header")}
          className="rounded-full bg-zalo px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90"
        >
          Chat Zalo — miễn phí
        </a>
      </div>
    </header>
  );
}
