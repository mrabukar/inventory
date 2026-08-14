"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  useCreatePayment,
  usePayments,
  useReceivables,
} from "@/hooks/payments/use-payments";
import { formatDisplayDate } from "@/lib/filters/dates";
import { toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import type { CreatePaymentInput, Payment } from "@/types/payments/payment";

import { RecordPaymentModal } from "./components/record-payment-modal";

export default function PaymentsPage() {
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [openRecord, setOpenRecord] = useState(false);

  const listQuery = useMemo(
    () => ({ page: pageIndex + 1, limit: pageSize }),
    [pageIndex, pageSize],
  );

  const { data, isPending, isFetching, isError, error } =
    usePayments(listQuery);
  const { data: receivables = [] } = useReceivables();
  const createPayment = useCreatePayment();

  const rows = data?.data ?? [];
  const rowCount = data?.meta.total ?? 0;
  const isLoading = isPending || (isFetching && (data?.data.length ?? 0) === 0);

  const totalOutstanding = receivables.reduce((sum, r) => sum + r.balance, 0);

  const columns = useMemo<ColumnDef<Payment>[]>(
    () => [
      {
        id: "paidAt",
        accessorFn: (row) => row.paidAt,
        meta: {
          label: "Date",
          exportValue: (row: Payment) => formatDisplayDate(row.paidAt),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => (
          <span className="muted">
            {formatDisplayDate(row.original.paidAt)}
          </span>
        ),
      },
      {
        id: "customer",
        accessorFn: (row) => row.customer?.name ?? "Anonymous",
        meta: {
          label: "Customer",
          exportValue: (row: Payment) => row.customer?.name ?? "Anonymous",
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Customer" />
        ),
        cell: ({ row }) =>
          row.original.customer ? (
            <Link
              href={`/customers/${row.original.customerId}`}
              className="strong"
            >
              {row.original.customer.name}
            </Link>
          ) : (
            <span className="muted">-</span>
          ),
      },
      {
        id: "invoice",
        accessorFn: (row) => row.invoice.numberLabel,
        meta: {
          label: "Invoice",
          exportValue: (row: Payment) => row.invoice.numberLabel,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Invoice" />
        ),
        cell: ({ row }) => (
          <Link href={`/invoices/${row.original.invoiceId}`} className="muted">
            {row.original.invoice.numberLabel}
          </Link>
        ),
      },
      {
        id: "amount",
        accessorFn: (row) => toNumber(row.amount),
        meta: {
          label: "Amount",
          align: "center" as const,
          exportValue: (row: Payment) => toNumber(row.amount),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Amount" />
        ),
        cell: ({ row }) => (
          <span className="num strong">
            {fmt(toNumber(row.original.amount))}
          </span>
        ),
      },
      {
        id: "note",
        accessorFn: (row) => row.note ?? "",
        meta: {
          label: "Note",
          exportValue: (row: Payment) =>
            row.source === "sale" ? "Collected at sale" : (row.note ?? ""),
        },
        header: "Note",
        cell: ({ row }) => {
          if (row.original.source === "sale") {
            return (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Collected at sale
              </span>
            );
          }
          return <span className="muted">{row.original.note ?? "—"}</span>;
        },
        enableSorting: false,
      },
    ],
    [],
  );

  const handleCreate = async (input: CreatePaymentInput) => {
    try {
      await createPayment.mutateAsync(input);
      addToast({ title: "Payment recorded" });
      setOpenRecord(false);
    } catch (e) {
      addErrorToast({
        title: "Failed to record payment",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  return (
    <>
      <PageHeader
        title="Payments"
        desc="Payments received from customers"
        action={
          <Button onClick={() => setOpenRecord(true)}>
            <Plus className="size-4" />
            Record Payment
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-background px-4 py-3">
          <p className="text-sm text-muted-foreground">Total outstanding</p>
          <p className="num t-rose mt-1 text-xl font-bold">
            {fmt(totalOutstanding)}
          </p>
          <Link
            href="/receivables"
            className="mt-1 inline-block text-xs text-muted-foreground hover:text-foreground"
          >
            {receivables.length} customer{receivables.length === 1 ? "" : "s"}{" "}
            owe →
          </Link>
        </div>
      </div>

      {isError && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          {error instanceof Error ? error.message : "Failed to load payments."}
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        rowCount={rowCount}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPaginationChange={(state: PaginationState) => {
          setPageIndex(state.pageIndex);
          setPageSize(state.pageSize);
        }}
        searchValue=""
        onSearchChange={() => {}}
        isLoading={isLoading}
        enableRowSelection={false}
        emptyTitle="No payments yet"
        emptyDescription="Record a payment to see it here."
      />

      <RecordPaymentModal
        key={openRecord ? "open" : "closed"}
        open={openRecord}
        onClose={() => setOpenRecord(false)}
        onSave={(form) => void handleCreate(form)}
        isSaving={createPayment.isPending}
      />
    </>
  );
}
