import { AlertTriangle, Package, ShoppingCart, TrendingUp } from "lucide-react";
import { formatPeriodTrend } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import type { ManagerPeriodComparison } from "@/types/reports/common";
import type { ManagerDashboardSummary } from "@/types/reports/manager-dashboard";
import { StatCard } from "../stat-card";

interface Props {
  summary: ManagerDashboardSummary;
  comparison: ManagerPeriodComparison;
}

export function ManagerStatGrid({ summary: s, comparison }: Props) {
  return (
    <div className="stat-grid grid-4 mb-16">
      <StatCard
        icon={ShoppingCart}
        color="indigo"
        value={fmt(s.todayRevenue)}
        label="Today's Sales"
        {...formatPeriodTrend(comparison.todayRevenue)}
      />
      <StatCard
        icon={TrendingUp}
        color="teal"
        value={fmt(s.monthRevenue)}
        label="This Month Sales"
        {...formatPeriodTrend(comparison.monthRevenue)}
      />
      <StatCard
        icon={Package}
        color="violet"
        value={s.inStockBalance.toLocaleString()}
        label="In-Stock Balance"
      />
      <StatCard
        icon={AlertTriangle}
        color="amber"
        value={s.lowStockCount}
        label="Low Stock Items"
      />
      <StatCard
        icon={AlertTriangle}
        color="rose"
        value={s.outOfStockCount}
        label="Out of Stock"
      />
    </div>
  );
}
