import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { ThemeProvider } from "@/components/theme-provider";
import { BfcacheFix } from "@/components/bfcache-fix";
import { MotionRoot } from "@/components/motion-root";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { JsonLd } from "@/components/site/json-ld";
import { graph, organization, website } from "@/lib/schema";
import { UI_STRINGS } from "@/lib/site";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const DEFAULT_TITLE = "Customs Filing Software for ISF and Entries | MyCargoLens";
const DEFAULT_DESCRIPTION =
  "File ISF and customs entries with CBP from one inbox ranked by what needs you now. Per-shipment price, charged when CBP accepts.";

export const metadata: Metadata = {
  metadataBase: new URL("https://mycargolens.com"),
  // Fallbacks only: every page sets its own title, description, canonical
  // and openGraph (site-architecture §5.5).
  title: {
    default: DEFAULT_TITLE,
    template: "%s | MyCargoLens",
  },
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://mycargolens.com",
    siteName: "MyCargoLens",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  // Per-route canonicals are set on each page's own metadata export so
  // search engines can distinguish /pricing from /platform/compliance
  // etc. instead of collapsing everything to the homepage. metadataBase
  // above resolves each page's relative "/foo" into a full URL.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.className} antialiased`} suppressHydrationWarning>
      <body className="bg-background min-h-screen flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
        >
          {UI_STRINGS.skipLink}
        </a>
        <JsonLd data={graph(organization(), website())} />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <MotionRoot>
            <BfcacheFix />
            <Nav />
            <main id="main" tabIndex={-1} className="flex-1 outline-none">{children}</main>
            <Footer />
            <ChatWidget />
          </MotionRoot>
        </ThemeProvider>
      </body>
    </html>
  );
}
