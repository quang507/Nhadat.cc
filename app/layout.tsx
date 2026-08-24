import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam",
});

export const metadata: Metadata = {
  title: {
    default: "nhadat.cc — Mua bán nhà đất Quận 5, chat là xong",
    template: "%s | nhadat.cc",
  },
  description:
    "Môi giới bất động sản Quận 5 trực 24/7 qua Zalo. Không thu số điện thoại, không spam. Nhà phố, hẻm xe hơi, mặt tiền — hỏi là có.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={beVietnam.variable}>
      <body className="font-sans">
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
