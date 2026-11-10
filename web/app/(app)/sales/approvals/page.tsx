"use client";

import { useMemo, useState } from "react";
import { CheckCheck } from "lucide-react";

import { RejectSaleDialog } from "./components/reject-sale-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useApproveSale, useRejectSale } from "@/hooks/sales/use-review-sale";
import { useSales } from "@/hooks/sales/use-sales";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { formatProductLabel } from "@/lib/products/format";
import { formatSaleDate, toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import type { Sale } from "@/types/sales/sale";

const QUEUE_LIMIT = 100;

export default function SaleApprovalsPage() {
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const billingEnabled = useAppStore((s) => s.user?.billingEnabled ?? false);

  const { data, isPending, isError, error } = useSales({
    status: "pending",
    limit: QUEUE_LIMIT,
  });
  const approve = useApproveSale();
  const reject = useRejectSale();

  const [rejecting, setRejecting] = useState<Sale | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Review in the order they were submitted.
  const queue = useMemo(
    () =>
      [...(data?.data ?? [])].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      ),
    [data],
  );
  const total = data?.meta.total ?? 0;

  const handleApprove = async (sale: Sale) => {
    setApprovingId(sale.id);
    try {
      await approve.mutateAsync(sale.id);
      addToast({
        title: "Sale approved",
        sub: `${fmt(toNumber(sale.totalAmount))} from ${sale.store.name}`,
      });
    } catch (e) {
      addErrorToast({
        title: "Couldn't approve sale",
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
      addToast({
        title: "Sale rejected",
        sub: "Stock has been returned to the store.",
      });
      setRejecting(null);
    } catch (e) {
      addErrorToast({
        title: "Couldn't reject sale",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  return (
    <>
      <PageHeader
        title="Sale approvals"
        desc={
          total > 0
            ? `${total} sale${total === 1 ? "" : "s"} from branch managers waiting for your review`
            : "Sales from branch managers wait here until you approve them"
        }
      />

      {isError && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          {error instanceof Error ? error.message : "Failed to load sales."}
        </div>
      )}

      {isPending ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : queue.length === 0 && !isError ? (
        <EmptyState
          icon={CheckCheck}
          title="Nothing to review"
          sub="New sales from branch managers will appear here."
        />
      ) : (
        <ol className="grid gap-3" aria-label="Sales awaiting approval">
          {queue.map((sale) => {
            const collected = toNumber(sale.paidAtSubmission ?? 0);
            const busy = approvingId === sale.id;
            return (
              <li
                key={sale.id}
                className="rounded-lg border border-border bg-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
                  <div className="grid gap-0.5">
                    <p className="text-sm font-semibold text-foreground">
                      {sale.store.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {sale.soldBy.name} · sold {formatSaleDate(sale.saleDate)}{" "}
                      · submitted {formatRelativeTime(sale.createdAt)}
                    </p>
                  </div>
                  <p className="num text-lg font-semibold text-foreground">
                    {fmt(toNumber(sale.totalAmount))}
                  </p>
                </div>

                <ul className="grid gap-1.5 px-5 py-3">
                  {sale.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex justify-between gap-4 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        <span className="num text-muted-foreground">
                          {item.quantitySold} ×
                        </span>{" "}
                        {formatProductLabel(
                          item.product.name,
                          item.product.model,
                        )}
                      </span>
                      <span className="num shrink-0">
                        {fmt(toNumber(item.lineTotal))}
                      </span>
                    </li>
                  ))}
                </ul>

                {sale.customer || sale.note || (billingEnabled && collected > 0) ? (
                  <dl className="grid gap-1 px-5 pb-3 text-sm">
                    {sale.customer ? (
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground">Customer</dt>
                        <dd>{sale.customer.name}</dd>
                      </div>
                    ) : null}
                    {billingEnabled && collected > 0 ? (
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground">
                          Paid at counter
                        </dt>
                        <dd className="num">{fmt(collected)}</dd>
                      </div>
                    ) : null}
                    {sale.note ? (
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground">Note</dt>
                        <dd className="min-w-0">{sale.note}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}

                <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => setRejecting(sale)}
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleApprove(sale)}
                  >
                    {busy ? "Approving…" : "Approve"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {total > queue.length ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Showing {queue.length} of {total}. Approve or reject these to load
          the rest.
        </p>
      ) : null}

      {rejecting && (
        <RejectSaleDialog
          sale={rejecting}
          isSaving={reject.isPending}
          onReject={(reason) => void handleReject(reason)}
          onClose={() => setRejecting(null)}
        />
      )}
    </>
  );
}
