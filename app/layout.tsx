import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ZaloWidget from "@/components/ZaloWidget";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin", "vietnamese"],
  // Không có `font-black` nào trong app — bỏ 900 là bớt hai file font
  // (latin + vietnamese) mỗi lượt tải đầu (FR-171 j).
  weight: ["400", "600", "700", "800"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: {
    default: "nhadat.cc — Mua bán nhà đất Sài Gòn & Long An, chat là xong",
    template: "%s | nhadat.cc",
  },
  description:
    "Môi giới bất động sản Sài Gòn (các phường mới) và Long An, trực 24/7 qua Zalo. Không thu số điện thoại, không spam. Nhà phố, hẻm xe hơi, mặt tiền — hỏi là có.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={nunito.variable}>
      <body className="font-sans">
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
        <ZaloWidget />
      </body>
    </html>
  );
}
