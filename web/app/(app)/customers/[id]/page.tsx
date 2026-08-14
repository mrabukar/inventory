"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";

import { CustomerModal } from "../components/customer-modal";
import { RecordPaymentModal } from "../../payments/components/record-payment-modal";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { useCustomer } from "@/hooks/customers/use-customers";
import { useUpdateCustomer } from "@/hooks/customers/use-mutate-customer";
import {
  useCreatePayment,
  useCustomerBalance,
  useCustomerStatement,
} from "@/hooks/payments/use-payments";
import { formatDisplayDate } from "@/lib/filters/dates";
import { fmt } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import type { CreateCustomerInput } from "@/types/customers/customer";
import type { CreatePaymentInput, CustomerStatementRow } from "@/types/payments/payment";

const statementColumns: ColumnDef<CustomerStatementRow>[] = [
  {
    id: "date",
    accessorFn: (row) => row.date,
    meta: { label: "Date", align: "left", exportValue: (row: CustomerStatementRow) => formatDisplayDate(row.date) },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
    cell: ({ row }) => (
      <span className="muted">{formatDisplayDate(row.original.date)}</span>
    ),
  },
  {
    id: "reference",
    accessorFn: (row) => row.reference,
    meta: { label: "Reference", align: "left", exportValue: (row: CustomerStatementRow) => row.reference },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Reference" />,
    cell: ({ row }) => <span className="strong">{row.original.reference}</span>,
  },
  {
    id: "description",
    accessorFn: (row) => row.description,
    meta: { label: "Description", align: "left", exportValue: (row: CustomerStatementRow) => row.description },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
    cell: ({ row }) => <span className="muted">{row.original.description}</span>,
  },
  {
    id: "charge",
    accessorFn: (row) => row.charge ?? "",
    meta: { label: "Charge", align: "right", exportValue: (row: CustomerStatementRow) => row.charge ?? "" },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Charge" />,
    cell: ({ row }) =>
      row.original.charge != null ? (
        <span className="num">{fmt(row.original.charge)}</span>
      ) : (
        <span className="muted">—</span>
      ),
    enableSorting: false,
  },
  {
    id: "payment",
    accessorFn: (row) => row.payment ?? "",
    meta: { label: "Payment", align: "right", exportValue: (row: CustomerStatementRow) => row.payment ?? "" },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Payment" />,
    cell: ({ row }) =>
      row.original.payment != null ? (
        <span className="num t-emerald">{fmt(row.original.payment)}</span>
      ) : (
        <span className="muted">—</span>
      ),
    enableSorting: false,
  },
  {
    id: "balance",
    accessorFn: (row) => row.balance,
    meta: { label: "Balance", align: "right", exportValue: (row: CustomerStatementRow) => row.balance },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Balance" />,
    cell: ({ row }) => (
      <span className={`num strong ${row.original.balance > 0 ? "t-rose" : ""}`}>
        {fmt(row.original.balance)}
      </span>
    ),
    enableSorting: false,
  },
];

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm">{value?.trim() ? value : "—"}</span>
    </div>
  );
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const billingEnabled = useAppStore((s) => s.user?.billingEnabled ?? false);
  const [editing, setEditing] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [stmtPageIndex, setStmtPageIndex] = useState(0);
  const [stmtPageSize, setStmtPageSize] = useState(20);

  const { data: customer, isPending, isError, error } = useCustomer(id);
  const updateCustomer = useUpdateCustomer();
  const createPayment = useCreatePayment();

  const enableBilling = billingEnabled && Boolean(id);
  const { data: balance } = useCustomerBalance(enableBilling ? id : undefined);
  const { data: statement } = useCustomerStatement(
    enableBilling ? id : undefined,
  );

  const handleSave = async (input: CreateCustomerInput) => {
    if (!customer) return;
    try {
      await updateCustomer.mutateAsync({ id: customer.id, input });
      addToast({ title: "Customer updated" });
      setEditing(false);
    } catch (e) {
      addErrorToast({
        title: "Failed to update customer",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  const handleRecordPayment = async (input: CreatePaymentInput) => {
    try {
      await createPayment.mutateAsync(input);
      addToast({ title: "Payment recorded" });
      setPayOpen(false);
    } catch (e) {
      addErrorToast({
        title: "Failed to record payment",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  return (
    <>
      <Link
        href="/customers"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to customers
      </Link>

      {isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : isError || !customer ? (
        <div className="alert-error">
          {error instanceof Error ? error.message : "Customer not found."}
        </div>
      ) : (
        <>
          <PageHeader
            title={customer.name}
            desc="Customer profile"
            action={
              <div className="flex flex-wrap gap-2">
                {billingEnabled ? (
                  <Button onClick={() => setPayOpen(true)}>
                    <Plus className="size-4" />
                    Record payment
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" />
                  Edit
                </Button>
              </div>
            }
          />

          <div className="rounded-lg border border-border bg-background p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Name" value={customer.name} />
              <DetailRow label="Phone" value={customer.phone} />
              <DetailRow label="Email" value={customer.email} />
              <DetailRow label="Address" value={customer.address} />
              <DetailRow label="Note" value={customer.note} />
            </div>
          </div>

          {billingEnabled && balance ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-background px-4 py-3">
                <p className="text-sm text-muted-foreground">Total billed</p>
                <p className="num mt-1 text-xl font-bold">
                  {fmt(balance.totalBilled)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background px-4 py-3">
                <p className="text-sm text-muted-foreground">Total paid</p>
                <p className="num t-emerald mt-1 text-xl font-bold">
                  {fmt(balance.totalPaid)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Outstanding balance
                </p>
                <p
                  className={`num mt-1 text-xl font-bold ${balance.balance > 0 ? "t-rose" : "t-emerald"}`}
                >
                  {fmt(balance.balance)}
                </p>
                {balance.unpaidInvoiceCount > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Across {balance.unpaidInvoiceCount} unpaid invoice
                    {balance.unpaidInvoiceCount === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {billingEnabled && statement ? (
            <div className="mt-4">
              <div className="mb-2">
                <h2 className="text-sm font-semibold">Statement</h2>
                <p className="text-xs text-muted-foreground">
                  All invoices and payments with a running balance.
                </p>
              </div>
              <DataTable
                columns={statementColumns}
                data={statement.rows.slice(
                  stmtPageIndex * stmtPageSize,
                  (stmtPageIndex + 1) * stmtPageSize,
                )}
                rowCount={statement.rows.length}
                pageIndex={stmtPageIndex}
                pageSize={stmtPageSize}
                onPaginationChange={(state: PaginationState) => {
                  setStmtPageIndex(state.pageIndex);
                  setStmtPageSize(state.pageSize);
                }}
                getRowId={(_, index) => String(stmtPageIndex * stmtPageSize + index)}
                enableRowSelection={false}
                enableColumnVisibility={false}
                emptyTitle="No activity yet"
                emptyDescription="Invoices and payments will appear here."
              />
            </div>
          ) : null}

          <CustomerModal
            key={editing ? "edit" : "closed"}
            open={editing}
            customer={customer}
            onClose={() => setEditing(false)}
            onSave={(form) => void handleSave(form)}
            isSaving={updateCustomer.isPending}
          />

          <RecordPaymentModal
            key={payOpen ? "pay" : "closed"}
            open={payOpen}
            defaultCustomerId={customer.id}
            onClose={() => setPayOpen(false)}
            onSave={(form) => void handleRecordPayment(form)}
            isSaving={createPayment.isPending}
          />
        </>
      )}
    </>
  );
}
