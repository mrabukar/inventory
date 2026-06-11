import { AlertTriangle, Package, ShoppingCart, TrendingUp } from "lucide-react";
import { StatCard } from "../stat-card";

interface Props {
  todaySales?: string;
  monthSales?: string;
  inStockBalance: number;
  lowStockCount: number;
}

export function ManagerStatGrid({
  todaySales = "$3,216",
  monthSales = "$27,500",
  inStockBalance,
  lowStockCount,
}: Props) {
  return (
    <div className="stat-grid grid-4 mb-16">
      <StatCard icon={ShoppingCart} color="indigo" value={todaySales} label="Today's Sales" trend="4.2%" />
      <StatCard icon={TrendingUp} color="teal" value={monthSales} label="This Month Sales" trend="9.0%" />
      <StatCard icon={Package} color="violet" value={inStockBalance} label="In-Stock Balance" />
      <StatCard icon={AlertTriangle} color="amber" value={lowStockCount} label="Low Stock Items" />
    </div>
  );
}
