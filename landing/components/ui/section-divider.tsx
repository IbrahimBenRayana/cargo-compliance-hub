export function SectionDivider() {
  return (
    <div aria-hidden className="relative flex items-center justify-center h-0 overflow-visible">
      <div className="absolute h-px w-56 bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="absolute h-1 w-1 rounded-full bg-gold shadow-[0_0_12px_hsl(43_96%_56%/0.5)]" />
    </div>
  );
}
