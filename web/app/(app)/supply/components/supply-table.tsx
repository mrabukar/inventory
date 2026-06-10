"use client";

import { useMemo } from "react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Eye, Store } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { CategoryBadge, SupplyTypeBadge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import {
  supplyInvestment,
  type StockSupply,
} from "@/types/stock-supplies/stock-supply";

function formatQuantity(qty: number): string {
  if (qty > 0) return `+${qty}`;
  return String(qty);
}

interface SupplyTableProps {
  rows: StockSupply[];
  rowCount: number;
  pageIndex: number;
  pageSize: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onPaginationChange: (state: PaginationState) => void;
  isLoading?: boolean;
  onExportAll?: () => Promise<StockSupply[]>;
  onView: (supply: StockSupply) => void;
  toolbarExtra?: React.ReactNode;
}

export function SupplyTable({
  rows,
  rowCount,
  pageIndex,
  pageSize,
  searchValue,
  onSearchChange,
  onPaginationChange,
  isLoading = false,
  onExportAll,
  onView,
  toolbarExtra,
}: SupplyTableProps) {
  const columns = useMemo<ColumnDef<StockSupply>[]>(
    () => [
      {
        accessorKey: "createdAt",
        meta: {
          label: "Date",
          exportValue: (row: StockSupply) => row.createdAt.slice(0, 10),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => (
          <span className="muted">
            {formatRelativeTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "product",
        accessorFn: (row) => row.product.name,
        meta: {
          label: "Product",
          exportValue: (row: StockSupply) => row.product.name,
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
          exportValue: (row: StockSupply) => row.store.name,
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
          label: "Qty",
          align: "center",
          exportValue: (row: StockSupply) => row.quantity,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Qty" />
        ),
        cell: ({ row }) => {
          const { quantity, type } = row.original;
          const isNegative = quantity < 0;
          return (
            <span
              className={`num ${isNegative ? "t-rose strong" : ""}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {formatQuantity(quantity)}
              <SupplyTypeBadge type={type} />
            </span>
          );
        },
      },
      {
        id: "unitPurchasePrice",
        accessorFn: (row) => toNumber(row.unitPurchasePrice),
        meta: {
          label: "Unit Cost",
          align: "center",
          exportValue: (row: StockSupply) => toNumber(row.unitPurchasePrice),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Unit Cost" />
        ),
        cell: ({ row }) => (
          <span className="num muted">
            {fmt(toNumber(row.original.unitPurchasePrice))}
          </span>
        ),
      },
      {
        id: "investment",
        accessorFn: (row) => supplyInvestment(row),
        meta: {
          label: "Total Investment",
          align: "center",
          exportValue: (row: StockSupply) => supplyInvestment(row),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Total Investment" />
        ),
        cell: ({ row }) => (
          <span className="num t-indigo">
            {fmt(supplyInvestment(row.original))}
          </span>
        ),
      },
      {
        id: "suppliedBy",
        accessorFn: (row) => row.suppliedBy.name,
        meta: {
          label: "Supplied by",
          exportValue: (row: StockSupply) => row.suppliedBy.name,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Supplied by" />
        ),
        cell: ({ row }) => (
          <span className="muted">{row.original.suppliedBy.name}</span>
        ),
      },
      {
        id: "note",
        accessorFn: (row) => row.note ?? "",
        meta: {
          label: "Note",
          exportValue: (row: StockSupply) => row.note ?? "",
        },
        header: "Note",
        cell: ({ row }) => {
          const note = row.original.note;
          if (!note) return <span className="muted">—</span>;
          const preview = note.length > 24 ? `${note.slice(0, 24)}…` : note;
          return (
            <button
              type="button"
              className="muted"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
              // onClick={() => onView(row.original)}
            >
              {preview}
              {/* <Eye size={13} /> */}
            </button>
          );
        },
        enableSorting: false,
      },
      {
        id: "actions",
        meta: { export: false, align: "center" },
        header: "Actions",
        cell: ({ row }) => (
          <div className="dt-actions">
            <button
              type="button"
              className="dt-act"
              title="View"
              onClick={() => onView(row.original)}
            >
              <Eye size={16} />
            </button>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [onView],
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
      searchPlaceholder="Search product…"
      isLoading={isLoading}
      exportFileName="stock-supplies"
      onExportAll={onExportAll}
      getRowId={(row) => row.id}
      toolbarExtra={toolbarExtra}
      emptyTitle="No supply records found"
      emptyDescription="Try adjusting your search or filters."
    />
  );
}
