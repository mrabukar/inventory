"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, HandCoins, Plus, Wallet } from "lucide-react";

import { SubmitPaymentModal } from "./components/submit-payment-modal";
import { BalancePanel } from "@/components/credit-branches/balance-panel";
import { BranchPaymentStatusBadge } from "@/components/credit-branches/payment-status-badge";
import { StatTile } from "@/components/credit-branches/stat-tile";
import { BranchStatementCard } from "@/components/credit-branches/branch-statement-card";
import { Pager } from "@/components/credit-branches/pager";
import {
  PAYMENT_SORT_OPTIONS,
  paymentSortParams,
  type PaymentSortKey,
} from "@/components/credit-branches/payment-sort";
import { SortSelect } from "@/components/credit-branches/sort-select";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/auth/session";
import { useBranchPayments } from "@/hooks/branch-payments/use-branch-payments";
import { useSubmitBranchPayment } from "@/hooks/branch-payments/use-submit-branch-payment";
import { useCreditBranch } from "@/hooks/credit-branches/use-credit-branch";
import { toNumber } from "@/lib/reports/format";
import { cn, fmt } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import {
  branchPaymentMethodLabel,
  type BranchPaymentStatus,
  type SubmitBranchPaymentInput,
} from "@/types/credit-branches/credit-branch";

const PAYMENTS_PAGE_SIZE = 10;

const STATUS_ACCENT: Record<BranchPaymentStatus, string> = {
  pending: "border-l-[var(--status-amber)]",
  approved: "border-l-[var(--status-emerald)]",
  rejected: "border-l-[var(--status-rose)]",
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default function MyBranchPage() {
  const router = useRouter();
  const { user } = useSession();
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const storeId = user?.storeId ?? undefined;

  useEffect(() => {
    if (user && !user.isCreditBranch) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentSort, setPaymentSort] = useState<PaymentSortKey>("newest");

  const { data: branch, isPending } = useCreditBranch(storeId);
  const {
    data: paymentsData,
    isPending: paymentsLoading,
    isError: paymentsFailed,
    isPlaceholderData: paymentsLoadingNext,
  } = useBranchPayments({
    page: paymentPage,
    limit: PAYMENTS_PAGE_SIZE,
    ...paymentSortParams(paymentSort),
  });
  const submitPayment = useSubmitBranchPayment();

  const [modalOpen, setModalOpen] = useState(false);
  const payments = paymentsData?.data ?? [];
  const paymentsTotal = paymentsData?.meta.total ?? 0;

  const handleSubmit = async (input: SubmitBranchPaymentInput) => {
    try {
      await submitPayment.mutateAsync(input);
      addToast({
        title: "Payment submitted",
        sub: "An admin will review it before it comes off your balance.",
      });
      setModalOpen(false);
    } catch (e) {
      addErrorToast({
        title: "Couldn't submit payment",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  if (!user?.isCreditBranch) {
    return null;
  }

  if (isPending || !branch) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-52 w-full rounded-[var(--r-xl)]" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const nothingOwed = branch.balance <= 0;

  return (
    <>
      <PageHeader
        title="My Branch"
        desc="What you owe for stock, and the payments you've made"
      />

      <BalancePanel
        label="You owe"
        balance={branch.balance}
        totalCredited={branch.totalCredited}
        totalReturned={branch.totalReturned}
        totalPaid={branch.totalPaid}
        actions={
          <Button
            onClick={() => setModalOpen(true)}
            disabled={nothingOwed}
            className="bg-white text-[var(--sidebar-bg)] hover:bg-white/90 disabled:bg-white/20 disabled:text-white/60"
          >
            <Plus className="size-4" />
            Submit payment
          </Button>
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
          label="Paid so far"
          value={fmt(branch.totalPaid)}
          hint="Approved payments"
          tone="emerald"
        />
        <StatTile
          icon={Clock}
          label="Awaiting review"
          value={fmt(branch.totalPending)}
          hint={
            branch.totalPending > 0
              ? "Comes off your balance once approved"
              : "Nothing waiting"
          }
          tone={branch.totalPending > 0 ? "amber" : "slate"}
        />
      </div>

      <div className="mb-6">
        <div className="card overflow-hidden">
          <div className="card-head">
            <h3>Your payments</h3>
            {paymentsLoading || paymentsTotal > 1 ? (
              <SortSelect
                label="Sort payments"
                value={paymentSort}
                options={PAYMENT_SORT_OPTIONS}
                onChange={(next) => {
                  setPaymentSort(next);
                  setPaymentPage(1);
                }}
              />
            ) : null}
          </div>
          {paymentsLoading ? (
            <ul aria-busy="true" aria-label="Loading payments" className="divide-y divide-border">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center justify-between gap-4 border-l-4 border-l-transparent px-6 py-4">
                  <div className="grid gap-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-56" />
                  </div>
                  <Skeleton className="h-6 w-28 rounded-full" />
                </li>
              ))}
            </ul>
          ) : paymentsFailed ? (
            <p className="px-6 py-12 text-center text-sm text-destructive">
              Couldn&apos;t load your payments. Please try again.
            </p>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">
                No payments yet
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Once you&apos;ve paid the organization, submit the payment here and
                an admin will confirm it.
              </p>
              {!nothingOwed ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModalOpen(true)}
                >
                  Submit your first payment
                </Button>
              ) : null}
            </div>
          ) : (
            <ul
              className={cn(
                "divide-y divide-border transition-opacity",
                paymentsLoadingNext && "opacity-60",
              )}
            >
              {payments.map((p) => (
                <li
                  key={p.id}
                  className={cn("border-l-4 px-6 py-4", STATUS_ACCENT[p.status])}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="num text-lg font-semibold text-foreground">
                        {fmt(toNumber(p.amount))}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {branchPaymentMethodLabel(p.method)}
                        {p.reference ? (
                          <>
                            {" · ref "}
                            <span className="num">{p.reference}</span>
                          </>
                        ) : null}
                        {" · paid "}
                        {dateFormat.format(new Date(p.paidAt))}
                      </p>
                    </div>
                    <BranchPaymentStatusBadge status={p.status} />
                  </div>
                  {p.status === "rejected" && p.rejectionReason ? (
                    <p className="mt-3 rounded-[var(--r-md)] bg-[var(--tint-rose)] px-3 py-2 text-sm text-rose-700">
                      <span className="font-semibold">Why it was rejected: </span>
                      {p.rejectionReason}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <Pager
            page={paymentPage}
            limit={PAYMENTS_PAGE_SIZE}
            total={paymentsTotal}
            onPageChange={setPaymentPage}
            busy={paymentsLoadingNext}
          />
        </div>
      </div>

      {storeId ? <BranchStatementCard branchId={storeId} /> : null}

      {modalOpen && (
        <SubmitPaymentModal
          balance={branch.balance}
          isSaving={submitPayment.isPending}
          onClose={() => setModalOpen(false)}
          onSave={(input) => void handleSubmit(input)}
        />
      )}
    </>
  );
}
