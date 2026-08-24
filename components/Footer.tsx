import Link from "next/link";
import { zaloLink } from "@/lib/format";

export default function Footer() {
  return (
    <>
      <footer className="mt-16 bg-navy text-white/80">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3">
          <div>
            <p className="text-xl font-extrabold text-white">
              nhadat<span className="text-brand">.cc</span>
            </p>
            <p className="mt-3 text-sm leading-6">
              Môi giới bất động sản Quận 5 trực 24/7 qua Zalo. Không thu số điện
              thoại, không spam — trò chuyện tới khi anh chị tìm được nhà.
            </p>
          </div>
          <div className="text-sm">
            <p className="mb-3 font-semibold text-white">Khu vực</p>
            <ul className="space-y-2">
              <li><Link href="/mua-ban" className="hover:text-brand">Mua bán nhà đất Quận 5</Link></li>
              <li><Link href="/cho-thue" className="hover:text-brand">Cho thuê nhà đất Quận 5</Link></li>
              <li><Link href="/raoban" className="hover:text-brand">Rao bán — một câu là xong</Link></li>
            </ul>
          </div>
          <div className="text-sm">
            <p className="mb-3 font-semibold text-white">Liên hệ</p>
            <ul className="space-y-2">
              <li><a href={zaloLink("footer")} className="hover:text-brand">Zalo OA nhadat.cc</a></li>
              <li>admin.buyerside@nhadat.cc</li>
              <li className="text-white/50">Địa giới hiển thị theo quận/phường trước 1/7/2025</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
          © 2026 nhadat.cc — Người môi giới thường trực của anh chị
        </div>
      </footer>
      {/* Sticky CTA Zalo trên mobile (docs/05) */}
      <a
        href={zaloLink("sticky")}
        className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-zalo px-6 py-3 text-sm font-bold text-white shadow-xl md:hidden"
      >
        💬 Hỏi nhà qua Zalo
      </a>
    </>
  );
}
