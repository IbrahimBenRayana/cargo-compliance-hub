import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { SCREENS, type ScreenKey } from "@/lib/screens";

type CommonProps = {
  /** Caption under the frame (muted, small). */
  caption?: React.ReactNode;
  className?: string;
};

/**
 * Real captures only. There is deliberately no placeholder variant: a visible
 * "coming soon" frame reads as "not built". With no capture, drop the visual.
 */
export type ScreenshotProps = CommonProps & {
        /** Key in lib/screens.ts (file in /public/screens). */
        screen: ScreenKey;
        /** Override the default alt text. Use "" only when the copy beside it says the same. */
        alt?: string;
        /** URL-bar text. Defaults to app.mycargolens.com + the screen's route. */
        url?: string;
        /** `sizes` for the img. Default assumes a half-width column on desktop. */
        sizes?: string;
        /** Above the fold: load eagerly with high priority. */
        eager?: boolean;
        /** Crop to an aspect ratio (top-left anchored), e.g. "16/10". */
        aspect?: string;
      };

const BEZEL =
  "rounded-[22px] p-1.5 bg-[hsl(var(--card)/0.6)] ring-1 ring-[hsl(var(--surface-border))] shadow-[0_2px_4px_hsl(222_47%_20%/0.06),0_24px_60px_-24px_hsl(222_47%_20%/0.45)] dark:shadow-[0_40px_90px_-30px_hsl(0_0%_0%/0.7)]";

/**
 * A real product screen in a browser window with a double bezel (wireframes
 * "Round 3"). Phone captures render in a phone frame. Uses next/image with
 * the file's intrinsic width/height, so layout never shifts. Files are
 * pre-sized webp, so they're served as-is (`unoptimized`).
 */
export function Screenshot(props: ScreenshotProps) {
  const { caption, className } = props;
  const meta = SCREENS[props.screen];
  const isPhone = meta && "phone" in meta && meta.phone;

  let body: React.ReactNode;
  if (props.screen && meta) {
    const img = (
      <Image
        src={`/screens/${props.screen}.webp`}
        alt={props.alt ?? meta.alt}
        width={meta.width}
        height={meta.height}
        unoptimized
        sizes={props.sizes ?? (isPhone ? "(min-width: 1024px) 280px, 60vw" : "(min-width: 1024px) 560px, 100vw")}
        loading={props.eager ? "eager" : "lazy"}
        fetchPriority={props.eager ? "high" : undefined}
        className={cn("block h-auto w-full", props.aspect && "h-full object-cover object-left-top")}
      />
    );
    body = isPhone ? (
      <div className="mx-auto w-full max-w-[300px] rounded-[36px] bg-[hsl(222_40%_14%)] p-[7px] shadow-[0_30px_60px_-20px_hsl(222_47%_10%/0.55)]">
        <div className="overflow-hidden rounded-[30px] bg-white">{img}</div>
      </div>
    ) : (
      <div className={BEZEL}>
        <div className="overflow-hidden rounded-[17px] bg-white ring-1 ring-[hsl(222_47%_22%/0.08)]">
          <WindowBar url={props.url ?? `app.mycargolens.com${meta.route === "/" ? "" : meta.route}`} />
          <div className="overflow-hidden" style={props.aspect ? { aspectRatio: props.aspect } : undefined}>
            {img}
          </div>
        </div>
      </div>
    );
  }

  return (
    <figure className={cn("relative m-0", className)}>
      {body}
      {caption && <figcaption className="mt-3 text-[13px] leading-snug text-tone-muted">{caption}</figcaption>}
    </figure>
  );
}

function WindowBar({ url }: { url: string }) {
  return (
    <div aria-hidden className="flex items-center gap-1.5 border-b border-[hsl(222_47%_22%/0.08)] bg-[hsl(220_30%_97%)] px-3 py-2.5">
      <i className="block size-[9px] rounded-full bg-[hsl(4_80%_66%)]" />
      <i className="block size-[9px] rounded-full bg-[hsl(40_90%_60%)]" />
      <i className="block size-[9px] rounded-full bg-[hsl(140_50%_55%)]" />
      <span className="ml-2.5 hidden max-w-[340px] flex-1 truncate rounded-md border border-[hsl(222_47%_22%/0.08)] bg-white px-2 py-0.5 font-mono text-[10.5px] text-[hsl(220_14%_46%)] sm:block">
        {url}
      </span>
    </div>
  );
}
