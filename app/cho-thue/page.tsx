import type { Metadata } from "next";
import ListingBrowse from "@/components/ListingBrowse";

// Đọc `searchParams` → route ƒ; `revalidate` ở đây là chữ chết (xem /mua-ban).
export const metadata: Metadata = {
  title: "Cho thuê nhà đất Quận 5",
  description:
    "Nhà, mặt bằng, phòng cho thuê tại Quận 5, TP.HCM. Hỏi chi tiết qua Zalo, không cần để lại số điện thoại.",
};

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ phuong?: string; trang?: string }>;
}) {
  return (
    <ListingBrowse
      deal="cho_thue"
      title="Cho thuê nhà đất"
      basePath="/cho-thue"
      searchParams={searchParams}
    />
  );
}
