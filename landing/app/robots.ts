// robots.txt (audit Phase 9.3). Next.js reads this and serves /robots.txt.
// Marketing site is fully indexable; the app subdomain (app.mycargolens.com)
// runs the authenticated product and is not crawled here — it has no
// publicly accessible content.
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Block API or asset paths that have no SEO value if they leak.
      disallow: ["/api/"],
    },
    sitemap: "https://mycargolens.com/sitemap.xml",
    host: "https://mycargolens.com",
  };
}
