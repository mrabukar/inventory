import { cn, initials } from "@/lib/utils";

const PALETTE = [
  ["var(--tint-indigo)", "var(--brand-indigo-600)"],
  ["var(--tint-teal)", "var(--brand-teal-600)"],
  ["var(--tint-violet)", "var(--brand-violet-600)"],
] as const;

/** Stable colour per name, so a branch looks the same everywhere. */
function paletteFor(name: string): (typeof PALETTE)[number] {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function BranchAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const [bg, fg] = paletteFor(name);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--r-md)] text-sm font-bold tracking-wide",
        className,
      )}
      style={{ background: bg, color: fg }}
    >
      {initials(name).slice(0, 2).toUpperCase()}
    </span>
  );
}
