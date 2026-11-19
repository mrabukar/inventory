import { cn } from "@/lib/utils";

/**
 * Share of what a branch has been charged (credited minus returned) that it
 * has now paid off, 0–100. A branch with nothing charged yet shows 0.
 */
export function repaidPercent(figures: {
  totalCredited: number;
  totalReturned: number;
  totalPaid: number;
}): number {
  const due = figures.totalCredited - figures.totalReturned;
  if (due <= 0) return 0;
  return Math.min(100, Math.max(0, (figures.totalPaid / due) * 100));
}

interface Props {
  percent: number;
  /** "on-dark" for the navy balance panel, "on-light" for white cards. */
  tone?: "on-dark" | "on-light";
  className?: string;
  label?: string;
}

export function RepaymentBar({
  percent,
  tone = "on-light",
  className,
  label = "Repaid",
}: Props) {
  const rounded = Math.round(percent);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={rounded}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full",
        tone === "on-dark" ? "bg-white/15" : "bg-[var(--tint-slate)]",
        className,
      )}
    >
      <div
        className={cn(
          "repay-fill h-full rounded-full",
          tone === "on-dark"
            ? "bg-[var(--brand-teal)]"
            : "bg-[var(--brand-indigo)]",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
