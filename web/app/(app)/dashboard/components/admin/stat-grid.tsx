import {
  AlertTriangle,
  CreditCard,
  HandCoins,
  Landmark,
  Layers,
  Package,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { StatCard } from "../stat-card";
import { formatExpenseTrend, formatPeriodTrend } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import type { AdminPeriodComparison } from "@/types/reports/common";
import type { AdminDashboardSummary } from "@/types/reports/admin-dashboard";

interface Props {
  summary: AdminDashboardSummary;
  comparison: AdminPeriodComparison;
  billingEnabled: boolean;
  outstandingBalance: number;
  /** Looking at a credit branch: no expenses, no cost lines. */
  branchView?: boolean;
  /** What the branch being viewed still owes the organization for its stock. */
  branchOwes?: number;
  /** On the organization's own dashboard: what all its credit branches owe it. */
  branchesOwe?: number;
  /** The branch being viewed, for the link from the "owes" card. */
  branchId?: string;
  /** Show the Cost of Goods Sold card (kept for organizations with stores). */
  showCogs?: boolean;
  /** A credit organization sells nothing itself: show customer debts only while some remain. */
  hideEmptyOutstanding?: boolean;
}

export function AdminStatGrid({
  summary: s,
  comparison,
  billingEnabled,
  outstandingBalance,
  branchView = false,
  branchOwes,
  branchesOwe,
  branchId,
  showCogs = true,
  hideEmptyOutstanding = false,
}: Props) {
  return (
    <div
      className={`stat-grid grid-cols-2 md:grid-cols-4 mb-16 ${branchView ? "lg:grid-cols-4" : "lg:grid-cols-5"}`}
    >
      <StatCard
        icon={TrendingUp}
        color="indigo"
        value={fmt(s.totalRevenue)}
        label="Total Revenue"
        {...formatPeriodTrend(comparison.totalRevenue)}
      />
      <StatCard
        icon={TrendingUp}
        color="teal"
        value={fmt(s.grossProfit)}
        label={branchView ? "Profit" : "Gross Profit"}
        {...formatPeriodTrend(comparison.grossProfit)}
      />
      {branchView && branchOwes !== undefined ? (
        <StatCard
          icon={Landmark}
          color="rose"
          value={fmt(branchOwes)}
          label="Owes the Organization"
          valueColor={branchOwes > 0 ? "var(--status-rose)" : undefined}
          href={branchId ? `/credit-branches/${branchId}` : undefined}
        />
      ) : null}
      {branchView ? null : (
        <>
          <StatCard
            icon={CreditCard}
            color="amber"
            value={fmt(s.totalExpenses)}
            label="Total Expenses"
            {...formatExpenseTrend(comparison.totalExpenses)}
          />
          <StatCard
            icon={TrendingUp}
            color="violet"
            value={fmt(s.netProfit)}
            label="Net Profit"
            valueColor={s.netProfit < 0 ? "var(--status-rose)" : undefined}
            {...formatPeriodTrend(comparison.netProfit)}
          />
        </>
      )}
      {branchesOwe !== undefined ? (
        <StatCard
          icon={Landmark}
          color="rose"
          value={fmt(branchesOwe)}
          label="Branches Owe"
          valueColor={branchesOwe > 0 ? "var(--status-rose)" : undefined}
          href="/credit-branches"
        />
      ) : null}
      {billingEnabled ? (
        <>
          {hideEmptyOutstanding && outstandingBalance <= 0 ? null : (
            <StatCard
              icon={HandCoins}
              color="rose"
              value={fmt(outstandingBalance)}
              label={branchView ? "Customers Owe" : "Outstanding Balance"}
              valueColor={
                outstandingBalance > 0 ? "var(--status-rose)" : undefined
              }
              href="/receivables"
            />
          )}

          <StatCard
            icon={Layers}
            color="indigo"
            value={fmt(s.currentStockValue)}
            label="Current Stock Value"
          />
          <StatCard
            icon={Package}
            color="teal"
            value={s.inStockBalance.toLocaleString()}
            label="In-Stock Balance"
          />
          <StatCard
            icon={AlertTriangle}
            color="amber"
            value={s.lowStockCount}
            label="Low Stock Alerts"
          />
        </>
      ) : (
        <>
          <StatCard
            icon={Layers}
            color="indigo"
            value={fmt(s.currentStockValue)}
            label="Current Stock Value"
          />
          <StatCard
            icon={Package}
            color="teal"
            value={s.inStockBalance.toLocaleString()}
            label="In-Stock Balance"
          />
          <StatCard
            icon={AlertTriangle}
            color="amber"
            value={s.lowStockCount}
            label="Low Stock Alerts"
          />
          <StatCard
            icon={AlertTriangle}
            color="rose"
            value={s.outOfStockCount}
            label="Out of Stock"
          />
        </>
      )}

      <StatCard
        icon={ShoppingCart}
        color="violet"
        value={s.totalUnitsSold.toLocaleString()}
        label="Units Sold"
        {...formatPeriodTrend(comparison.totalUnitsSold)}
      />
      {/* Organizations with stores keep this card. Hidden for organizations
          without stores (and their credit branches) — pass showCogs to bring it back. */}
      {showCogs ? (
        <StatCard
          icon={CreditCard}
          color="indigo"
          value={fmt(s.cogs)}
          label="Cost of Goods Sold"
        />
      ) : null}
    </div>
  );
}
