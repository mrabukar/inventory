import type { CSSProperties } from "react";
import { Check } from "lucide-react";

import {
  RepaymentBar,
  repaidPercent,
} from "@/components/credit-branches/repayment-bar";
import { fmt } from "@/lib/utils";
import type { CreditBranch } from "@/types/credit-branches/credit-branch";

// Inline so the panel never depends on a stylesheet reload.
const mute = "rgba(255,255,255,0.68)";
const hair = "1px solid rgba(255,255,255,0.14)";

const label: CSSProperties = { fontSize: 13, color: mute, fontWeight: 500 };

interface Props {
  branch: CreditBranch;
  /** Unsold stock at the branch, at what it paid for it. Left out when unknown. */
  unsoldStock?: number;
  /** What the branch's own customers owe it. Left out when unknown. */
  customersOwe?: number;
  /** When the last approved payment was made. */
  lastPaymentAt?: string | null;
}

const dayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/**
 * The focal point: what the branch owes, how much of what it was charged it
 * has paid, and (beside it) what it holds that could cover the debt.
 */
export function BranchDebtPanel({
  branch,
  unsoldStock,
  customersOwe,
  lastPaymentAt,
}: Props) {
  const percent = repaidPercent(branch);
  const due = branch.totalCredited - branch.totalReturned;
  const owed = Math.max(branch.balance, 0);
  const settled = branch.balance <= 0 && due > 0;
  const showCover = unsoldStock !== undefined || customersOwe !== undefined;

  const covers = (unsoldStock ?? 0) + (customersOwe ?? 0);
  const margin = covers - owed;

  return (
    <section
      aria-label="What the branch owes"
      style={{
        background: "var(--sidebar-bg)",
        color: "#fff",
        borderRadius: "var(--r-xl)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "var(--shadow-md)",
        padding: "28px 32px",
        marginBottom: 20,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "28px 56px",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={label}>Owes you</p>
        <p
          className="num"
          style={{
            margin: "6px 0 0",
            fontSize: 52,
            lineHeight: 1,
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          {fmt(owed)}
        </p>
        <div style={{ marginTop: 22 }}>
          <RepaymentBar percent={percent} tone="on-dark" />
          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: "4px 16px",
              fontSize: 14,
              color: mute,
            }}
          >
            <span>
              Paid{" "}
              <b className="num" style={{ color: "#fff", fontWeight: 500 }}>
                {fmt(branch.totalPaid)}
              </b>{" "}
              of{" "}
              <b className="num" style={{ color: "#fff", fontWeight: 500 }}>
                {fmt(due)}
              </b>{" "}
              charged
              {branch.totalReturned > 0
                ? `, after ${fmt(branch.totalReturned)} returned`
                : ""}
            </span>
            {settled ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: "var(--brand-teal)",
                  fontWeight: 500,
                }}
              >
                <Check size={16} aria-hidden /> Fully repaid
              </span>
            ) : (
              <span className="num" style={{ color: "#fff", fontWeight: 500 }}>
                {Math.round(percent)}% repaid
              </span>
            )}
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: mute }}>
            {lastPaymentAt
              ? `Last payment ${dayFmt.format(new Date(lastPaymentAt))}`
              : branch.totalPaid > 0
                ? "Payments received"
                : "No payment received yet"}
          </p>
        </div>
      </div>

      {showCover ? (
        <div style={{ minWidth: 0 }}>
          <p style={label}>What could cover it</p>
          <dl style={{ margin: "8px 0 0" }}>
            {unsoldStock !== undefined ? (
              <Row name="Unsold stock at the branch" value={fmt(unsoldStock)} />
            ) : null}
            {customersOwe !== undefined ? (
              <Row name="Its customers owe it" value={fmt(customersOwe)} />
            ) : null}
            {owed > 0 ? (
              <Row
                name={margin >= 0 ? "More than the debt by" : "Short of the debt by"}
                value={fmt(Math.abs(margin))}
                strong
                tone={margin >= 0 ? "#5DCAA5" : "#FAC775"}
              />
            ) : null}
          </dl>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: mute }}>
            An estimate: stock and customer debts aren&apos;t cash yet.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function Row({
  name,
  value,
  strong,
  tone,
}: {
  name: string;
  value: string;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        padding: "10px 0",
        borderBottom: strong ? "none" : hair,
        fontSize: 15,
        fontWeight: strong ? 600 : 400,
      }}
    >
      <dt style={{ color: strong ? "#fff" : mute }}>{name}</dt>
      <dd
        className="num"
        style={{ margin: 0, color: tone ?? "#fff", fontWeight: 500 }}
      >
        {value}
      </dd>
    </div>
  );
}
