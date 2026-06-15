import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { ThemeProvider } from "@/components/theme-provider";
import { BfcacheFix } from "@/components/bfcache-fix";
import { MotionRoot } from "@/components/motion-root";

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
  // Canonical URL anchored to the production domain (audit Phase 9.3).
  // Without an explicit canonical, search engines treat mycargolens.com/
  // www.mycargolens.com/ and any preview URL as independent pages and
  // dilute the ranking signal.
  alternates: {
    canonical: "/",
  },
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
          </MotionRoot>
        </ThemeProvider>
      </body>
    </html>
  );
}
