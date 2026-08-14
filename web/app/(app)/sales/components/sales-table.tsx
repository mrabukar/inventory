"use client";

import { useMemo } from "react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Eye, SquarePen, Store } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { SaleStatusBadge } from "@/components/ui/badge";
import { formatSaleDate, toNumber } from "@/lib/reports/format";
import {
  isSaleWithinCorrectionWindow,
  SALE_CORRECTION_WINDOW_HOURS,
} from "@/lib/sales/correction-window";
import { fmt } from "@/lib/utils";
import {
  saleProductSummary,
  saleProfit,
  saleUnitsSold,
  type Sale,
} from "@/types/sales/sale";

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
  onCorrect?: (sale: Sale) => void;
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
  onCorrect,
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
        id: "items",
        accessorFn: (row) => saleProductSummary(row),
        meta: {
          label: "Items",
          exportValue: (row: Sale) => saleProductSummary(row),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Items" />
        ),
        cell: ({ row }) => (
          <span className="strong">{saleProductSummary(row.original)}</span>
        ),
      },
      {
        id: "customer",
        accessorFn: (row) => row.customer?.name ?? "",
        meta: {
          label: "Customer",
          exportValue: (row: Sale) => row.customer?.name ?? "",
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Customer" />
        ),
        cell: ({ row }) => (
          <span className="muted">{row.original.customer?.name ?? "—"}</span>
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
        id: "units",
        accessorFn: (row) => saleUnitsSold(row),
        meta: {
          label: "Units",
          align: "center",
          exportValue: (row: Sale) => saleUnitsSold(row),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Units" />
        ),
        cell: ({ row }) => (
          <span className="num">{saleUnitsSold(row.original)}</span>
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
        cell: ({ row }) => {
          const corrected = row.original.status === "corrected";
          const withinWindow = isSaleWithinCorrectionWindow(
            row.original.createdAt,
          );
          const correctDisabled = corrected || !withinWindow;
          const correctTitle = corrected
            ? "Already corrected"
            : !withinWindow
              ? `Corrections only within ${SALE_CORRECTION_WINDOW_HOURS} hours of recording`
              : "Correct";

          return (
            <div className="dt-actions">
              <button
                type="button"
                className="dt-act"
                title="View"
                onClick={() => onView(row.original)}
              >
                <Eye size={16} />
              </button>
              {onCorrect ? (
                <button
                  type="button"
                  className="dt-act"
                  title={correctTitle}
                  disabled={correctDisabled}
                  style={
                    correctDisabled
                      ? { opacity: 0.35, cursor: "not-allowed" }
                      : undefined
                  }
                  onClick={() =>
                    !correctDisabled && onCorrect(row.original)
                  }
                >
                  <SquarePen size={16} />
                </button>
              ) : null}
            </div>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [onView, onCorrect],
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
