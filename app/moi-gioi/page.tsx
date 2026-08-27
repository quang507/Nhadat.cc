// Trang môi giới (FR-125 — port ý tưởng agents từ NhaDat-Radar).
// Đọc view agents_public: chỉ tên + loại + số tin, không lộ liên hệ (FR-104).
//
// KHÔNG hiện sao/đánh giá nữa (soát 27/08/2026). `sellers.rating_sum` và
// `rating_count` chỉ từng được ghi bởi bảng `ratings` — bảng đó đã xoá theo
// OPEN-23, không còn trigger hay hàm nào đụng tới hai cột đó (kiểm: 0 trigger
// trên `sellers`, 0 hàm nhắc `rating_`, 0 seller có điểm). Để lại phần hiển
// thị nghĩa là hứa với khách một thứ VĨNH VIỄN không xảy ra — mọi môi giới sẽ
// mang nhãn "chưa có đánh giá" tới hết đời. Muốn có điểm NMG thật thì phải
// dựng nguồn ghi mới trước (OPEN-12), rồi hãy đưa lại lên trang.
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { zaloLink } from "@/lib/format";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Nhà môi giới Quận 5",
  description:
    "Mạng lưới nhà môi giới chuyên Quận 5 của nhadat.cc — giữ tối thiểu 10 tin đang rao và tỷ lệ chốt từ 5%.",
};

type Agent = {
  id: string;
  name: string | null;
  listing_count: number;
  /** FR-155 — hạng Đồng/Bạc/Vàng, tính từ số tin đang rao + tỷ lệ chốt */
  rank: string | null;
  closed_count: number | null;
};

// Hạng KHÔNG phải huy hiệu trang trí: mỗi bậc phải nói được nó dựa trên cái gì,
// nếu không nó là ngôi-sao-đánh-giá phiên bản mới — thứ vừa gỡ khỏi trang này
// vì hứa một điểm số không có nguồn ghi.
const HANG: Record<string, { ten: string; giaiThich: string; lop: string }> = {
  vang: {
    ten: "Vàng",
    giaiThich: "từ 10 tin đang rao và tỷ lệ chốt từ 5%",
    lop: "bg-[#f6c453] text-navy",
  },
  bac: {
    ten: "Bạc",
    giaiThich: "từ 5 tin đang rao, hoặc đã chốt ít nhất 1 căn",
    lop: "bg-line text-navy",
  },
  dong: {
    ten: "Đồng",
    giaiThich: "mới vào mạng lưới",
    lop: "bg-[#e2c9b0] text-navy",
  },
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
        Mạng lưới môi giới chuyên một quận, giữ tối thiểu 10 tin đang rao. Anh
        chị không cần chọn người — nhắn Zalo là tụi em điều phối.
      </p>
      <p className="mt-2 max-w-xl text-sm text-mute">
        Hạng <b>Đồng</b> mới vào mạng lưới · <b>Bạc</b> từ 5 tin đang rao hoặc đã
        chốt ít nhất 1 căn · <b>Vàng</b> từ 10 tin đang rao và tỷ lệ chốt từ 5%.
        Hạng tính lại theo dữ liệu thật, không ai tự phong.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {agents.map((a) => {
          return (
            <div key={a.id} className="flex items-center gap-4 rounded-king border border-line bg-white p-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-brand/10 text-lg font-extrabold text-brand">
                {(a.name ?? "M").trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-bold">{a.name ?? "Nhà môi giới"}</p>
                  {a.rank && HANG[a.rank] && (
                    <span
                      title={`Hạng ${HANG[a.rank].ten} — ${HANG[a.rank].giaiThich}`}
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${HANG[a.rank].lop}`}
                    >
                      {HANG[a.rank].ten}
                    </span>
                  )}
                </div>
                <p className="text-sm text-mute tabular-nums">
                  {a.listing_count} tin đang rao
                  {a.closed_count ? ` · ${a.closed_count} căn đã chốt` : ""}
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
