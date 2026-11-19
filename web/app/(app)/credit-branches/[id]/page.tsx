"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeftRight, Clock, HandCoins, Plus, Wallet } from "lucide-react";

import { BranchReturnSheet } from "./components/branch-return-sheet";
import { CreditStockSheet } from "./components/credit-stock-sheet";
import { BalancePanel } from "@/components/credit-branches/balance-panel";
import { StatTile } from "@/components/credit-branches/stat-tile";
import { BranchStatementCard } from "@/components/credit-branches/branch-statement-card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranchCredits } from "@/hooks/credit-branches/use-branch-credits";
import { useCreditBranch } from "@/hooks/credit-branches/use-credit-branch";
import { useCreditStock } from "@/hooks/credit-branches/use-credit-stock";
import { useCreateBranchReturn } from "@/hooks/credit-branches/use-create-branch-return";
import { fmt } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import type {
  CreateBranchReturnInput,
  CreditStockInput,
} from "@/types/credit-branches/credit-branch";

export default function CreditBranchDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);

  const { data: branch, isPending } = useCreditBranch(id);
  const { data: credits = [] } = useBranchCredits(id);

  const creditStock = useCreditStock();
  const createReturn = useCreateBranchReturn();

  const [sheet, setSheet] = useState<"credit" | "return" | null>(null);

  const handleCreditStock = async (input: CreditStockInput) => {
    try {
      await creditStock.mutateAsync({ id, input });
      addToast({ title: "Stock credited to the branch" });
      setSheet(null);
    } catch (e) {
      addErrorToast({
        title: "Couldn't credit stock",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  const handleReturn = async (input: CreateBranchReturnInput) => {
    try {
      await createReturn.mutateAsync({ id, input });
      addToast({ title: "Return recorded" });
      setSheet(null);
    } catch (e) {
      addErrorToast({
        title: "Couldn't record the return",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  if (isPending || !branch) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <>
      <PageHeader title={branch.name} desc={branch.address} />

      <BalancePanel
        label="Owes you"
        balance={branch.balance}
        totalCredited={branch.totalCredited}
        totalReturned={branch.totalReturned}
        totalPaid={branch.totalPaid}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setSheet("return")}
              className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <ArrowLeftRight className="size-4" />
              Record return
            </Button>
            <Button
              onClick={() => setSheet("credit")}
              className="bg-white text-[var(--sidebar-bg)] hover:bg-white/90"
            >
              <Plus className="size-4" />
              Credit stock
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile
          icon={HandCoins}
          label="Stock credited"
          value={fmt(branch.totalCredited)}
          hint="All time"
          tone="indigo"
        />
        <StatTile
          icon={Wallet}
          label="Paid back"
          value={fmt(branch.totalPaid)}
          hint="Approved payments"
          tone="emerald"
        />
        <StatTile
          icon={Clock}
          label="Awaiting your approval"
          value={fmt(branch.totalPending)}
          hint={branch.totalPending > 0 ? "Review under Payments" : "Nothing waiting"}
          tone={branch.totalPending > 0 ? "amber" : "slate"}
        />
      </div>

      <BranchStatementCard branchId={id} />

      {sheet === "credit" && (
        <CreditStockSheet
          isSaving={creditStock.isPending}
          onClose={() => setSheet(null)}
          onSave={(input) => void handleCreditStock(input)}
        />
      )}

      {sheet === "return" && (
        <BranchReturnSheet
          credits={credits}
          isSaving={createReturn.isPending}
          onClose={() => setSheet(null)}
          onSave={(input) => void handleReturn(input)}
        />
      )}
    </>
  );
}
