import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * A flat, to-scale modern Pro Max iPhone. Everything is laid out in device
 * points and expressed as percentages, so the frame scales with its width and
 * never drifts out of proportion:
 *
 *   screen   440 × 956 pt, display corner radius 55 pt
 *   bezel    10 pt black glass border + 4 pt titanium band = 14 pt per side
 *   device   468 × 984 pt, outer corner radius 69 pt
 *   island   126 × 37 pt pill, centred, 11 pt from the top of the screen
 *
 * The screen image must be captured at exactly 440 × 956 CSS px with the app's
 * top bar pushed below the 62 pt status-bar safe area (see lib/screens.ts), so
 * it fills the glass edge to edge and the island sits over empty header space.
 */
const DEVICE_W = 468;
const DEVICE_H = 984;
const FRAME = 4; // titanium band
const BEZEL = 10; // black border around the glass
const SCREEN_W = 440;
const SCREEN_H = 956;
const SCREEN_R = 55;

const pct = (n: number, of: number) => `${((n / of) * 100).toFixed(4)}%`;
const radius = (r: number, w: number, h: number) => `${pct(r, w)} / ${pct(r, h)}`;

const INNER_W = DEVICE_W - FRAME * 2; // 460
const INNER_H = DEVICE_H - FRAME * 2; // 976

/** Hardware buttons, as [top, height] in device pt. Subtle 2.5 pt nubs. */
const LEFT_BUTTONS: Array<[number, number]> = [
  [176, 34], // action button
  [252, 64], // volume up
  [332, 64], // volume down
];
const RIGHT_BUTTONS: Array<[number, number]> = [[276, 102]]; // side button

export type DevicePhoneProps = {
  /** 1x-equivalent path is unused; pass the 2x and 3x captures (440 × 956 CSS px). */
  src2x: string;
  src3x: string;
  alt: string;
  /** Rendered CSS width hint for srcset selection. */
  sizes?: string;
  eager?: boolean;
  className?: string;
};

export function DevicePhone({ src2x, src3x, alt, sizes, eager, className }: DevicePhoneProps) {
  return (
    <div
      className={cn("relative mx-auto w-full", className)}
      style={{ aspectRatio: `${DEVICE_W} / ${DEVICE_H}` }}
    >
      {/* Side buttons sit just outside the frame. */}
      {LEFT_BUTTONS.map(([top, h]) => (
        <i
          key={`l${top}`}
          aria-hidden
          className="absolute block rounded-l-[2px] bg-[hsl(240_3%_24%)] dark:bg-[hsl(240_3%_40%)]"
          style={{ left: pct(-2.5, DEVICE_W), width: pct(3, DEVICE_W), top: pct(top, DEVICE_H), height: pct(h, DEVICE_H) }}
        />
      ))}
      {RIGHT_BUTTONS.map(([top, h]) => (
        <i
          key={`r${top}`}
          aria-hidden
          className="absolute block rounded-r-[2px] bg-[hsl(240_3%_24%)] dark:bg-[hsl(240_3%_40%)]"
          style={{ right: pct(-2.5, DEVICE_W), width: pct(3, DEVICE_W), top: pct(top, DEVICE_H), height: pct(h, DEVICE_H) }}
        />
      ))}

      {/* Titanium band. The 1px inset ring is the only edge highlight, flat. */}
      <div
        className="absolute inset-0 bg-[hsl(240_3%_20%)] shadow-[inset_0_0_0_1px_hsl(240_3%_34%),0_30px_60px_-24px_hsl(222_47%_10%/0.5)] dark:bg-[hsl(240_3%_30%)] dark:shadow-[inset_0_0_0_1px_hsl(240_3%_46%),0_40px_80px_-30px_hsl(0_0%_0%/0.75)]"
        style={{ borderRadius: radius(69, DEVICE_W, DEVICE_H), padding: pct(FRAME, DEVICE_W) }}
      >
        {/* Black glass border. */}
        <div
          className="h-full w-full bg-black"
          style={{ borderRadius: radius(65, INNER_W, INNER_H), padding: pct(BEZEL, INNER_W) }}
        >
          {/* Display. */}
          <div
            className="relative isolate h-full w-full overflow-hidden bg-white"
            style={{ borderRadius: radius(SCREEN_R, SCREEN_W, SCREEN_H) }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized 2x/3x webp via srcset; next/image can't take a custom srcset */}
            <img
              src={src3x}
              srcSet={`${src2x} 880w, ${src3x} 1320w`}
              sizes={sizes ?? "300px"}
              width={SCREEN_W * 3}
              height={SCREEN_H * 3}
              alt={alt}
              loading={eager ? "eager" : "lazy"}
              fetchPriority={eager ? "high" : undefined}
              decoding="async"
              className="absolute inset-0 block h-full w-full object-cover object-top"
            />
            <StatusBar />
            {/* Dynamic Island. */}
            <i
              aria-hidden
              className="absolute block rounded-full bg-black"
              style={{
                width: pct(126, SCREEN_W),
                height: pct(37, SCREEN_H),
                top: pct(11, SCREEN_H),
                left: pct((SCREEN_W - 126) / 2, SCREEN_W),
              }}
            />
            {/* Home indicator. */}
            <i
              aria-hidden
              className="absolute block rounded-full bg-black/85"
              style={{
                width: pct(144, SCREEN_W),
                height: pct(5, SCREEN_H),
                bottom: pct(8, SCREEN_H),
                left: pct((SCREEN_W - 144) / 2, SCREEN_W),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** 9:41, cellular, Wi-Fi and battery, drawn in screen points (viewBox = 440 × 62). */
function StatusBar() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 440 62"
      className="absolute inset-x-0 top-0 block w-full text-black"
      fill="currentColor"
    >
      <text
        x="80"
        y="35.5"
        textAnchor="middle"
        fontSize="17"
        fontWeight="600"
        letterSpacing="-0.2"
        style={{ fontFamily: '-apple-system, "SF Pro Text", "Helvetica Neue", Inter, system-ui, sans-serif' }}
      >
        9:41
      </text>
      {/* Cellular: four bars, 3 pt wide, 1.5 pt gap. */}
      <g transform="translate(323 23.5)">
        <rect x="0" y="7.5" width="3.2" height="4.5" rx="1" />
        <rect x="4.8" y="5" width="3.2" height="7" rx="1" />
        <rect x="9.6" y="2.5" width="3.2" height="9.5" rx="1" />
        <rect x="14.4" y="0" width="3.2" height="12" rx="1" />
      </g>
      {/* Wi-Fi: a wedge plus two arcs, 90° spread. */}
      <g transform="translate(345 23)">
        <path d="M8.5 12.6 5.95 10.05a3.6 3.6 0 0 1 5.1 0Z" />
        <path d="M3.9 7.9a6.5 6.5 0 0 1 9.2 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M1.3 5.1a10.2 10.2 0 0 1 14.4 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </g>
      {/* Battery: outlined body, full charge, cap. */}
      <g transform="translate(368 23)">
        <rect x="0.5" y="0.5" width="24" height="12" rx="3.8" fill="none" stroke="currentColor" strokeOpacity="0.4" />
        <rect x="2.5" y="2.5" width="20" height="8" rx="2.2" />
        <path d="M26 4.5c.9.3 1.4 1.1 1.4 2s-.5 1.7-1.4 2Z" fillOpacity="0.45" />
      </g>
    </svg>
  );
}
