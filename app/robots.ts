import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/format";

// NFR-09 — trang riêng tư / theo tài khoản không cho cào.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // IA-11 `/ds/` (danh sách riêng, token) và IA-02 kết quả tìm kiếm `/api/` không cào.
      disallow: ["/admin", "/quan-ly", "/tai-khoan", "/yeu-thich", "/dang-nhap", "/ds/", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
