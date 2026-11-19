"use client";

import { Clock, Landmark, Wallet } from "lucide-react";
import { useCreditBranch } from "@/hooks/credit-branches/use-credit-branch";
import { fmt } from "@/lib/utils";
import { StatCard } from "../stat-card";

/** Credit branches only: what the branch owes the organization for stock. */
export function CreditBalanceGrid({ storeId }: { storeId: string }) {
  const { data: branch } = useCreditBranch(storeId);

  if (!branch) return null;

  return (
    <div className="stat-grid grid-3 mb-16">
      <StatCard
        icon={Landmark}
        color="rose"
        value={fmt(branch.balance)}
        valueColor={branch.balance > 0 ? "var(--status-rose)" : undefined}
        label="Outstanding balance"
        href="/my-branch"
      />
      <StatCard
        icon={Wallet}
        color="emerald"
        value={fmt(branch.totalPaid)}
        label="Paid so far"
        href="/my-branch"
      />
      <StatCard
        icon={Clock}
        color="amber"
        value={fmt(branch.totalPending)}
        label="Payments awaiting approval"
        href="/my-branch"
      />
    </div>
  );
}
