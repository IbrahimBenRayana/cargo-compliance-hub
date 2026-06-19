// Sitemap (audit Phase 9.3). Next.js reads this and serves /sitemap.xml.
// Every public route is enumerated so search engines can discover the
// full surface without crawling. Update this list when adding/removing
// top-level routes; sub-route changes inside platform/* are picked up
// because each /platform/<slug> route is listed.
import type { MetadataRoute } from "next";

const BASE = "https://mycargolens.com";

const ROUTES: Array<{ path: string; priority?: number; changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/",                       priority: 1.0,  changeFrequency: "weekly"  },
  { path: "/features",               priority: 0.8,  changeFrequency: "monthly" },
  { path: "/platform/filings",       priority: 0.8,  changeFrequency: "monthly" },
  { path: "/platform/compliance",    priority: 0.8,  changeFrequency: "monthly" },
  { path: "/platform/ai",            priority: 0.8,  changeFrequency: "monthly" },
  { path: "/platform/lifecycle",     priority: 0.8,  changeFrequency: "monthly" },
  { path: "/platform/automation",    priority: 0.8,  changeFrequency: "monthly" },
  { path: "/why-mycargolens",        priority: 0.8,  changeFrequency: "monthly" },
  { path: "/solutions",              priority: 0.7,  changeFrequency: "monthly" },
  { path: "/pricing",                priority: 0.9,  changeFrequency: "monthly" },
  { path: "/book-a-demo",            priority: 0.9,  changeFrequency: "yearly"  },
  { path: "/security",               priority: 0.6,  changeFrequency: "monthly" },
  { path: "/about",                  priority: 0.6,  changeFrequency: "yearly"  },
  { path: "/contact",                priority: 0.6,  changeFrequency: "yearly"  },
  { path: "/changelog",              priority: 0.7,  changeFrequency: "weekly"  },
  { path: "/legal/privacy",          priority: 0.3,  changeFrequency: "yearly"  },
  { path: "/legal/terms",            priority: 0.3,  changeFrequency: "yearly"  },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified: new Date("2026-06-02"),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
