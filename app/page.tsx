import Link from "next/link";
import ListingCard from "@/components/ListingCard";
import { IconAsk, IconChart, IconCalc, IconClock, IconSearch, IconShield } from "@/components/icons";
import { CARD_COLS, supabase, type ListingCard as CardRow } from "@/lib/supabase";
import { placeholderImg, zaloLink } from "@/lib/format";
import { coverByCode } from "@/lib/photos";
import { WARDS } from "@/lib/geo";
import { FEATURED_TAGS } from "@/lib/tags";

export const revalidate = 300;

async function getListings(deal: "ban" | "cho_thue", limit: number) {
  const { data } = await supabase
    .from("listings")
    .select(CARD_COLS) // FR-171 j: thẻ không cần mô tả
    .eq("deal", deal)
    .in("status", ["dang_ban", "dang_quan_tam"]) // FR-139: chỉ tin đang lên kệ
    .not("price_raw", "is", null)
    .neq("price_raw", "")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as CardRow[];
}

export default async function Home() {
  const [ban, thue] = await Promise.all([getListings("ban", 8), getListings("cho_thue", 4)]);
  // FR-148: ảnh bìa thật theo mã tin (bucket listing-photos), thiếu thì ảnh minh hoạ
  const covers = await coverByCode([...ban, ...thue].map((l) => l.code));

  return (
    <>
      {/* HERO — hai cột. Ảnh minh hoạ trong kho chỉ 450×600 (DỌC); bản cũ trải
          nó full-bleed ngang 1900px, phóng hơn 4 lần nên nhoè nhoẹt rồi phải
          dìm opacity-25 thành mảng xám. Đặt vào panel dọc bên phải là ảnh chạy
          gần đúng cỡ thật, sắc nét, mà bố cục lại thoáng hơn. */}
      {/* KHÔNG để overflow-hidden ở section này: thẻ hỏi-Zalo bên dưới cố ý thò
          ra ngoài đáy hero, có overflow-hidden là bị cắt cụt mất nửa nút. Vệt
          sáng trang trí thì bọc riêng trong lớp clip của chính nó. */}
      <section className="relative bg-navy text-white">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand/20 blur-3xl" />
        </div>
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-28 pt-14 md:grid-cols-[1.15fr_.85fr] md:pt-16">
          <div>
            <p className="eyebrow text-brand">Môi giới thường trực · Sài Gòn & Long An</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.08] [text-wrap:balance] md:text-5xl">
              Tìm nhà Sài Gòn, Long An?
              <br />
              Nhắn một câu là xong.
            </h1>
            <p className="mt-5 max-w-md leading-7 text-white/70">
              Tụi em không hỏi số điện thoại, không spam. Trợ lý trực 24/7 trên
              Zalo, hỏi kiểu gì cũng hiểu: “nhà gần hồ bơi Lam Sơn”, “hẻm xe hơi
              dưới 10 tỉ”.
            </p>
            <div className="mt-7 flex flex-wrap gap-2 text-sm">
              {/* FR-12: chip là link trang tag (SSG), không còn đẩy thẳng sang Zalo */}
              {FEATURED_TAGS.slice(0, 5).map((t) => (
                <Link
                  key={t.slug}
                  href={`/${t.slug}`}
                  className="rounded-full border border-white/20 px-4 py-1.5 text-white/85 transition hover:border-brand hover:bg-brand hover:text-white"
                >
                  {t.keyword}
                </Link>
              ))}
            </div>
          </div>
          {/* Ảnh dọc, đúng khung của nó */}
          <div className="relative hidden md:block">
            <div className="overflow-hidden rounded-king border border-white/10 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={placeholderImg("hero-q5")}
                alt="Nhà phố Quận 5"
                fetchPriority="high"
                decoding="async"
                className="aspect-[4/5] w-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Thẻ hỏi-Zalo nổi đè lên chân hero — vị trí thanh search của Veedoo.
            FR-02 muốn ô search dạng chat; nhưng nó KHÔNG phải ô nhập liệu, nên
            để hẳn dạng câu hỏi trong ngoặc kép + nút, đừng giả làm input. */}
        <div className="relative mx-auto -mb-14 max-w-6xl px-4">
          <a
            href={zaloLink("hero")}
            className="flex flex-col gap-3 rounded-king bg-white p-4 text-navy shadow-[0_18px_40px_rgba(13,37,61,0.18)] transition hover:-translate-y-0.5 sm:flex-row sm:items-center sm:gap-4 sm:p-3 sm:pl-6"
          >
            <IconSearch className="hidden h-5 w-5 shrink-0 text-brand sm:block" />
            <span className="flex-1 leading-6 text-mute">
              “Có nhà gần ngã tư Nguyễn Trãi với Trần Bình Trọng không em?”
            </span>
            <span className="shrink-0 rounded-full bg-brand px-6 py-3 text-center font-bold text-white">
              Hỏi qua Zalo
            </span>
          </a>
        </div>
      </section>

      {/* LỜI HỨA */}
      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-4 pt-24 md:grid-cols-3">
        {[
          { Icon: IconShield, t: "Không thu số điện thoại", d: "Để lại số trên trang nhà đất là ăn 40 cuộc gọi trong 3 ngày. Chỉ khi hẹn xem nhà mới cần liên hệ, và luôn có đường từ chối." },
          { Icon: IconClock, t: "Trực 24/7, nhớ nhu cầu", d: "Chat hôm nay, ba tháng sau quay lại vẫn tiếp đúng chỗ cũ, không hỏi lại từ đầu." },
          { Icon: IconAsk, t: "Thiếu gì thì đi hỏi giùm", d: "Chưa rõ pháp lý, hẻm rộng bao nhiêu — tụi em hỏi chủ nhà rồi báo lại anh chị." },
        ].map(({ Icon, t, d }) => (
          <div key={t} className="rounded-king bg-white p-6 shadow-[0_2px_14px_rgba(13,37,61,0.06)]">
            <span className="grid h-11 w-11 place-items-center rounded-shot bg-brand/10 text-brand">
              <Icon className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-extrabold">{t}</h2>
            <p className="mt-1.5 text-sm leading-6 text-mute">{d}</p>
          </div>
        ))}
      </section>

      {/* ĐANG BÁN */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-brand">Kho tin</p>
            <h2 className="mt-1.5 text-2xl font-extrabold md:text-3xl">Nhà đất đang bán — khởi điểm khu Quận 5 cũ</h2>
          </div>
          <Link
            href="/mua-ban"
            className="shrink-0 rounded-full border border-line bg-white px-5 py-2.5 text-sm font-bold transition hover:border-brand hover:text-brand"
          >
            Xem tất cả
          </Link>
        </div>
        {/* Lưới đều 4 cột — bản cũ cho căn đầu chiếm 2×2 giữa lưới 4 cột với 9
            tin, đội hình vỡ và luôn hụt một ô. Đều thì gọn. */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ban.map((l) => (
            <ListingCard key={l.id} listing={l} photo={l.code ? covers[l.code] : null} />
          ))}
        </div>
      </section>

      {/* CHO THUÊ */}
      {thue.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-10">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-brand">Kho tin</p>
              <h2 className="mt-1.5 text-2xl font-extrabold md:text-3xl">Đang cho thuê</h2>
            </div>
            <Link
              href="/cho-thue"
              className="shrink-0 rounded-full border border-line bg-white px-5 py-2.5 text-sm font-bold transition hover:border-brand hover:text-brand"
            >
              Xem tất cả
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {thue.map((l) => (
              <ListingCard key={l.id} listing={l} photo={l.code ? covers[l.code] : null} />
            ))}
          </div>
        </section>
      )}

      {/* CÔNG CỤ + PHƯỜNG — gộp một hàng cho đỡ rời rạc */}
      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-10 lg:grid-cols-2">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { href: "/tinh-lai-vay", Icon: IconCalc, t: "Tính lãi vay mua nhà", d: "Mỗi tháng trả bao nhiêu, xem trước rồi hãy quyết." },
            { href: "/thong-ke", Icon: IconChart, t: "Giá theo phường", d: "Phường nào đang rao đắt nhất, tính từ tin thật trong kho." },
          ].map(({ href, Icon, t, d }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-king bg-white p-5 shadow-[0_2px_14px_rgba(13,37,61,0.06)] transition hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(13,37,61,0.13)]"
            >
              <span className="grid h-11 w-11 place-items-center rounded-shot bg-brand/10 text-brand">
                <Icon className="h-6 w-6" />
              </span>
              <p className="mt-4 font-extrabold group-hover:text-brand">{t}</p>
              <p className="mt-1 text-sm leading-6 text-mute">{d}</p>
            </Link>
          ))}
        </div>
        <div className="rounded-king bg-white p-6 shadow-[0_2px_14px_rgba(13,37,61,0.06)]">
          <p className="eyebrow text-brand">Theo phường</p>
          <h2 className="mt-1.5 text-xl font-extrabold">Chọn khu anh chị đang nhắm</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {WARDS.map((w) => (
              <Link
                key={w}
                href={`/mua-ban?phuong=${encodeURIComponent(w)}`}
                className="rounded-full border border-line px-3.5 py-1.5 text-sm transition hover:border-brand hover:text-brand"
              >
                {w}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA RAO BÁN — navy như khối thông số Veedoo, không dùng ảnh kéo giãn */}
      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="relative overflow-hidden rounded-king bg-navy px-6 py-12 text-white md:px-12">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />
          <div className="relative max-w-xl">
            <p className="eyebrow text-brand">Dành cho người bán</p>
            <h2 className="mt-3 text-2xl font-extrabold [text-wrap:balance] md:text-3xl">
              Rao bán? Một câu là xong.
            </h2>
            <p className="mt-3 leading-7 text-white/75">
              “Bán nhà HXH xe tải quay đầu, gần ngã tư Trần Bình Trọng, 9 tỉ bớt
              lộc” — nhắn vậy là đủ. Tụi em viết lại tin, trả lời khách, chỉ liên
              hệ anh chị khi thật sự cần.
            </p>
            <Link
              href="/raoban"
              className="mt-7 inline-block rounded-full bg-brand px-7 py-3.5 font-bold text-white transition hover:bg-brand-dark active:scale-[0.98]"
            >
              Rao bán ngay — miễn phí
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
