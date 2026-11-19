import { ReceiptText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { fmt } from "@/lib/utils";
import type { BranchStatementRow } from "@/types/credit-branches/credit-branch";

const KIND: Record<
  BranchStatementRow["kind"],
  { color: "indigo" | "emerald" | "violet"; label: string }
> = {
  credit: { color: "indigo", label: "Stock credited" },
  payment: { color: "emerald", label: "Payment" },
  return: { color: "violet", label: "Return" },
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

/** Rows arrive in the order the user picked; the Balance column is a running total, not a sum of what is on screen. */
export function StatementTable({ rows }: { rows: BranchStatementRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <ReceiptText className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium text-foreground">Nothing recorded yet</p>
        <p className="text-sm text-muted-foreground">
          Credits, returns and approved payments will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-6 py-3">
              Date
            </th>
            <th scope="col" className="px-3 py-3">
              Type
            </th>
            <th scope="col" className="px-3 py-3">
              Details
            </th>
            <th scope="col" className="px-3 py-3 text-right">
              Charged
            </th>
            <th scope="col" className="px-3 py-3 text-right">
              Paid / returned
            </th>
            <th scope="col" className="px-6 py-3 text-right">
              Balance
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const date = new Date(row.date);
            const { color, label } = KIND[row.kind];
            return (
              <tr
                key={`${row.date}-${i}`}
                className="border-b border-border/60 last:border-0 hover:bg-accent/30"
              >
                <td className="whitespace-nowrap px-6 py-3.5">
                  <p className="font-medium text-foreground">
                    {dateFormat.format(date)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {timeFormat.format(date)}
                  </p>
                </td>
                <td className="px-3 py-3.5">
                  <Badge color={color}>{label}</Badge>
                </td>
                <td className="max-w-[320px] px-3 py-3.5 text-muted-foreground">
                  {row.description}
                </td>
                <td className="num px-3 py-3.5 text-right text-foreground">
                  {row.charge != null ? fmt(row.charge) : "—"}
                </td>
                <td className="num px-3 py-3.5 text-right font-medium text-emerald-600">
                  {row.credit != null ? fmt(row.credit) : "—"}
                </td>
                <td className="num px-6 py-3.5 text-right font-semibold text-foreground">
                  {fmt(row.balance)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
