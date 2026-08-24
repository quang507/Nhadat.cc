import Link from "next/link";
import ListingCard from "@/components/ListingCard";
import { supabase, type Listing } from "@/lib/supabase";
import { zaloLink } from "@/lib/format";

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
    .not("price_raw", "is", null)
    .neq("price_raw", "")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Listing[];
}

export default async function Home() {
  const [ban, thue] = await Promise.all([getListings("ban", 8), getListings("cho_thue", 4)]);

  return (
    <>
      {/* Hero — search là ô chat (INS-07) */}
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <h1 className="max-w-2xl text-3xl font-extrabold leading-tight md:text-5xl">
            Tìm nhà Quận 5?{" "}
            <span className="text-brand">Nhắn một câu là xong.</span>
          </h1>
          <p className="mt-4 max-w-xl text-white/70">
            Tụi em không hỏi số điện thoại, không spam. Trợ lý trực 24/7 trên
            Zalo — hỏi kiểu gì cũng hiểu: “nhà gần hồ bơi Lam Sơn”, “hẻm xe hơi
            dưới 10 tỉ”…
          </p>
          <a
            href={zaloLink("hero")}
            className="mt-8 flex max-w-2xl items-center gap-3 rounded-2xl bg-white p-3 pl-5 text-navy shadow-xl transition hover:shadow-2xl"
          >
            <span className="flex-1 text-navy/50">
              Ví dụ: “Có nhà gần ngã tư Nguyễn Trãi với Trần Bình Trọng không em?”
            </span>
            <span className="rounded-xl bg-zalo px-5 py-3 font-semibold text-white">
              Hỏi qua Zalo
            </span>
          </a>
          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            {["Nhà phố", "Hẻm xe hơi", "Mặt tiền", "Chung cư", "Dưới 10 tỉ"].map((t) => (
              <a
                key={t}
                href={zaloLink(`tag:${t}`)}
                className="rounded-full border border-white/25 px-4 py-1.5 text-white/85 hover:border-brand hover:text-brand"
              >
                {t}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 3 lời hứa */}
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-10 md:grid-cols-3">
        {[
          ["🔒", "Không thu số điện thoại", "Xem nhà xong mới cần trao đổi liên hệ — và luôn có đường từ chối."],
          ["🕐", "Trực 24/7, nhớ nhu cầu của anh chị", "Chat hôm nay, ba tháng sau quay lại vẫn tiếp đúng chỗ cũ."],
          ["📋", "Thiếu thông tin thì đi hỏi giùm", "Chưa rõ pháp lý, hẻm rộng bao nhiêu — tụi em hỏi chủ nhà rồi báo lại."],
        ].map(([icon, title, desc]) => (
          <div key={title} className="rounded-xl border border-navy/10 bg-cream p-5">
            <p className="text-2xl">{icon}</p>
            <p className="mt-2 font-bold">{title}</p>
            <p className="mt-1 text-sm text-navy/60">{desc}</p>
          </div>
        ))}
      </section>

      {/* BĐS đang bán */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-2xl font-extrabold">Nhà đất đang bán tại Quận 5</h2>
          <Link href="/mua-ban" className="text-sm font-semibold text-brand hover:underline">
            Xem tất cả →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ban.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      </section>

      {/* Cho thuê */}
      {thue.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-2xl font-extrabold">Đang cho thuê</h2>
            <Link href="/cho-thue" className="text-sm font-semibold text-brand hover:underline">
              Xem tất cả →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {thue.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        </section>
      )}

      {/* Khu vực theo phường (taxonomy 04, địa giới cũ — INS-12) */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="mb-5 text-2xl font-extrabold">Theo phường — Quận 5</h2>
        <div className="flex flex-wrap gap-2">
          {WARDS.map((w) => (
            <Link
              key={w}
              href={`/mua-ban?phuong=${encodeURIComponent(w)}`}
              className="rounded-full border border-navy/15 px-4 py-1.5 text-sm hover:border-brand hover:text-brand"
            >
              {w}
            </Link>
          ))}
        </div>
      </section>

      {/* CTA rao bán (INS-05) */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-2xl bg-brand px-6 py-10 text-white md:px-12">
          <h2 className="text-2xl font-extrabold md:text-3xl">
            Rao bán? Một câu là xong.
          </h2>
          <p className="mt-2 max-w-xl text-white/85">
            “Bán nhà HXH xe tải quay đầu, gần ngã tư Trần Bình Trọng, 9 tỉ bớt
            lộc” — nhắn vậy là đủ. Tụi em viết lại tin, trả lời khách, chỉ liên
            hệ anh chị khi thật sự cần.
          </p>
          <Link
            href="/raoban"
            className="mt-6 inline-block rounded-xl bg-white px-6 py-3 font-bold text-brand hover:bg-cream"
          >
            Rao bán ngay — miễn phí
          </Link>
        </div>
      </section>
    </>
  );
}
