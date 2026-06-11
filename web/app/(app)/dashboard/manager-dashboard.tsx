"use client";

import { PageHeader } from "@/components/ui/page-header";
import { INVENTORY, SALES } from "@/lib/data";
import type { AppUser } from "@/lib/types";
import { ManagerChartsSection } from "./components/manager/charts-section";
import { ManagerRecentSalesTable } from "./components/manager/recent-sales-table";
import { ManagerStatGrid } from "./components/manager/stat-grid";
import { ManagerStockLevelsTable } from "./components/manager/stock-levels-table";

export function ManagerDashboard({ user }: { user: AppUser }) {
  const store = user.store ?? "";
  const label = store.split(" — ")[0];
  const myStock = INVENTORY.filter((i) => i.store === store);
  const mySales = SALES.filter((s) => s.store === store);

  const mobiles = myStock.filter((i) => i.cat === "Mobiles").reduce((a, b) => a + b.qty, 0);
  const accessories = myStock.filter((i) => i.cat === "Accessories").reduce((a, b) => a + b.qty, 0);
  const lowCount = myStock.filter((i) => i.qty <= i.threshold).length;

  return (
    <>
      <PageHeader title={`Dashboard — ${label}`} desc="Your store at a glance" />

      <ManagerStatGrid inStockBalance={mobiles + accessories} lowStockCount={lowCount} />
      <ManagerChartsSection mobiles={mobiles} accessories={accessories} />

      <div className="grid-2">
        <ManagerRecentSalesTable sales={mySales} />
        <ManagerStockLevelsTable stock={myStock} />
      </div>
    </>
  );
}
