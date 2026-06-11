import { fmt } from "@/lib/utils";
import type { FinancialBreakdown } from "@/types/reports/financial-summary";

const ROWS: {
  key: keyof FinancialBreakdown;
  label: string;
  op: string;
  color: string;
  emphasize?: boolean;
}[] = [
  { key: "revenue", label: "Revenue", op: "", color: "var(--brand-indigo)" },
  {
    key: "cogs",
    label: "Cost of Goods Sold",
    op: "−",
    color: "var(--cost-slate)",
  },
  {
    key: "grossProfit",
    label: "Gross Profit",
    op: "=",
    color: "var(--brand-teal)",
  },
  {
    key: "expenses",
    label: "Operating Expenses",
    op: "−",
    color: "var(--status-amber)",
  },
  {
    key: "netProfit",
    label: "Net Profit",
    op: "=",
    color: "var(--brand-violet)",
    emphasize: true,
  },
];

export function PnlBreakdown({ breakdown }: { breakdown: FinancialBreakdown }) {
  const base = breakdown.revenue > 0 ? breakdown.revenue : 1;

  return (
    <div className="card card-pad">
      <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600 }}>
        P&L Breakdown
      </h3>
      {ROWS.map((row) => {
        const value = breakdown[row.key];
        const width = Math.min(100, Math.round((value / base) * 100));

        return (
          <div
            key={row.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "7px 0",
            }}
          >
            <span
              style={{
                width: 180,
                flexShrink: 0,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <span style={{ color: "var(--fg3)" }}>{row.op} </span>
              {row.label}
            </span>
            <span
              style={{
                flex: 1,
                height: 14,
                background: "var(--input-bg)",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  display: "block",
                  height: "100%",
                  width: `${width}%`,
                  background: row.color,
                  borderRadius: 4,
                }}
              />
            </span>
            <span
              className="num"
              style={{
                width: 90,
                textAlign: "right",
                fontWeight: 600,
                fontSize: 13,
                color: row.emphasize ? "var(--brand-violet)" : "var(--fg1)",
              }}
            >
              {fmt(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
