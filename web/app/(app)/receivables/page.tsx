"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { PageHeader } from "@/components/ui/page-header";
import {
  useCreatePayment,
  useReceivables,
} from "@/hooks/payments/use-payments";
import { toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import type { CreatePaymentInput, ReceivableRow } from "@/types/payments/payment";
import { Button } from "@/components/ui/button";

import { RecordPaymentModal } from "../payments/components/record-payment-modal";

export default function ReceivablesPage() {
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const [payTarget, setPayTarget] = useState<string | null>(null);

  const { data = [], isPending, isError, error } = useReceivables();
  const createPayment = useCreatePayment();

  const totalOutstanding = data.reduce((sum, r) => sum + r.balance, 0);

  const columns = useMemo<ColumnDef<ReceivableRow>[]>(
    () => [
      {
        id: "customer",
        accessorFn: (row) => row.customer?.name ?? "",
        meta: {
          label: "Customer",
          exportValue: (row: ReceivableRow) => row.customer?.name ?? "",
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Customer" />
        ),
        cell: ({ row }) =>
          row.original.customer ? (
            <Link
              href={`/customers/${row.original.customer.id}`}
              className="strong"
            >
              {row.original.customer.name}
            </Link>
          ) : (
            <span className="muted">—</span>
          ),
      },
      {
        id: "phone",
        accessorFn: (row) => row.customer?.phone ?? "",
        meta: {
          label: "Phone",
          exportValue: (row: ReceivableRow) => row.customer?.phone ?? "",
        },
        header: "Phone",
        cell: ({ row }) => (
          <span className="muted">{row.original.customer?.phone ?? "—"}</span>
        ),
        enableSorting: false,
      },
      {
        id: "invoices",
        accessorFn: (row) => row.unpaidInvoiceCount,
        meta: {
          label: "Unpaid invoices",
          align: "center" as const,
          exportValue: (row: ReceivableRow) => row.unpaidInvoiceCount,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Unpaid" />
        ),
        cell: ({ row }) => (
          <span className="num">{row.original.unpaidInvoiceCount}</span>
        ),
      },
      {
        id: "balance",
        accessorFn: (row) => row.balance,
        meta: {
          label: "Balance",
          align: "right" as const,
          exportValue: (row: ReceivableRow) => row.balance,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Balance" />
        ),
        cell: ({ row }) => (
          <span className="num t-rose strong">{fmt(row.original.balance)}</span>
        ),
      },
      {
        id: "actions",
        meta: { export: false, align: "center" as const },
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.customer ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPayTarget(row.original.customer!.id)}
            >
              Record payment
            </Button>
          ) : null,
      },
    ],
    [],
  );

  const handleCreate = async (input: CreatePaymentInput) => {
    try {
      await createPayment.mutateAsync(input);
      addToast({ title: "Payment recorded" });
      setPayTarget(null);
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
        title="Receivables"
        desc="Customers with an outstanding balance"
      />

      <div className="mb-6 rounded-lg border border-border bg-background px-4 py-3">
        <p className="text-sm text-muted-foreground">Total outstanding</p>
        <p className="num t-rose mt-1 text-2xl font-bold">
          {fmt(totalOutstanding)}
        </p>
      </div>

      {isError && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          {error instanceof Error ? error.message : "Failed to load receivables."}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data}
        rowCount={data.length}
        pageIndex={0}
        pageSize={100}
        onPaginationChange={() => {}}
        searchValue=""
        onSearchChange={() => {}}
        isLoading={isPending}
        enableRowSelection={false}
        emptyTitle="No outstanding balances"
        emptyDescription="Every customer is up to date."
      />

      <RecordPaymentModal
        key={payTarget ?? "closed"}
        open={payTarget !== null}
        defaultCustomerId={payTarget ?? undefined}
        onClose={() => setPayTarget(null)}
        onSave={(form) => void handleCreate(form)}
        isSaving={createPayment.isPending}
      />
    </>
  );
}
