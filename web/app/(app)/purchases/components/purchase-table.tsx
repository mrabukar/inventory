"use client";

import { useMemo } from "react";
import { Wrench } from "lucide-react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Button } from "@/components/ui/button";
import { formatDisplayDate } from "@/lib/filters/dates";
import { toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import type { Purchase } from "@/types/purchases/purchase";

interface PurchaseTableProps {
  rows: Purchase[];
  rowCount: number;
  pageIndex: number;
  pageSize: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onPaginationChange: (state: PaginationState) => void;
  isLoading?: boolean;
  toolbarExtra?: React.ReactNode;
  onCorrect?: (purchase: Purchase) => void;
}

export function PurchaseTable({
  rows,
  rowCount,
  pageIndex,
  pageSize,
  searchValue,
  onSearchChange,
  onPaginationChange,
  isLoading = false,
  toolbarExtra,
  onCorrect,
}: PurchaseTableProps) {
  const columns = useMemo<ColumnDef<Purchase>[]>(
    () => [
      {
        accessorKey: "purchaseDate",
        meta: {
          label: "Date",
          exportValue: (row: Purchase) => formatDisplayDate(row.purchaseDate),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => (
          <span className="muted">
            {formatDisplayDate(row.original.purchaseDate)}
          </span>
        ),
      },
      {
        id: "product",
        accessorFn: (row) => row.product.name,
        meta: {
          label: "Product",
          exportValue: (row: Purchase) => row.product.name,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Product" />
        ),
        cell: ({ row }) => (
          <span className="strong">
            {row.original.product.name}
            {row.original.type === "correction" ? (
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                {row.original.quantity > 0 ? "Fix (added)" : "Fix (removed)"}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "model",
        accessorFn: (row) => row.product.model ?? "",
        meta: {
          label: "Model",
          exportValue: (row: Purchase) => row.product.model ?? "",
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Model" />
        ),
        cell: ({ row }) => (
          <span className="muted">{row.original.product.model ?? "—"}</span>
        ),
      },
      {
        accessorKey: "quantity",
        meta: {
          label: "Qty",
          exportValue: (row: Purchase) => String(row.quantity),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Qty" />
        ),
        cell: ({ row }) => {
          const qty = row.original.quantity;
          const label =
            row.original.type === "correction" && qty > 0
              ? `+${qty}`
              : String(qty);
          return <span>{label}</span>;
        },
      },
      {
        id: "unitCost",
        accessorFn: (row) => toNumber(row.unitPurchasePrice),
        meta: {
          label: "Unit cost",
          exportValue: (row: Purchase) =>
            toNumber(row.unitPurchasePrice).toFixed(2),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Unit cost" />
        ),
        cell: ({ row }) => (
          <span className="muted">{fmt(toNumber(row.original.unitPurchasePrice))}</span>
        ),
      },
      {
        id: "total",
        accessorFn: (row) => toNumber(row.totalCost),
        meta: {
          label: "Total",
          exportValue: (row: Purchase) => toNumber(row.totalCost).toFixed(2),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Total" />
        ),
        cell: ({ row }) => (
          <span className="strong">{fmt(toNumber(row.original.totalCost))}</span>
        ),
      },
      {
        accessorKey: "invoiceNumber",
        meta: {
          label: "Invoice",
          exportValue: (row: Purchase) => row.invoiceNumber ?? "",
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Invoice" />
        ),
        cell: ({ row }) => (
          <span className="muted">{row.original.invoiceNumber ?? "—"}</span>
        ),
      },
      {
        id: "recordedBy",
        accessorFn: (row) => row.purchasedBy.name,
        meta: {
          label: "Recorded by",
          exportValue: (row: Purchase) => row.purchasedBy.name,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Recorded by" />
        ),
        cell: ({ row }) => (
          <span className="muted">{row.original.purchasedBy.name}</span>
        ),
      },
      ...(onCorrect
        ? [
            {
              id: "actions",
              meta: { export: false, align: "center" as const },
              header: "Actions",
              enableSorting: false,
              cell: ({ row }) =>
                row.original.type === "purchase" ? (
                  <div className="dt-actions">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0"
                      title="Fix a purchase quantity mistake"
                      onClick={() => onCorrect(row.original)}
                    >
                      <Wrench />
                      Correct
                    </Button>
                  </div>
                ) : (
                  <span className="muted">—</span>
                ),
            } satisfies ColumnDef<Purchase>,
          ]
        : []),
    ],
    [onCorrect],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      rowCount={rowCount}
      pageIndex={pageIndex}
      pageSize={pageSize}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      onPaginationChange={onPaginationChange}
      isLoading={isLoading}
      searchPlaceholder="Search products…"
      toolbarExtra={toolbarExtra}
    />
  );
}
