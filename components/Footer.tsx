import Link from "next/link";
import { zaloLink } from "@/lib/format";

export default function Footer() {
  return (
    <>
      <footer className="bg-navy text-white/80">
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
              <li><Link href="/ban-do" className="hover:text-brand">Bản đồ nhà đất</Link></li>
              <li><Link href="/tinh-lai-vay" className="hover:text-brand">Tính lãi vay</Link></li>
              <li><Link href="/thong-ke" className="hover:text-brand">Giá theo phường</Link></li>
              <li><Link href="/dang-nhap" className="hover:text-brand">Dành cho nhà môi giới</Link></li>
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
      {/* Bỏ nút sticky mobile cũ ở đây: nó trùng y hệt ZaloWidget (FR-145) vốn
          đã nổi sẵn mọi trang, nên trên mobile hiện hai nút Zalo chồng nhau. */}
    </>
  );
}
