"use client";

import { useState } from "react";
import { CheckCheck, Check, X } from "lucide-react";

import { RejectBranchPaymentDialog } from "./components/reject-branch-payment-dialog";
import { BranchAvatar } from "@/components/credit-branches/branch-avatar";
import { BranchPaymentStatusBadge } from "@/components/credit-branches/payment-status-badge";
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
import { usePendingBranchPaymentsSummary } from "@/hooks/branch-payments/use-pending-branch-payments-count";
import { useBranchPayments } from "@/hooks/branch-payments/use-branch-payments";
import {
  useApproveBranchPayment,
  useRejectBranchPayment,
} from "@/hooks/branch-payments/use-review-branch-payment";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { toNumber } from "@/lib/reports/format";
import { cn, fmt } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import {
  branchPaymentMethodLabel,
  type BranchPayment,
  type BranchPaymentStatus,
} from "@/types/credit-branches/credit-branch";

type Tab = BranchPaymentStatus | "all";

const TABS: { value: Tab; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

const EMPTY: Record<Tab, { title: string; sub: string }> = {
  pending: {
    title: "Nothing to review",
    sub: "Payments branches submit will appear here for you to confirm.",
  },
  approved: {
    title: "No approved payments yet",
    sub: "Payments you approve are listed here.",
  },
  rejected: {
    title: "No rejected payments",
    sub: "Payments you reject, with your reason, are listed here.",
  },
  all: {
    title: "No payments yet",
    sub: "Payments submitted by branches will appear here.",
  },
};

const PAGE_SIZE = 10;

/** The review queue is worked oldest first so nothing gets forgotten; history reads newest first. */
const defaultSortFor = (tab: Tab): PaymentSortKey =>
  tab === "pending" ? "oldest" : "newest";

const ACCENT: Record<BranchPaymentStatus, string> = {
  pending: "border-l-[var(--status-amber)]",
  approved: "border-l-[var(--status-emerald)]",
  rejected: "border-l-[var(--status-rose)]",
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default function BranchPaymentsPage() {
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);

  const [tab, setTab] = useState<Tab>("pending");
  const [sort, setSort] = useState<PaymentSortKey>(defaultSortFor("pending"));
  const [page, setPage] = useState(1);

  const { data, isPending, isPlaceholderData, isError, error } =
    useBranchPayments({
      status: tab === "all" ? undefined : tab,
      page,
      limit: PAGE_SIZE,
      ...paymentSortParams(sort),
    });
  const { data: pendingSummary } = usePendingBranchPaymentsSummary(true);
  const pendingCount = pendingSummary?.count ?? 0;
  const waitingAmount = pendingSummary?.amount ?? 0;

  const approve = useApproveBranchPayment();
  const reject = useRejectBranchPayment();

  const [rejecting, setRejecting] = useState<BranchPayment | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const payments = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  /** Reviewing the only row on the last page would leave that page empty: step back one. */
  const stepBackIfPageEmptied = () => {
    if (payments.length === 1 && page > 1) setPage(page - 1);
  };

  const changeTab = (next: Tab) => {
    setTab(next);
    setSort(defaultSortFor(next));
    setPage(1);
  };

  const handleApprove = async (payment: BranchPayment) => {
    setApprovingId(payment.id);
    try {
      await approve.mutateAsync(payment.id);
      addToast({
        title: "Payment approved",
        sub: `${fmt(toNumber(payment.amount))} from ${payment.store.name}`,
      });
      if (tab === "pending") stepBackIfPageEmptied();
    } catch (e) {
      addErrorToast({
        title: "Couldn't approve payment",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (reason: string) => {
    if (!rejecting) return;
    try {
      await reject.mutateAsync({ id: rejecting.id, reason });
      addToast({ title: "Payment rejected" });
      setRejecting(null);
      if (tab === "pending") stepBackIfPageEmptied();
    } catch (e) {
      addErrorToast({
        title: "Couldn't reject payment",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  return (
    <>
      <PageHeader
        title="Branch payments"
        desc={
          pendingCount > 0
            ? `${pendingCount} payment${pendingCount === 1 ? "" : "s"} waiting for your review`
            : "Check each payment against your EVC, eDahab or bank history, then approve or reject it"
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Payment status"
          className="inline-flex rounded-[var(--r-md)] border border-border bg-card p-1 shadow-[var(--shadow-xs)]"
        >
          {TABS.map((t) => {
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => changeTab(t.value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-[var(--r-sm)] px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-[var(--brand-indigo)] text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {t.value === "pending" && pendingCount > 0 ? (
                  <span
                    className={cn(
                      "num rounded-full px-1.5 text-xs font-semibold leading-5",
                      active
                        ? "bg-white/25 text-white"
                        : "bg-[var(--tint-amber)] text-amber-700",
                    )}
                  >
                    {pendingCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <SortSelect
          label="Sort payments"
          value={sort}
          options={PAYMENT_SORT_OPTIONS}
          onChange={(next) => {
            setSort(next);
            setPage(1);
          }}
        />
      </div>

      {isError && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          {error instanceof Error ? error.message : "Failed to load payments."}
        </div>
      )}

      {tab === "pending" && pendingCount > 0 ? (
        <p className="mb-4 rounded-[var(--r-md)] bg-[var(--tint-amber)] px-4 py-3 text-sm text-amber-800">
          <span className="num font-semibold">{fmt(waitingAmount)}</span> is
          waiting across {pendingCount} payment{pendingCount === 1 ? "" : "s"}.
          It only comes off a branch&apos;s balance once you approve it.
        </p>
      ) : null}

      {isPending ? (
        <div className="grid gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : payments.length === 0 && !isError ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--r-lg)] border border-dashed border-border bg-card px-6 py-16 text-center">
          <span
            aria-hidden
            className="inline-flex size-12 items-center justify-center rounded-[var(--r-md)] bg-[var(--tint-emerald)] text-[var(--status-emerald)]"
          >
            <CheckCheck className="size-6" />
          </span>
          <p className="text-base font-semibold text-foreground">
            {EMPTY[tab].title}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {EMPTY[tab].sub}
          </p>
        </div>
      ) : (
        <>
          <ul
            className={cn(
              "grid gap-4 transition-opacity",
              isPlaceholderData && "opacity-60",
            )}
          >
            {payments.map((payment) => {
              const busy = approvingId === payment.id;
              const isPendingPayment = payment.status === "pending";
              return (
                <li
                  key={payment.id}
                  className={cn(
                    "overflow-hidden rounded-[var(--r-lg)] border border-l-4 border-border bg-card shadow-[var(--shadow-xs)]",
                    ACCENT[payment.status],
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <BranchAvatar name={payment.store.name} />
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-foreground">
                          {payment.store.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Submitted by {payment.submittedBy.name} ·{" "}
                          {formatRelativeTime(payment.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <p className="num text-3xl font-semibold leading-none text-foreground">
                        {fmt(toNumber(payment.amount))}
                      </p>
                      {!isPendingPayment ? (
                        <BranchPaymentStatusBadge status={payment.status} />
                      ) : null}
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-1 gap-3 px-5 pb-5 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Method
                      </dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {branchPaymentMethodLabel(payment.method)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Reference
                      </dt>
                      <dd className="num mt-0.5 break-all font-medium text-foreground">
                        {payment.reference || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Date paid
                      </dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {dateFormat.format(new Date(payment.paidAt))}
                      </dd>
                    </div>
                  </dl>

                  {payment.status === "rejected" && payment.rejectionReason ? (
                    <p className="mx-5 mb-5 rounded-[var(--r-md)] bg-[var(--tint-rose)] px-3 py-2 text-sm text-rose-700">
                      <span className="font-semibold">Reason: </span>
                      {payment.rejectionReason}
                    </p>
                  ) : null}

                  {isPendingPayment ? (
                    <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => setRejecting(payment)}
                      >
                        <X className="size-4" />
                        Reject
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleApprove(payment)}
                      >
                        <Check className="size-4" />
                        {busy ? "Approving…" : "Approve"}
                      </Button>
                    </div>
                  ) : payment.reviewedBy ? (
                    <p className="border-t border-border bg-muted/30 px-5 py-3 text-xs text-muted-foreground">
                      {payment.status === "approved" ? "Approved" : "Rejected"}{" "}
                      by {payment.reviewedBy.name}
                      {payment.reviewedAt
                        ? ` · ${formatRelativeTime(payment.reviewedAt)}`
                        : ""}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="mt-4 overflow-hidden rounded-[var(--r-lg)] border border-border bg-card shadow-[var(--shadow-xs)]">
            <Pager
              page={page}
              limit={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
              busy={isPlaceholderData}
              className="border-t-0"
            />
          </div>
        </>
      )}

      {rejecting && (
        <RejectBranchPaymentDialog
          payment={rejecting}
          isSaving={reject.isPending}
          onReject={(reason) => void handleReject(reason)}
          onClose={() => setRejecting(null)}
        />
      )}
    </>
  );
}
