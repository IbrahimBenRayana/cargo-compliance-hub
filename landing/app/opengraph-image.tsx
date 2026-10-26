// Site-wide OpenGraph card. Next.js serves this at /opengraph-image whenever a
// route doesn't override it. Flat navy on cream (founder, Oct 26: no gradients);
// gold appears only in the logo mark's centre square. Copy matches the home
// hero: H1 "Customs, in focus." and the ISF / customs entry sub line.
import { ImageResponse } from "next/og";
import { CERT_BADGE } from "@/lib/site";

export const alt = "MyCargoLens. Customs, in focus. ISF and customs entry filing software, CBP ABI certified.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#14213D";
const NAVY_MUTED = "#4A5878";
const CREAM = "#FCF4E3";
const GOLD = "#FBBE24";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          backgroundColor: CREAM,
          color: NAVY,
        }}
      >
        {/* Brand row: Focus Frame mark (navy frame, gold centre) + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <svg width="52" height="52" viewBox="0 0 100 100">
            <g fill="none" stroke={NAVY} strokeWidth="6.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M 26 40 L 26 26 L 40 26" />
              <path d="M 60 26 L 74 26 L 74 40" />
              <path d="M 74 60 L 74 74 L 60 74" />
              <path d="M 40 74 L 26 74 L 26 60" />
            </g>
            <rect x="42" y="42" width="16" height="16" rx="4.6" fill={GOLD} />
          </svg>
          <div style={{ display: "flex", fontSize: "30px", fontWeight: 700, letterSpacing: "-0.02em" }}>MyCargoLens</div>
        </div>

        {/* Headline + sub line + certification pill */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <div style={{ display: "flex", fontSize: "104px", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em" }}>
            Customs, in focus.
          </div>
          <div style={{ display: "flex", marginTop: "24px", fontSize: "36px", color: NAVY_MUTED, letterSpacing: "-0.01em" }}>
            ISF and customs entry filing software
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: "36px",
              padding: "10px 22px",
              borderRadius: "999px",
              border: `2px solid ${NAVY}`,
              fontSize: "24px",
              fontWeight: 600,
            }}
          >
            {CERT_BADGE.label}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: "24px", fontWeight: 600, color: NAVY_MUTED }}>mycargolens.com</div>
      </div>
    ),
    { ...size },
  );
}
