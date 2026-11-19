import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "indigo" | "emerald" | "amber" | "slate";

const TONES: Record<Tone, [string, string]> = {
  indigo: ["var(--tint-indigo)", "var(--brand-indigo-600)"],
  emerald: ["var(--tint-emerald)", "var(--status-emerald)"],
  amber: ["var(--tint-amber)", "var(--status-amber)"],
  slate: ["var(--tint-slate)", "var(--fg2)"],
};

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  className?: string;
}

export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "indigo",
  className,
}: Props) {
  const [bg, fg] = TONES[tone];
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-[var(--r-lg)] border border-border bg-card px-5 py-4 shadow-[var(--shadow-xs)]",
        className,
      )}
    >
      <span
        aria-hidden
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--r-md)]"
        style={{ background: bg, color: fg }}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="num text-xl font-semibold text-foreground">{value}</p>
        {hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
