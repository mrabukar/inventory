"use client";

import { useReadOnlyView } from "@/hooks/branch-view/use-branch-view";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Landmark, Plus } from "lucide-react";

import { CreditBranchModal } from "./components/credit-branch-modal";
import { BranchAvatar } from "@/components/credit-branches/branch-avatar";
import {
  RepaymentBar,
  repaidPercent,
} from "@/components/credit-branches/repayment-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { usePendingBranchPaymentsCount } from "@/hooks/branch-payments/use-pending-branch-payments-count";
import { useCreateCreditBranch } from "@/hooks/credit-branches/use-create-credit-branch";
import { useCreditBranches } from "@/hooks/credit-branches/use-credit-branches";
import { cn, fmt } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import type { CreateCreditBranchInput } from "@/types/credit-branches/credit-branch";

function SummaryItem({
  label,
  value,
  href,
  emphasis,
}: {
  label: string;
  value: string;
  href?: string;
  emphasis?: boolean;
}) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "num mt-1 text-2xl font-semibold",
          emphasis ? "text-rose-600" : "text-foreground",
        )}
      >
        {value}
      </p>
    </>
  );
  const cls = "px-6 py-5";
  return href ? (
    <Link
      href={href}
      className={cn(
        cls,
        "block transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default function CreditBranchesPage() {
  // Nothing here may change data for a limited user.
  const readOnly = useReadOnlyView();
  const router = useRouter();
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);

  const { data, isPending, isError, error } = useCreditBranches();
  const { data: pendingCount = 0 } = usePendingBranchPaymentsCount(true);
  const createBranch = useCreateCreditBranch();
  const [modalOpen, setModalOpen] = useState(false);

  // Whoever owes the most comes first.
  const branches = useMemo(
    () => [...(data ?? [])].sort((a, b) => b.balance - a.balance),
    [data],
  );
  const totals = useMemo(
    () =>
      branches.reduce(
        (sum, b) => ({
          owed: sum.owed + b.balance,
          credited: sum.credited + b.totalCredited,
          paid: sum.paid + b.totalPaid,
        }),
        { owed: 0, credited: 0, paid: 0 },
      ),
    [branches],
  );

  const handleCreate = async (input: CreateCreditBranchInput) => {
    try {
      const branch = await createBranch.mutateAsync(input);
      addToast({
        title: "Branch added",
        sub: "Add a branch manager login for it from Users.",
      });
      setModalOpen(false);
      router.push(`/credit-branches/${branch.id}`);
    } catch (e) {
      addErrorToast({
        title: "Couldn't add branch",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  return (
    <>
      <PageHeader
        title="Credit Branches"
        desc="Branches that buy stock from you on credit and pay it back over time"
        action={
          readOnly ? null : (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="size-4" />
              Add branch
            </Button>
          )
        }
      />

      {isError && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          {error instanceof Error ? error.message : "Failed to load branches."}
        </div>
      )}

      {isPending ? (
        <div className="grid gap-5">
          <Skeleton className="h-24 w-full" />
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-60" />
            ))}
          </div>
        </div>
      ) : branches.length === 0 && !isError ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--r-lg)] border border-dashed border-border bg-card px-6 py-16 text-center">
          <span
            aria-hidden
            className="inline-flex size-12 items-center justify-center rounded-[var(--r-md)] bg-[var(--tint-indigo)] text-[var(--brand-indigo-600)]"
          >
            <Landmark className="size-6" />
          </span>
          <p className="text-base font-semibold text-foreground">
            No credit branches yet
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            Add a branch, give it a manager login from Users, then credit it
            some stock. What it owes and what it has paid will show up here.
          </p>
          {readOnly ? null : (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="size-4" />
              Add your first branch
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="mb-6 grid divide-y divide-border overflow-hidden rounded-[var(--r-lg)] border border-border bg-card shadow-[var(--shadow-xs)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            <SummaryItem
              label="Owed to you"
              value={fmt(totals.owed)}
              emphasis={totals.owed > 0}
            />
            <SummaryItem label="Stock credited" value={fmt(totals.credited)} />
            <SummaryItem label="Paid back" value={fmt(totals.paid)} />
            <SummaryItem
              label="Payments to review"
              value={String(pendingCount)}
              href="/credit-branches/payments"
            />
          </div>

          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {branches.map((branch) => {
              const percent = repaidPercent(branch);
              const settled = branch.balance <= 0 && branch.totalCredited > 0;
              return (
                <li key={branch.id}>
                  <Link
                    href={`/credit-branches/${branch.id}`}
                    className="group flex h-full flex-col rounded-[var(--r-lg)] border border-border bg-card p-5 shadow-[var(--shadow-xs)] transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-[var(--brand-indigo)]/40 hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transform-none"
                  >
                    <div className="flex items-start gap-3">
                      <BranchAvatar name={branch.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-semibold text-foreground">
                          {branch.name}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {branch.address}
                        </p>
                      </div>
                      {!branch.isActive ? (
                        <Badge color="rose">Inactive</Badge>
                      ) : null}
                    </div>

                    <div className="mt-6">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {settled ? "Status" : "Owes"}
                      </p>
                      {settled ? (
                        <p className="mt-1 text-2xl font-semibold text-emerald-600">
                          Fully repaid
                        </p>
                      ) : (
                        <p
                          className={cn(
                            "num mt-1 text-3xl font-semibold leading-none",
                            branch.balance > 0
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {fmt(branch.balance)}
                        </p>
                      )}
                    </div>

                    <div className="mt-5">
                      <RepaymentBar percent={percent} />
                      <p className="mt-2 text-xs text-muted-foreground">
                        <span className="num font-medium text-foreground">
                          {Math.round(percent)}%
                        </span>{" "}
                        repaid
                      </p>
                    </div>

                    <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Credited
                        </dt>
                        <dd className="num font-semibold text-foreground">
                          {fmt(branch.totalCredited)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Paid</dt>
                        <dd className="num font-semibold text-emerald-600">
                          {fmt(branch.totalPaid)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Pending
                        </dt>
                        <dd
                          className={cn(
                            "num font-semibold",
                            branch.totalPending > 0
                              ? "text-amber-600"
                              : "text-muted-foreground",
                          )}
                        >
                          {fmt(branch.totalPending)}
                        </dd>
                      </div>
                    </dl>

                    <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-indigo-600)]">
                      View branch
                      <ArrowRight
                        className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
                        aria-hidden
                      />
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <CreditBranchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={(input) => void handleCreate(input)}
        isSaving={createBranch.isPending}
      />
    </>
  );
}
