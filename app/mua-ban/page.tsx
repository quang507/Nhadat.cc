import type { Metadata } from "next";
import ListingBrowse from "@/components/ListingBrowse";

// Trang này đọc `searchParams` nên Next dựng lại từng request (ƒ); dòng
// `export const revalidate` từng nằm đây là CHỮ CHẾT — cache thật là
// `unstable_cache` trong ListingBrowse (NFR-17). Bỏ để khỏi gây hiểu lầm.
export const metadata: Metadata = {
  title: "Mua bán nhà đất Quận 5 — giá mới nhất",
  description:
    "Danh sách nhà đất đang bán tại Quận 5, TP.HCM: nhà phố, hẻm xe hơi, mặt tiền. Hỏi chi tiết từng căn qua Zalo, không cần để lại số điện thoại.",
};

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ phuong?: string; trang?: string }>;
}) {
  return (
    <ListingBrowse
      deal="ban"
      title="Mua bán nhà đất"
      basePath="/mua-ban"
      searchParams={searchParams}
    />
  );
}
