"use client";

import { useMemo } from "react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { SquarePen } from "lucide-react";

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
  saleUnitsSold,
  type Sale,
} from "@/types/sales/sale";

interface SalesHistoryTableProps {
  rows: Sale[];
  rowCount: number;
  pageIndex: number;
  pageSize: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onPaginationChange: (state: PaginationState) => void;
  isLoading?: boolean;
  onCorrect: (sale: Sale) => void;
  toolbarExtra?: React.ReactNode;
}

export function SalesHistoryTable({
  rows,
  rowCount,
  pageIndex,
  pageSize,
  searchValue,
  onSearchChange,
  onPaginationChange,
  isLoading = false,
  onCorrect,
  toolbarExtra,
}: SalesHistoryTableProps) {
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
          const disabled = corrected || !withinWindow;
          const title = corrected
            ? "Already corrected"
            : !withinWindow
              ? `Corrections only within ${SALE_CORRECTION_WINDOW_HOURS} hours of recording`
              : "Correct";
          return (
            <div className="actions">
              <button
                type="button"
                className="act-btn"
                title={title}
                disabled={disabled}
                style={
                  disabled ? { opacity: 0.35, cursor: "not-allowed" } : undefined
                }
                onClick={() => !disabled && onCorrect(row.original)}
              >
                <SquarePen size={16} />
              </button>
            </div>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
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
      onPaginationChange={onPaginationChange}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search product…"
      isLoading={isLoading}
      enableRowSelection={false}
      enableExport={false}
      getRowId={(row) => row.id}
      toolbarExtra={toolbarExtra}
      emptyTitle="No sales yet"
      emptyDescription="Your submitted sales will appear here."
    />
  );
}
