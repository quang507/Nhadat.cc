// Trang môi giới (FR-125 — port ý tưởng agents từ NhaDat-Radar).
// Đọc view agents_public: chỉ tên + loại + điểm, không lộ liên hệ (FR-104).
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { zaloLink } from "@/lib/format";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Nhà môi giới Quận 5",
  description:
    "Mạng lưới nhà môi giới chuyên Quận 5 của nhadat.cc — chấm điểm theo từng lần dẫn khách, dưới 3 sao là dừng hợp tác.",
};

type Agent = {
  id: string;
  name: string | null;
  rating_sum: number | null;
  rating_count: number | null;
  listing_count: number;
};

export default async function Page() {
  const { data } = await supabase
    .from("agents_public")
    .select("*")
    .order("listing_count", { ascending: false });
  const agents = (data ?? []) as Agent[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-extrabold [text-wrap:balance]">Nhà môi giới chuyên Quận 5</h1>
      <p className="mt-2 max-w-xl text-mute">
        Mỗi lần dẫn khách xem nhà đều được chấm điểm; môi giới bị chấm dưới 3
        sao ở bất kỳ tương tác nào là tụi em dừng hợp tác. Anh chị không cần
        chọn người — nhắn Zalo là tụi em điều phối.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {agents.map((a) => {
          const rating =
            a.rating_count && a.rating_count > 0
              ? ((a.rating_sum ?? 0) / a.rating_count).toFixed(1)
              : null;
          return (
            <div key={a.id} className="flex items-center gap-4 rounded-king border border-line bg-white p-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-brand/10 text-lg font-extrabold text-brand">
                {(a.name ?? "M").trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-bold">{a.name ?? "Nhà môi giới"}</p>
                <p className="text-sm text-mute tabular-nums">
                  {a.listing_count} tin đang rao
                  {rating ? ` · ${rating}★ (${a.rating_count} đánh giá)` : " · chưa có đánh giá"}
                </p>
              </div>
            </div>
          );
        })}
        {agents.length === 0 && (
          <div className="rounded-king border border-line bg-white p-8 text-center text-mute sm:col-span-2">
            Mạng lưới đang tuyển — mục tiêu 20 nhà môi giới chuyên Quận 5.
          </div>
        )}
      </div>

      <div className="mt-10 rounded-king bg-navy px-6 py-8 text-white">
        <h2 className="text-xl font-extrabold">Anh chị là môi giới khu Quận 5?</h2>
        <p className="mt-1 max-w-lg text-white/70">
          Vào mạng lưới: phí 0.5% mỗi giao dịch thành công, khách tụi em chuyển
          tận nơi. Yêu cầu giữ tối thiểu 10 tin và tỷ lệ chốt từ 5%.
        </p>
        <a
          href={zaloLink("nmg-apply")}
          className="mt-4 inline-block rounded-full bg-zalo px-6 py-2.5 font-bold text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          Nhắn Zalo để tham gia
        </a>
      </div>
    </div>
  );
}
