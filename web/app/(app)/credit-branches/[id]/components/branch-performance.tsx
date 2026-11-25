"use client";

import { GroupedBar } from "@/components/charts/grouped-bar";
import { HBars } from "@/components/charts/h-bars";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportFilters } from "@/hooks/filters/use-report-filters";
import { formatProductLabel } from "@/lib/products/format";
import { fmt } from "@/lib/utils";
import type { AdminDashboardResponse } from "@/types/reports/admin-dashboard";

interface Props {
  filters: ReportFilters;
  data?: AdminDashboardResponse;
  isLoading: boolean;
  isError: boolean;
}

const grid = (min: number) =>
  ({
    display: "grid",
    gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
    gap: "16px 24px",
  }) as const;

const sub = { fontSize: 13, color: "var(--fg2)", margin: "0 0 10px" } as const;

/** The branch's own results for a period: figures, sales by month, best sellers. */
export function BranchPerformance({ filters, data, isLoading, isError }: Props) {
  const s = data?.summary;
  const figures = s
    ? [
        { name: "Revenue", value: fmt(s.totalRevenue) },
        { name: "Cost of goods", value: fmt(s.cogs) },
        { name: "Gross profit", value: fmt(s.grossProfit) },
        { name: "Expenses", value: fmt(s.totalExpenses) },
        {
          name: "Net profit",
          value: fmt(s.netProfit),
          negative: s.netProfit < 0,
        },
        { name: "Units sold", value: s.totalUnitsSold.toLocaleString() },
      ]
    : [];

  const months = (data?.charts.revenueCogsExpenses ?? []).map((row) => ({
    m: row.month,
    rev: row.revenue,
    cogs: row.cogs,
    exp: row.expenses,
  }));
  const best = data?.charts.topProducts ?? [];

  return (
    <section className="card" style={{ marginBottom: 20 }} aria-label="Results">
      <div
        className="card-head"
        style={{ flexWrap: "wrap", gap: 12 }}
      >
        <div>
          <h3>How it&apos;s doing</h3>
          <p style={{ ...sub, margin: "2px 0 0" }}>
            The branch&apos;s own sales and costs, at what it pays you for stock
          </p>
        </div>
        <DateRangeFilter filters={filters} disabled={isLoading} />
      </div>
      <div style={{ padding: 24 }}>
        {isLoading ? (
          <div style={{ display: "grid", gap: 12 }}>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : isError || !data ? (
          <EmptyState
            title="Couldn't load the results"
            sub="Refresh the page to try again."
          />
        ) : (
          <>
            <dl style={{ ...grid(120), margin: 0 }}>
              {figures.map((f) => (
                <div key={f.name}>
                  <dt style={{ fontSize: 13, color: "var(--fg2)" }}>{f.name}</dt>
                  <dd
                    className="num"
                    style={{
                      margin: "2px 0 0",
                      fontSize: 22,
                      fontWeight: 600,
                      color: f.negative ? "var(--status-rose)" : "var(--fg1)",
                    }}
                  >
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div style={{ ...grid(300), marginTop: 28 }}>
              <div style={{ minWidth: 0 }}>
                <p style={sub}>Revenue, cost and expenses by month</p>
                {months.length > 0 && months.some((m) => m.rev || m.exp) ? (
                  <GroupedBar data={months} height={200} />
                ) : (
                  <EmptyState
                    title="No sales yet"
                    sub="Nothing sold in this period."
                  />
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={sub}>Best sellers</p>
                {best.length > 0 ? (
                  <HBars
                    data={best.map((row) => ({
                      name: formatProductLabel(row.productName, row.productModel),
                      units: row.unitsSold,
                    }))}
                    valueKey="units"
                    labelKey="name"
                    color="var(--brand-teal)"
                  />
                ) : (
                  <EmptyState
                    title="No products sold"
                    sub="Best sellers show up after the first sale."
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
