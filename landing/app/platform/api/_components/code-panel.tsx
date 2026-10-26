import { CopyButton } from "./copy-button";

/** Dark code sample with a title bar and a copy button (lives on the ink band). */
export function CodePanel({ title, lang, code }: { title: string; lang: string; code: string }) {
  return (
    <figure className="m-0 min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
      <figcaption className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
        <span className="text-[13px] font-semibold text-tone-fg">
          {title} <span className="ml-1 font-mono text-[11.5px] font-normal text-tone-muted">{lang}</span>
        </span>
        <CopyButton text={code} label={title.toLowerCase()} />
      </figcaption>
      <pre
        tabIndex={0}
        className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-[hsl(216_30%_85%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(205_90%_78%)] sm:p-5 sm:text-[13px]"
      >
        <code>{code}</code>
      </pre>
    </figure>
  );
}
