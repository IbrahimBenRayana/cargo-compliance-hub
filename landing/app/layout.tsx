import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { ThemeProvider } from "@/components/theme-provider";
import { BfcacheFix } from "@/components/bfcache-fix";
import { MotionRoot } from "@/components/motion-root";
import { ChatWidget } from "@/components/chat/ChatWidget";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mycargolens.com"),
  title: {
    default: "MyCargoLens — CBP Compliance Platform",
    template: "%s — MyCargoLens",
  },
  description:
    "The complete CBP compliance platform for modern importers. File ISF, Entry, and In-Bond in one secure workspace.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://mycargolens.com",
    siteName: "MyCargoLens",
    title: "MyCargoLens — CBP Compliance Platform",
    description:
      "The complete CBP compliance platform for modern importers. File ISF, Entry, and In-Bond in one secure workspace.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MyCargoLens — CBP Compliance Platform",
    description:
      "The complete CBP compliance platform for modern importers.",
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
      <body className="bg-mesh min-h-screen flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <MotionRoot>
            <BfcacheFix />
            <Nav />
            <main className="flex-1">{children}</main>
            <Footer />
            <ChatWidget />
          </MotionRoot>
        </ThemeProvider>
      </body>
    </html>
  );
}
