// Site-wide OpenGraph card (audit Phase 9.3).
//
// Next.js serves this at /opengraph-image whenever a route doesn't override
// it with its own opengraph-image.tsx. The runtime ImageResponse renders a
// 1200x630 PNG from JSX — no external image asset to maintain. Brand colors
// match landing/app/globals.css (navy primary, gold accent, slate surfaces).
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "MyCargoLens — CBP Compliance Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "64px",
          backgroundColor: "#0F172A",
          backgroundImage:
            "radial-gradient(circle at 30% 0%, rgba(251, 191, 36, 0.18) 0%, transparent 55%)",
          color: "#F8FAFC",
          fontFamily: "Inter",
          justifyContent: "space-between",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              backgroundColor: "#FBBF24",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0F172A",
              fontSize: "22px",
              fontWeight: 800,
            }}
          >
            ML
          </div>
          <div style={{ fontSize: "26px", fontWeight: 600, letterSpacing: "-0.01em" }}>
            MyCargoLens
          </div>
        </div>

        {/* Headline + tagline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              fontSize: "72px",
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: "920px",
            }}
          >
            An inbox for US customs.
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 400,
              color: "#94A3B8",
              maxWidth: "880px",
              lineHeight: 1.4,
            }}
          >
            File ISF, Entry, and In-Bond in one calm workspace — with an AI
            coach for every CBP rejection.
          </div>
        </div>

        {/* Footer URL */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "#FBBF24",
            fontSize: "24px",
            fontWeight: 600,
          }}
        >
          mycargolens.com
        </div>
      </div>
    ),
    { ...size },
  );
}
