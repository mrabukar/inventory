"use client";

import { useMemo } from "react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Store } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { CategoryBadge, StockBadge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import type { Inventory } from "@/types/inventory/inventory";

function stockValue(row: Inventory): number {
  return row.quantity * toNumber(row.product.purchasePrice);
}

interface InventoryTableProps {
  rows: Inventory[];
  rowCount: number;
  pageIndex: number;
  pageSize: number;
  onPaginationChange: (state: PaginationState) => void;
  isLoading?: boolean;
  onExportAll?: () => Promise<Inventory[]>;
}

export function InventoryTable({
  rows,
  rowCount,
  pageIndex,
  pageSize,
  onPaginationChange,
  isLoading = false,
  onExportAll,
}: InventoryTableProps) {
  const columns = useMemo<ColumnDef<Inventory>[]>(
    () => [
      {
        id: "product",
        accessorFn: (row) => row.product.name,
        meta: {
          label: "Product",
          exportValue: (row: Inventory) => row.product.name,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Product" />
        ),
        cell: ({ row }) => (
          <>
            <span className="strong">{row.original.product.name}</span>
            &nbsp;
            <CategoryBadge cat={row.original.product.category.name} />
          </>
        ),
      },
      {
        id: "store",
        accessorFn: (row) => row.store.name,
        meta: {
          label: "Store",
          exportValue: (row: Inventory) => row.store.name,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Store" />
        ),
        cell: ({ row }) => (
          <span
            className="muted"
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <Store size={13} />
            {row.original.store.name}
          </span>
        ),
      },
      {
        accessorKey: "quantity",
        meta: {
          label: "Quantity",
          align: "center",
          exportValue: (row: Inventory) => row.quantity,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Quantity" />
        ),
        cell: ({ row }) => {
          const { quantity, lowStockThreshold } = row.original;
          return (
            <span
              className={`num ${quantity <= 0 ? "t-rose strong" : quantity <= lowStockThreshold ? "t-amber strong" : ""}`}
            >
              {quantity}
            </span>
          );
        },
      },
      {
        accessorKey: "lowStockThreshold",
        meta: {
          label: "Threshold",
          align: "center",
          exportValue: (row: Inventory) => row.lowStockThreshold,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Threshold" />
        ),
        cell: ({ row }) => (
          <span className="num muted">{row.original.lowStockThreshold}</span>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => row.quantity,
        meta: {
          label: "Status",
          align: "center",
          export: false,
        },
        header: "Status",
        cell: ({ row }) => (
          <StockBadge
            qty={row.original.quantity}
            threshold={row.original.lowStockThreshold}
          />
        ),
        enableSorting: false,
      },
      {
        id: "stockValue",
        accessorFn: (row) => stockValue(row),
        meta: {
          label: "Stock Value",
          align: "center",
          exportValue: (row: Inventory) => stockValue(row),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Stock Value" />
        ),
        cell: ({ row }) => (
          <span className="num t-indigo">{fmt(stockValue(row.original))}</span>
        ),
      },
      {
        accessorKey: "updatedAt",
        meta: {
          label: "Updated",
          exportValue: (row: Inventory) => row.updatedAt,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Updated" />
        ),
        cell: ({ row }) => (
          <span className="muted">
            {formatRelativeTime(row.original.updatedAt)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      rowCount={rowCount}
      pageIndex={pageIndex}
      pageSize={pageSize}
      onPaginationChange={onPaginationChange}
      isLoading={isLoading}
      enableRowSelection={true}
      exportFileName="inventory"
      onExportAll={onExportAll}
      getRowId={(row) => row.id}
      emptyTitle="No inventory records"
      emptyDescription="Try adjusting your filters."
    />
  );
}
