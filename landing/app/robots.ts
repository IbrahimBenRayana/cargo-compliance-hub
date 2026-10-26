import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * /robots.txt (site-architecture §5.5): allow everyone, including search and
 * user-retrieval bots (OAI-SearchBot, ChatGPT-User, PerplexityBot,
 * Claude-SearchBot); keep /api/ out. Noindex pages are handled by their own
 * robots meta, which crawlers must be allowed to fetch to see.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
