import { pricingMarkdown } from "../pricing/_components/pricing-data";

/**
 * /pricing.md: machine-readable mirror of /pricing (site-architecture §5.5),
 * generated from the same price data as the page. The folder name carries the
 * ".md" so the URL is literally /pricing.md. Prerendered at build time.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(pricingMarkdown(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
