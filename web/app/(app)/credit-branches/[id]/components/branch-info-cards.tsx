import type { CSSProperties } from "react";

import { fmt } from "@/lib/utils";
import type { AdminDashboardSummary } from "@/types/reports/admin-dashboard";
import type { CreditBranch } from "@/types/credit-branches/credit-branch";

const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 16,
  padding: "10px 0",
  borderBottom: "1px solid var(--border)",
  fontSize: 14,
};

function Line({
  name,
  children,
  last,
}: {
  name: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div style={last ? { ...row, borderBottom: "none" } : row}>
      <dt style={{ color: "var(--fg2)" }}>{name}</dt>
      <dd
        className="num"
        style={{
          margin: 0,
          color: "var(--fg1)",
          fontWeight: 500,
          textAlign: "right",
          overflowWrap: "anywhere",
        }}
      >
        {children}
      </dd>
    </div>
  );
}

const Unset = () => <span style={{ color: "var(--fg3)" }}>Not set</span>;

interface Props {
  branch: CreditBranch;
  /** The branch's stock figures (needs the dashboard page). */
  stock?: AdminDashboardSummary;
  onEdit?: () => void;
}

/** Two short cards: the stock the branch holds, and what prints on its invoices. */
export function BranchInfoCards({ branch, stock, onEdit }: Props) {
  const next = branch.invoicePrefix
    ? `${branch.invoicePrefix}-${String(branch.nextInvoiceNumber ?? 1).padStart(4, "0")}`
    : null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 20,
        marginBottom: 20,
      }}
    >
      {stock ? (
        <section className="card" aria-label="Stock at the branch">
          <div className="card-head">
            <h3>Stock at the branch</h3>
          </div>
          <dl style={{ margin: 0, padding: "4px 24px 8px" }}>
            <Line name="Units on hand">{stock.inStockBalance.toLocaleString()}</Line>
            <Line name="Running low">
              {stock.lowStockCount === 0
                ? "None"
                : `${stock.lowStockCount} ${stock.lowStockCount === 1 ? "product" : "products"}`}
            </Line>
            <Line name="Out of stock">
              {stock.outOfStockCount === 0
                ? "None"
                : `${stock.outOfStockCount} ${stock.outOfStockCount === 1 ? "product" : "products"}`}
            </Line>
            <Line name="Returned to you, all time" last>
              {fmt(branch.totalReturned)}
            </Line>
          </dl>
        </section>
      ) : null}

      <section className="card" aria-label="Contact and invoices">
        <div className="card-head">
          <h3>Contact and invoices</h3>
          {onEdit ? (
            <button type="button" className="card-link" onClick={onEdit}>
              Edit
            </button>
          ) : null}
        </div>
        <dl style={{ margin: 0, padding: "4px 24px 8px" }}>
          <Line name="Phone">{branch.phone || <Unset />}</Line>
          <Line name="EVC">{branch.evcNumber || <Unset />}</Line>
          <Line name="eDahab">{branch.edahabNumber || <Unset />}</Line>
          <Line name="Bank account">{branch.accountNumber || <Unset />}</Line>
          <Line name="Next invoice number" last>
            {next ?? <span style={{ color: "var(--fg3)" }}>Set on first invoice</span>}
          </Line>
        </dl>
      </section>
    </div>
  );
}
