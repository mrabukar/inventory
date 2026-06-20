"use client";

import { useMemo } from "react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Store } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { StockBadge } from "@/components/ui/badge";
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
  hideStoreColumn?: boolean;
  hideStockValue?: boolean;
  hideUpdatedAt?: boolean;
  enableRowSelection?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  toolbarExtra?: React.ReactNode;
}

export function InventoryTable({
  rows,
  rowCount,
  pageIndex,
  pageSize,
  onPaginationChange,
  isLoading = false,
  onExportAll,
  hideStoreColumn = false,
  hideStockValue = false,
  hideUpdatedAt = false,
  enableRowSelection = true,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  toolbarExtra,
}: InventoryTableProps) {
  const columns = useMemo<ColumnDef<Inventory>[]>(() => {
    const cols: ColumnDef<Inventory>[] = [
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
          <span className="strong">{row.original.product.name}</span>
        ),
      },
      {
        id: "model",
        accessorFn: (row) => row.product.model ?? "",
        meta: {
          label: "Model",
          exportValue: (row: Inventory) => row.product.model ?? "",
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Model" />
        ),
        cell: ({ row }) => (
          <span className="muted">
            {row.original.product.model || "—"}
          </span>
        ),
      },
    ];

    if (!hideStoreColumn) {
      cols.push({
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
      });
    }

    cols.push(
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
    );

    if (!hideStockValue) {
      cols.push({
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
      });
    }

    if (!hideUpdatedAt) {
      cols.push({
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
      });
    }

    return cols;
  }, [hideStoreColumn, hideStockValue, hideUpdatedAt]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      rowCount={rowCount}
      pageIndex={pageIndex}
      pageSize={pageSize}
      onPaginationChange={onPaginationChange}
      isLoading={isLoading}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      toolbarExtra={toolbarExtra}
      enableRowSelection={enableRowSelection}
      exportFileName="inventory"
      onExportAll={onExportAll}
      getRowId={(row) => row.id}
      emptyTitle="No inventory records"
      emptyDescription="Try adjusting your filters."
    />
  );
}
