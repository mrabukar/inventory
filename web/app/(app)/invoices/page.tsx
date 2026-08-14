"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Combobox } from "@/components/ui/combobox";
import { EmptyState } from "@/components/ui/empty-state";
import { useInvoices } from "@/hooks/invoices/use-invoices";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatDisplayDate } from "@/lib/filters/dates";
import { toNumber } from "@/lib/reports/format";
import { cn, fmt } from "@/lib/utils";
import type { InvoiceStatus } from "@/types/invoices/invoice";

const STATUS_ITEMS = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partially paid" },
  { value: "paid", label: "Paid" },
] as const;

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, string> = {
    unpaid: "bg-destructive/10 text-destructive",
    partial: "bg-amber-500/10 text-amber-600",
    paid: "bg-emerald-500/10 text-emerald-600",
  };
  const label =
    status === "unpaid" ? "Unpaid" : status === "partial" ? "Partial" : "Paid";
  return (
    <span
      className={cn(
        "rounded px-2 py-0.5 text-xs font-medium capitalize",
        map[status],
      )}
    >
      {label}
    </span>
  );
}

export default function InvoicesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | undefined>();
  const debouncedSearch = useDebouncedValue(search, 300);

  const query = useMemo(
    () => ({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      status,
    }),
    [page, debouncedSearch, status],
  );

  const { data, isPending, isError, error } = useInvoices(query);
  const rows = data?.data ?? [];
  const totalPages = data?.meta.totalPages ?? 1;

  return (
    <>
      <PageHeader title="Invoices" desc="Customer invoices and balances" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="f-input min-w-[220px]"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by invoice # or customer…"
        />
        <Combobox
          value={status}
          onValueChange={(value) => {
            setStatus(value as InvoiceStatus | undefined);
            setPage(1);
          }}
          items={[...STATUS_ITEMS]}
          placeholder="All statuses"
          clearOption={{ label: "All statuses" }}
          className="min-w-[160px]"
        />
      </div>

      {isError ? (
        <div className="alert-error">
          {error instanceof Error ? error.message : "Failed to load invoices."}
        </div>
      ) : isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No invoices"
          sub="Invoices are created automatically when you record a sale."
        />
      ) : (
        <div className="dt">
          <div className="dt-scroll">
            <table className="dt-table">
              <thead className="dt-head">
                <tr>
                  <th className="dt-th-left">Invoice #</th>
                  <th className="dt-th-left">Date</th>
                  <th className="dt-th-left">Customer</th>
                  <th className="dt-th-center">Total</th>
                  <th className="dt-th-center">Paid</th>
                  <th className="dt-th-center">Balance</th>
                  <th className="dt-th-center">Status</th>
                  <th className="dt-th-center">Actions</th>
                </tr>
              </thead>
              <tbody className="dt-body">
                {rows.map((invoice) => {
                  const total = toNumber(invoice.total);
                  const paid = toNumber(invoice.paidAmount);
                  return (
                    <tr key={invoice.id} className="dt-row">
                      <td className="dt-cell-left">
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="strong"
                        >
                          {invoice.numberLabel}
                        </Link>
                      </td>
                      <td className="dt-cell-left">
                        <span className="muted">
                          {formatDisplayDate(invoice.issuedAt)}
                        </span>
                      </td>
                      <td className="dt-cell-left">
                        {invoice.customer?.name ?? (
                          <span className="muted">Walk-in</span>
                        )}
                      </td>
                      <td className="dt-cell-center">
                        <span className="num">{fmt(total)}</span>
                      </td>
                      <td className="dt-cell-center">
                        <span className="num muted">{fmt(paid)}</span>
                      </td>
                      <td className="dt-cell-center">
                        <span className="num strong">{fmt(total - paid)}</span>
                      </td>
                      <td className="dt-cell-center">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="dt-cell-center">
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="dt-act inline-flex"
                          title="View / print"
                        >
                          <FileText size={16} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            className="dt-act"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            className="dt-act"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      ) : null}
    </>
  );
}
