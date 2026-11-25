import { Info } from "lucide-react";

interface Props {
  /** The selection: the organization itself, every branch together, or one branch. */
  scope: "organization" | "all" | "branch";
  branchName?: string;
}

const NOTES = {
  organization:
    "The organization's own books: its sales, plus stock credited to branches at the price charged, less returns. What branches sell, and expenses booked to them, are not included. Outstanding Balance is what the branches still owe (plus any old customer debts).",
  all: "Every branch added together: what they sold, what they paid the organization for that stock, and expenses booked to them. Not the organization's own books.",
} as const;

/** One line saying what the cards and charts below add up, for credit organizations. */
export function DashboardScopeNote({ scope, branchName }: Props) {
  const text =
    scope === "branch"
      ? `${branchName ?? "This branch"} only: its own sales, costed at what it paid the organization for the stock, and expenses booked to it.`
      : NOTES[scope];
  return (
    <p
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        margin: "0 0 16px",
        fontSize: 13,
        lineHeight: 1.5,
        color: "var(--fg2)",
      }}
    >
      <Info size={15} style={{ flex: "none", marginTop: 2 }} aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}
