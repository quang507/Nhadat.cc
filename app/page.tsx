import Link from "next/link";
import ListingCard from "@/components/ListingCard";
import { IconAsk, IconCalc, IconChart, IconClock, IconShield } from "@/components/icons";
import { supabase, type Listing } from "@/lib/supabase";
import { placeholderImg, zaloLink } from "@/lib/format";
import { coverByCode } from "@/lib/photos";

export const revalidate = 300;

const WARDS = [
  "Phường 1", "Phường 2", "Phường 3", "Phường 4", "Phường 5", "Phường 6", "Phường 7",
  "Phường 8", "Phường 9", "Phường 10", "Phường 11", "Phường 12", "Phường 13", "Phường 14",
];

async function getListings(deal: "ban" | "cho_thue", limit: number) {
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("deal", deal)
    .in("status", ["dang_ban", "dang_quan_tam"]) // FR-139: chỉ tin đang lên kệ
    .not("price_raw", "is", null)
    .neq("price_raw", "")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Listing[];
}

export default async function Home() {
  const [ban, thue] = await Promise.all([getListings("ban", 9), getListings("cho_thue", 4)]);
  // FR-148: ảnh bìa thật theo mã tin (bucket listing-photos), thiếu thì ảnh minh hoạ
  const covers = await coverByCode([...ban, ...thue].map((l) => l.code));

  return (
    <>
      {/* Hero — search là ô chat (INS-07); nền ảnh thật thay màu phẳng */}
      <section className="relative overflow-hidden bg-navy text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={placeholderImg("hero-q5")}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/80 to-navy/30" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
            Môi giới thường trực · Quận 5
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-extrabold leading-[1.1] [text-wrap:balance] md:text-6xl">
            Tìm nhà Quận 5?{" "}
            <span className="text-brand">Nhắn một câu là xong.</span>
          </h1>
          <p className="mt-5 max-w-lg text-white/70">
            Tụi em không hỏi số điện thoại, không spam. Trợ lý trực 24/7 trên
            Zalo — hỏi kiểu gì cũng hiểu: “nhà gần hồ bơi Lam Sơn”, “hẻm xe hơi
            dưới 10 tỉ”…
          </p>
          <a
            href={zaloLink("hero")}
            className="mt-8 flex max-w-2xl items-center gap-3 rounded-king bg-white p-2.5 pl-5 text-navy shadow-2xl transition hover:-translate-y-0.5 active:scale-[0.99]"
          >
            <span className="flex-1 truncate text-mute">
              “Có nhà gần ngã tư Nguyễn Trãi với Trần Bình Trọng không em?”
            </span>
            <span className="shrink-0 rounded-[10px] bg-zalo px-5 py-3 font-semibold text-white">
              Hỏi qua Zalo
            </span>
          </a>
          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            {["Nhà phố", "Hẻm xe hơi", "Mặt tiền", "Chung cư", "Dưới 10 tỉ"].map((t) => (
              <a
                key={t}
                href={zaloLink(`tag:${t}`)}
                className="rounded-full border border-white/25 px-4 py-1.5 text-white/85 transition hover:border-brand hover:text-brand"
              >
                {t}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Lời hứa — bố cục lệch: 1 khối lớn + 2 khối xếp dọc */}
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-12 md:grid-cols-5">
        <div className="rounded-king border border-line bg-white p-7 md:col-span-3">
          <IconShield className="h-8 w-8 text-brand" />
          <h2 className="mt-3 text-xl font-extrabold">Không thu số điện thoại</h2>
          <p className="mt-2 max-w-md text-mute">
            Để lại số trên trang nhà đất là ăn 40 cuộc gọi trong 3 ngày — tụi em
            biết nên không làm vậy. Chỉ khi hẹn xem nhà xong mới cần trao đổi
            liên hệ, và luôn có đường từ chối.
          </p>
        </div>
        <div className="grid gap-4 md:col-span-2">
          <div className="rounded-lg border border-line bg-white p-5">
            <div className="flex items-center gap-3">
              <IconClock className="h-6 w-6 shrink-0 text-brand" />
              <p className="font-bold">Trực 24/7, nhớ nhu cầu của anh chị</p>
            </div>
            <p className="mt-1.5 text-sm text-mute">
              Chat hôm nay, ba tháng sau quay lại vẫn tiếp đúng chỗ cũ.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-white p-5">
            <div className="flex items-center gap-3">
              <IconAsk className="h-6 w-6 shrink-0 text-brand" />
              <p className="font-bold">Thiếu thông tin thì đi hỏi giùm</p>
            </div>
            <p className="mt-1.5 text-sm text-mute">
              Chưa rõ pháp lý, hẻm rộng bao nhiêu — tụi em hỏi chủ nhà rồi báo lại.
            </p>
          </div>
        </div>
      </section>

      {/* BĐS đang bán — căn đầu nổi bật, phá lưới đều */}
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-2xl font-extrabold">Nhà đất đang bán tại Quận 5</h2>
          <Link href="/mua-ban" className="text-sm font-semibold text-brand hover:underline">
            Xem tất cả →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ban[0] && (
            <div className="sm:col-span-2 sm:row-span-2 lg:col-span-2">
              <ListingCard listing={ban[0]} featured photo={ban[0].code ? covers[ban[0].code] : null} />
            </div>
          )}
          {ban.slice(1).map((l) => (
            <ListingCard key={l.id} listing={l} photo={l.code ? covers[l.code] : null} />
          ))}
        </div>
      </section>

      {/* Công cụ (port từ NhaDat-Radar) */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/tinh-lai-vay"
            className="group flex items-center gap-4 rounded-king border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <IconCalc className="h-9 w-9 shrink-0 text-brand" />
            <span>
              <span className="block font-bold group-hover:text-brand">Tính lãi vay mua nhà</span>
              <span className="text-sm text-mute">Mỗi tháng trả bao nhiêu, xem trước rồi hãy quyết.</span>
            </span>
          </Link>
          <Link
            href="/thong-ke"
            className="group flex items-center gap-4 rounded-king border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <IconChart className="h-9 w-9 shrink-0 text-brand" />
            <span>
              <span className="block font-bold group-hover:text-brand">Giá theo phường Quận 5</span>
              <span className="text-sm text-mute">Phường nào đang rao đắt nhất, tính từ tin thật.</span>
            </span>
          </Link>
        </div>
      </section>

      {/* Cho thuê */}
      {thue.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-6">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-2xl font-extrabold">Đang cho thuê</h2>
            <Link href="/cho-thue" className="text-sm font-semibold text-brand hover:underline">
              Xem tất cả →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {thue.map((l) => (
              <ListingCard key={l.id} listing={l} photo={l.code ? covers[l.code] : null} />
            ))}
          </div>
        </section>
      )}

      {/* Khu vực theo phường (taxonomy 04, địa giới cũ — INS-12) */}
      <section className="mx-auto max-w-6xl px-4 py-6">
        <h2 className="mb-5 text-2xl font-extrabold">Theo phường — Quận 5</h2>
        <div className="flex flex-wrap gap-2">
          {WARDS.map((w) => (
            <Link
              key={w}
              href={`/mua-ban?phuong=${encodeURIComponent(w)}`}
              className="rounded-full border border-line bg-white px-4 py-1.5 text-sm transition hover:border-brand hover:text-brand"
            >
              {w}
            </Link>
          ))}
        </div>
      </section>

      {/* CTA rao bán (INS-05) — nền ảnh mờ thay màu phẳng */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="relative overflow-hidden rounded-king bg-brand text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={placeholderImg("cta-raoban")}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-15 mix-blend-luminosity"
          />
          <div className="relative px-6 py-12 md:px-12">
            <h2 className="text-2xl font-extrabold [text-wrap:balance] md:text-3xl">
              Rao bán? Một câu là xong.
            </h2>
            <p className="mt-2 max-w-xl text-white/85">
              “Bán nhà HXH xe tải quay đầu, gần ngã tư Trần Bình Trọng, 9 tỉ bớt
              lộc” — nhắn vậy là đủ. Tụi em viết lại tin, trả lời khách, chỉ liên
              hệ anh chị khi thật sự cần.
            </p>
            <Link
              href="/raoban"
              className="mt-6 inline-block rounded-full bg-white px-6 py-3 font-bold text-brand transition hover:bg-cream active:scale-[0.98]"
            >
              Rao bán ngay — miễn phí
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
