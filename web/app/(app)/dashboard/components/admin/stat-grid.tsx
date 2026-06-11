import {
  AlertTriangle,
  CreditCard,
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
}

export function AdminStatGrid({ summary: s, comparison }: Props) {
  return (
    <div className="stat-grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 mb-16">
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
        label="Gross Profit"
        {...formatPeriodTrend(comparison.grossProfit)}
      />
      <StatCard
        icon={TrendingUp}
        color="violet"
        value={fmt(s.netProfit)}
        label="Net Profit"
        valueColor={s.netProfit < 0 ? "var(--status-rose)" : undefined}
        {...formatPeriodTrend(comparison.netProfit)}
      />
      <StatCard
        icon={CreditCard}
        color="amber"
        value={fmt(s.totalExpenses)}
        label="Total Expenses"
        {...formatExpenseTrend(comparison.totalExpenses)}
      />
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
      <StatCard
        icon={ShoppingCart}
        color="violet"
        value={s.totalUnitsSold.toLocaleString()}
        label="Units Sold"
        {...formatPeriodTrend(comparison.totalUnitsSold)}
      />
      <StatCard
        icon={CreditCard}
        color="indigo"
        value={fmt(s.cogs)}
        label="Cost of Goods Sold"
      />
    </div>
  );
}
