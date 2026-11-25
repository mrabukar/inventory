"use client";

import { useMemo } from "react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { formatDisplayDate } from "@/lib/filters/dates";
import { formatProductLabel } from "@/lib/products/format";
import { toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import type { CreditedStockRow } from "@/types/credit-branches/credit-branch";

interface Props {
  rows: CreditedStockRow[];
  rowCount: number;
  pageIndex: number;
  pageSize: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onPaginationChange: (state: PaginationState) => void;
  isLoading?: boolean;
  toolbarExtra?: React.ReactNode;
  /** Show which branch each line went to (when every branch is listed). */
  showBranch: boolean;
}

/** Stock credited to branches: the branches' side of "purchases". Read-only. */
export function CreditedStockTable({
  rows,
  rowCount,
  pageIndex,
  pageSize,
  searchValue,
  onSearchChange,
  onPaginationChange,
  isLoading = false,
  toolbarExtra,
  showBranch,
}: Props) {
  const columns = useMemo<ColumnDef<CreditedStockRow>[]>(
    () => [
      {
        id: "date",
        accessorFn: (row) => row.creditedAt,
        meta: {
          label: "Date",
          exportValue: (row: CreditedStockRow) =>
            formatDisplayDate(row.creditedAt),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => (
          <span className="muted">
            {formatDisplayDate(row.original.creditedAt)}
          </span>
        ),
      },
      ...(showBranch
        ? [
            {
              id: "branch",
              accessorFn: (row) => row.branch.name,
              meta: {
                label: "Branch",
                exportValue: (row: CreditedStockRow) => row.branch.name,
              },
              header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Branch" />
              ),
              cell: ({ row }) => row.original.branch.name,
            } satisfies ColumnDef<CreditedStockRow>,
          ]
        : []),
      {
        id: "product",
        accessorFn: (row) =>
          formatProductLabel(row.product.name, row.product.model),
        meta: {
          label: "Product",
          exportValue: (row: CreditedStockRow) =>
            formatProductLabel(row.product.name, row.product.model),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Product" />
        ),
        cell: ({ row }) => (
          <span className="strong">
            {formatProductLabel(
              row.original.product.name,
              row.original.product.model,
            )}
          </span>
        ),
      },
      {
        id: "quantity",
        accessorFn: (row) => row.quantity,
        meta: {
          label: "Quantity",
          align: "center" as const,
          exportValue: (row: CreditedStockRow) => row.quantity,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Quantity" />
        ),
        cell: ({ row }) => <span className="num">{row.original.quantity}</span>,
      },
      {
        id: "returned",
        accessorFn: (row) => row.returnedQuantity,
        meta: {
          label: "Returned",
          align: "center" as const,
          exportValue: (row: CreditedStockRow) => row.returnedQuantity,
        },
        header: "Returned",
        cell: ({ row }) =>
          row.original.returnedQuantity > 0 ? (
            <span className="num t-amber">{row.original.returnedQuantity}</span>
          ) : (
            <span className="muted">—</span>
          ),
        enableSorting: false,
      },
      {
        id: "unitPrice",
        accessorFn: (row) => toNumber(row.unitPrice),
        meta: {
          label: "Price per unit",
          align: "center" as const,
          exportValue: (row: CreditedStockRow) => toNumber(row.unitPrice),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Price per unit" />
        ),
        cell: ({ row }) => (
          <span className="num">{fmt(toNumber(row.original.unitPrice))}</span>
        ),
      },
      {
        id: "total",
        accessorFn: (row) => toNumber(row.lineTotal),
        meta: {
          label: "Total",
          align: "center" as const,
          exportValue: (row: CreditedStockRow) => toNumber(row.lineTotal),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Total" />
        ),
        cell: ({ row }) => (
          <span className="num strong">
            {fmt(toNumber(row.original.lineTotal))}
          </span>
        ),
      },
      {
        id: "note",
        accessorFn: (row) => row.note ?? "",
        meta: {
          label: "Note",
          exportValue: (row: CreditedStockRow) => row.note ?? "",
        },
        header: "Note",
        cell: ({ row }) => (
          <span className="muted">{row.original.note ?? "—"}</span>
        ),
        enableSorting: false,
      },
    ],
    [showBranch],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      rowCount={rowCount}
      pageIndex={pageIndex}
      pageSize={pageSize}
      onPaginationChange={onPaginationChange}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search products…"
      isLoading={isLoading}
      enableRowSelection={false}
      toolbarExtra={toolbarExtra}
      emptyTitle="No stock credited"
      emptyDescription="Nothing was credited to this branch in the selected period."
    />
  );
}
