import Link from "next/link";
import { Clock } from "lucide-react";

import { fmt } from "@/lib/utils";

interface Item {
  count: number;
  amount: number;
}

interface Props {
  sales?: Item;
  payments?: Item;
  /** Leave the links out for someone who can't open those pages. */
  canOpenSales: boolean;
  canOpenPayments: boolean;
}

const plural = (n: number, one: string) => (n === 1 ? one : `${one}s`);

/** What the branch has sent that is waiting for the admin. Hidden when nothing is. */
export function BranchWaitingBar({
  sales,
  payments,
  canOpenSales,
  canOpenPayments,
}: Props) {
  const parts: { text: string; href: string; link: boolean }[] = [];
  if (sales && sales.count > 0) {
    parts.push({
      text: `${sales.count} ${plural(sales.count, "sale")} (${fmt(sales.amount)})`,
      href: "/sales/approvals",
      link: canOpenSales,
    });
  }
  if (payments && payments.count > 0) {
    parts.push({
      text: `${payments.count} ${plural(payments.count, "payment")} (${fmt(payments.amount)})`,
      href: "/credit-branches/payments",
      link: canOpenPayments,
    });
  }
  if (parts.length === 0) return null;

  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "6px 16px",
        marginBottom: 20,
        padding: "12px 16px",
        borderRadius: "var(--r-lg)",
        background: "var(--tint-amber)",
        border: "1px solid var(--border)",
        fontSize: 14,
        color: "var(--fg1)",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 600,
        }}
      >
        <Clock size={16} style={{ color: "var(--status-amber)" }} aria-hidden />
        Waiting for your review
      </span>
      {parts.map((part) =>
        part.link ? (
          <Link
            key={part.href}
            href={part.href}
            style={{
              color: "var(--fg1)",
              fontWeight: 500,
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            {part.text}
          </Link>
        ) : (
          <span key={part.href}>{part.text}</span>
        ),
      )}
    </div>
  );
}
