import type { Metadata } from "next";
import ListingBrowse from "@/components/ListingBrowse";

export const revalidate = 300;
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
