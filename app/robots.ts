import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/format";

// NFR-09 — trang riêng tư / theo tài khoản không cho cào.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/quan-ly", "/tai-khoan", "/yeu-thich", "/dang-nhap"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
