import { Check } from "lucide-react";

import { fmt } from "@/lib/utils";
import { RepaymentBar, repaidPercent } from "./repayment-bar";

interface Props {
  /** Small caps label above the amount, e.g. "You owe" or "Owes". */
  label: string;
  /** Name shown above the label (admin branch page). */
  eyebrow?: string;
  balance: number;
  totalCredited: number;
  totalReturned: number;
  totalPaid: number;
  /** Buttons shown on the right of the panel. */
  actions?: React.ReactNode;
}

/**
 * The focal point of a credit branch screen: what is still owed, and how much
 * of what was charged has been paid back. Uses the sidebar navy so it follows
 * the light and dark themes.
 */
export function BalancePanel({
  label,
  eyebrow,
  balance,
  totalCredited,
  totalReturned,
  totalPaid,
  actions,
}: Props) {
  const percent = repaidPercent({ totalCredited, totalReturned, totalPaid });
  const due = totalCredited - totalReturned;
  const settled = balance <= 0 && due > 0;

  return (
    <section
      aria-label="Balance"
      className="mb-6 rounded-[var(--r-xl)] border border-white/10 bg-[var(--sidebar-bg)] p-6 text-white shadow-[var(--shadow-md)] sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-sm font-medium text-white/70">{eyebrow}</p>
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
            {label}
          </p>
          <p className="num mt-2 text-5xl font-semibold leading-none tracking-tight sm:text-6xl">
            {fmt(balance)}
          </p>
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>

      <div className="mt-8">
        <RepaymentBar percent={percent} tone="on-dark" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-white/70">
          <p>
            Paid{" "}
            <span className="num font-medium text-white">{fmt(totalPaid)}</span>{" "}
            of{" "}
            <span className="num font-medium text-white">{fmt(due)}</span>{" "}
            charged
            {totalReturned > 0 ? (
              <span className="text-white/60">
                {" "}
                (after {fmt(totalReturned)} returned)
              </span>
            ) : null}
          </p>
          {settled ? (
            <p className="inline-flex items-center gap-1.5 font-medium text-[var(--brand-teal)]">
              <Check className="size-4" aria-hidden />
              Fully repaid
            </p>
          ) : (
            <p className="num font-medium text-white">
              {Math.round(percent)}% repaid
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
