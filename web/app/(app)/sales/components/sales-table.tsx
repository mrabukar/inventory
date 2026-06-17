"use client";

import { useMemo } from "react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Eye, Store } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { SaleStatusBadge } from "@/components/ui/badge";
import { ProductName } from "@/components/ui/product-name";
import { formatProductLabel } from "@/lib/products/format";
import { formatSaleDate, toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import { saleProfit, type Sale } from "@/types/sales/sale";

interface SalesTableProps {
  rows: Sale[];
  rowCount: number;
  pageIndex: number;
  pageSize: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onPaginationChange: (state: PaginationState) => void;
  isLoading?: boolean;
  onExportAll?: () => Promise<Sale[]>;
  onView: (sale: Sale) => void;
  toolbarExtra?: React.ReactNode;
}

export function SalesTable({
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
}: SalesTableProps) {
  const columns = useMemo<ColumnDef<Sale>[]>(
    () => [
      {
        id: "saleDate",
        accessorFn: (row) => row.saleDate,
        meta: {
          label: "Date",
          exportValue: (row: Sale) => formatSaleDate(row.saleDate),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => (
          <span className="muted">{formatSaleDate(row.original.saleDate)}</span>
        ),
      },
      {
        id: "store",
        accessorFn: (row) => row.store.name,
        meta: {
          label: "Store",
          exportValue: (row: Sale) => row.store.name,
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
        id: "product",
        accessorFn: (row) =>
          formatProductLabel(row.product.name, row.product.model),
        meta: {
          label: "Product",
          exportValue: (row: Sale) =>
            formatProductLabel(row.product.name, row.product.model),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Product" />
        ),
        cell: ({ row }) => (
          <ProductName
            name={row.original.product.name}
            model={row.original.product.model}
          />
        ),
      },
      {
        id: "manager",
        accessorFn: (row) => row.soldBy.name,
        meta: {
          label: "Manager",
          exportValue: (row: Sale) => row.soldBy.name,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Manager" />
        ),
        cell: ({ row }) => (
          <span className="muted">{row.original.soldBy.name}</span>
        ),
      },
      {
        accessorKey: "quantitySold",
        meta: {
          label: "Qty",
          align: "center",
          exportValue: (row: Sale) => row.quantitySold,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Qty" />
        ),
        cell: ({ row }) => (
          <span className="num">{row.original.quantitySold}</span>
        ),
      },
      {
        id: "unitPrice",
        accessorFn: (row) => toNumber(row.unitPrice),
        meta: {
          label: "Unit Price",
          align: "center",
          exportValue: (row: Sale) => toNumber(row.unitPrice),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Unit Price" />
        ),
        cell: ({ row }) => (
          <span className="num muted">{fmt(toNumber(row.original.unitPrice))}</span>
        ),
      },
      {
        id: "totalAmount",
        accessorFn: (row) => toNumber(row.totalAmount),
        meta: {
          label: "Total",
          align: "center",
          exportValue: (row: Sale) => toNumber(row.totalAmount),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Total" />
        ),
        cell: ({ row }) => (
          <span className="num t-indigo strong">
            {fmt(toNumber(row.original.totalAmount))}
          </span>
        ),
      },
      {
        id: "profit",
        accessorFn: (row) => saleProfit(row),
        meta: {
          label: "Profit",
          align: "center",
          exportValue: (row: Sale) => saleProfit(row),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Profit" />
        ),
        cell: ({ row }) => {
          const profit = saleProfit(row.original);
          return (
            <span
              className={`num ${profit >= 0 ? "t-emerald" : "t-rose"}`}
            >
              {fmt(profit)}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        meta: {
          label: "Status",
          align: "center",
          exportValue: (row: Sale) =>
            row.status === "corrected" ? "Corrected" : "Active",
        },
        header: "Status",
        cell: ({ row }) => <SaleStatusBadge status={row.original.status} />,
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
      exportFileName="sales"
      onExportAll={onExportAll}
      getRowId={(row) => row.id}
      toolbarExtra={toolbarExtra}
      emptyTitle="No sales found"
      emptyDescription="Try adjusting your search or filters."
    />
  );
}
