"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftRight, Pencil, Plus } from "lucide-react";

import { CreditBranchModal } from "../components/credit-branch-modal";
import { BranchDebtPanel } from "./components/branch-debt-panel";
import { BranchInfoCards } from "./components/branch-info-cards";
import { BranchPerformance } from "./components/branch-performance";
import { BranchReturnSheet } from "./components/branch-return-sheet";
import { BranchTabs } from "./components/branch-tabs";
import { BranchWaitingBar } from "./components/branch-waiting-bar";
import { CreditStockSheet } from "./components/credit-stock-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useReadOnlyView } from "@/hooks/branch-view/use-branch-view";
import { useBranchCredits } from "@/hooks/credit-branches/use-branch-credits";
import {
  useBranchDashboard,
  useBranchLastPayment,
  useBranchManager,
  useBranchPendingPayments,
  useBranchPendingSales,
  useBranchReceivables,
  usePageAccess,
} from "@/hooks/credit-branches/use-branch-overview";
import { useCreditBranch } from "@/hooks/credit-branches/use-credit-branch";
import { useCreditStock } from "@/hooks/credit-branches/use-credit-stock";
import { useCreateBranchReturn } from "@/hooks/credit-branches/use-create-branch-return";
import { useUpdateCreditBranch } from "@/hooks/credit-branches/use-update-credit-branch";
import { useReportFilters } from "@/hooks/filters/use-report-filters";
import { useAppStore } from "@/store/app";
import type {
  CreateBranchReturnInput,
  CreateCreditBranchInput,
  CreditStockInput,
} from "@/types/credit-branches/credit-branch";

export default function CreditBranchDetailPage() {
  // Nothing here may change data for a limited user.
  const readOnly = useReadOnlyView();
  const can = usePageAccess();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const filters = useReportFilters();

  const { data: branch, isPending, isError } = useCreditBranch(id);
  const { data: credits = [] } = useBranchCredits(id);

  const canDashboard = can("dashboard");
  const canReceivables = can("receivables", "payments", "dashboard");
  const canSales = can("sales", "sale-approvals");
  const canPayments = can("branch-payments");
  const dashboard = useBranchDashboard(id, filters.query, canDashboard);
  const receivables = useBranchReceivables(id, canReceivables);
  const pendingSales = useBranchPendingSales(id, canSales);
  const pendingPayments = useBranchPendingPayments(id, canPayments);
  const lastPayment = useBranchLastPayment(id, canPayments);
  const manager = useBranchManager(id, can("users", "audit"));

  const creditStock = useCreditStock();
  const createReturn = useCreateBranchReturn();
  const updateBranch = useUpdateCreditBranch();

  const [sheet, setSheet] = useState<"credit" | "return" | null>(null);
  const [editing, setEditing] = useState(false);

  const handleUpdate = async (input: CreateCreditBranchInput) => {
    try {
      await updateBranch.mutateAsync({ id, input });
      addToast({ title: "Branch updated" });
      setEditing(false);
    } catch (e) {
      addErrorToast({
        title: "Couldn't update the branch",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

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

  if (isError) {
    return (
      <EmptyState
        title="Couldn't open this branch"
        sub="It may have been removed, or you may not have access to it."
      />
    );
  }

  if (isPending || !branch) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const facts = [
    branch.address,
    manager.data ? `Managed by ${manager.data.name}` : null,
  ].filter(Boolean);

  return (
    <>
      <div className="page-head">
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 13 }}>
            <Link
              href="/credit-branches"
              style={{ color: "var(--fg2)", textDecoration: "none" }}
            >
              Credit branches
            </Link>
          </p>
          <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {branch.name}
            {branch.isActive ? null : <Badge color="slate">Inactive</Badge>}
          </h1>
          {facts.length > 0 ? (
            <p className="ph-desc">{facts.join(", ")}</p>
          ) : null}
        </div>
        {readOnly ? null : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
              Edit branch
            </Button>
            <Button variant="outline" onClick={() => setSheet("return")}>
              <ArrowLeftRight className="size-4" />
              Record return
            </Button>
            <Button onClick={() => setSheet("credit")}>
              <Plus className="size-4" />
              Credit stock
            </Button>
          </div>
        )}
      </div>

      <BranchDebtPanel
        branch={branch}
        unsoldStock={
          canDashboard && dashboard.data
            ? dashboard.data.summary.currentStockValue
            : undefined
        }
        customersOwe={
          canReceivables && receivables.data
            ? receivables.data.reduce((sum, r) => sum + r.balance, 0)
            : undefined
        }
        lastPaymentAt={lastPayment.data?.paidAt ?? null}
      />

      <BranchWaitingBar
        sales={pendingSales.data}
        payments={pendingPayments.data}
        canOpenSales={can("sale-approvals")}
        canOpenPayments={can("branch-payments")}
      />

      {canDashboard ? (
        <BranchPerformance
          filters={filters}
          data={dashboard.data}
          isLoading={dashboard.isPending}
          isError={dashboard.isError}
        />
      ) : null}

      <BranchInfoCards
        branch={branch}
        stock={canDashboard ? dashboard.data?.summary : undefined}
        onEdit={readOnly ? undefined : () => setEditing(true)}
      />

      <BranchTabs branchId={id} />

      {editing && (
        <CreditBranchModal
          open
          initial={branch}
          isSaving={updateBranch.isPending}
          onClose={() => setEditing(false)}
          onSave={(input) => void handleUpdate(input)}
        />
      )}

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
