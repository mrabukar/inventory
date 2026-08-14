"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { PageHeader } from "@/components/ui/page-header";
import { Combobox } from "@/components/ui/combobox";
import { useInvoices } from "@/hooks/invoices/use-invoices";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatDisplayDate } from "@/lib/filters/dates";
import { toNumber } from "@/lib/reports/format";
import { cn, fmt } from "@/lib/utils";
import type { Invoice, InvoiceStatus } from "@/types/invoices/invoice";

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

const columns: ColumnDef<Invoice>[] = [
  {
    id: "numberLabel",
    accessorFn: (row) => row.numberLabel,
    meta: {
      label: "Invoice #",
      align: "center",
      exportValue: (row: Invoice) => row.numberLabel,
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Invoice #" />
    ),
    cell: ({ row }) => (
      <Link href={`/invoices/${row.original.id}`} className="strong">
        {row.original.numberLabel}
      </Link>
    ),
  },
  {
    id: "issuedAt",
    accessorFn: (row) => row.issuedAt,
    meta: {
      label: "Date",
      align: "center",
      exportValue: (row: Invoice) => formatDisplayDate(row.issuedAt),
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => (
      <span className="muted">{formatDisplayDate(row.original.issuedAt)}</span>
    ),
  },
  {
    id: "customer",
    accessorFn: (row) => row.customer?.name ?? "Walk-in",
    meta: {
      label: "Customer",
      align: "center",
      exportValue: (row: Invoice) => row.customer?.name ?? "Walk-in",
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Customer" />
    ),
    cell: ({ row }) =>
      row.original.customer ? (
        <span>{row.original.customer.name}</span>
      ) : (
        <span className="muted">Walk-in</span>
      ),
  },
  {
    id: "total",
    accessorFn: (row) => toNumber(row.total),
    meta: {
      label: "Total",
      align: "center",
      exportValue: (row: Invoice) => toNumber(row.total),
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total" />
    ),
    cell: ({ row }) => (
      <span className="num">{fmt(toNumber(row.original.total))}</span>
    ),
  },
  {
    id: "paid",
    accessorFn: (row) => toNumber(row.paidAmount),
    meta: {
      label: "Paid",
      align: "center",
      exportValue: (row: Invoice) => toNumber(row.paidAmount),
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Paid" />
    ),
    cell: ({ row }) => (
      <span className="num muted">
        {fmt(toNumber(row.original.paidAmount))}
      </span>
    ),
  },
  {
    id: "balance",
    accessorFn: (row) => toNumber(row.total) - toNumber(row.paidAmount),
    meta: {
      label: "Balance",
      align: "center",
      exportValue: (row: Invoice) =>
        toNumber(row.total) - toNumber(row.paidAmount),
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Balance" />
    ),
    cell: ({ row }) => {
      const balance =
        toNumber(row.original.total) - toNumber(row.original.paidAmount);
      return <span className="num strong">{fmt(balance)}</span>;
    },
  },
  {
    id: "status",
    accessorFn: (row) => row.status,
    meta: { label: "Status", exportValue: (row: Invoice) => row.status },
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
    enableSorting: false,
  },
  {
    id: "actions",
    meta: { export: false },
    header: "Actions",
    cell: ({ row }) => (
      <Link
        href={`/invoices/${row.original.id}`}
        className="dt-act inline-flex"
        title="View / print"
      >
        <FileText size={16} />
      </Link>
    ),
    enableSorting: false,
  },
];

export default function InvoicesPage() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | undefined>();
  const debouncedSearch = useDebouncedValue(search, 300);

  const query = useMemo(
    () => ({
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      status,
    }),
    [pageIndex, pageSize, debouncedSearch, status],
  );

  const { data, isPending, isFetching, isError, error } = useInvoices(query);
  const rows = data?.data ?? [];
  const rowCount = data?.meta.total ?? 0;
  const isLoading = isPending || (isFetching && rows.length === 0);

  const statusFilter = (
    <Combobox
      value={status}
      onValueChange={(value) => {
        setStatus(value as InvoiceStatus | undefined);
        setPageIndex(0);
      }}
      items={[...STATUS_ITEMS]}
      placeholder="All statuses"
      clearOption={{ label: "All statuses" }}
      className="h-8 min-w-[160px]"
    />
  );

  return (
    <>
      <PageHeader title="Invoices" desc="Customer invoices and balances" />

      {isError && (
        <div className="alert-error mb-4">
          {error instanceof Error ? error.message : "Failed to load invoices."}
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
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPageIndex(0);
        }}
        searchPlaceholder="Search by invoice # or customer…"
        isLoading={isLoading}
        enableRowSelection={false}
        toolbarExtra={statusFilter}
        emptyTitle="No invoices"
        emptyDescription="Invoices are created automatically when you record a sale."
      />
    </>
  );
}
