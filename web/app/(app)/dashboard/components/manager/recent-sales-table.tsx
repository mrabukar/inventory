"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { SaleStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatSaleDate, toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import {
  dashboardSaleProductSummary,
  dashboardSaleUnits,
  type DashboardRecentSale,
} from "@/types/reports/common";
import type { SaleStatus } from "@/types/sales/sale";

interface Props {
  sales: DashboardRecentSale[];
}

export function ManagerRecentSalesTable({ sales }: Props) {
  const router = useRouter();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const pageRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return sales.slice(start, start + pageSize);
  }, [sales, pageIndex, pageSize]);

  const columns = useMemo<ColumnDef<DashboardRecentSale>[]>(
    () => [
      {
        id: "saleDate",
        accessorFn: (row) => row.saleDate,
        meta: {
          label: "Date",
          exportValue: (row: DashboardRecentSale) => formatSaleDate(row.saleDate),
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
        accessorFn: (row) => dashboardSaleProductSummary(row),
        meta: {
          label: "Items",
          exportValue: (row: DashboardRecentSale) =>
            dashboardSaleProductSummary(row),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Items" />
        ),
        cell: ({ row }) => (
          <span className="strong">
            {dashboardSaleProductSummary(row.original)}
          </span>
        ),
      },
      {
        id: "units",
        accessorFn: (row) => dashboardSaleUnits(row),
        meta: {
          label: "Units",
          align: "center",
          exportValue: (row: DashboardRecentSale) => dashboardSaleUnits(row),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Units" />
        ),
        cell: ({ row }) => (
          <span className="num">{dashboardSaleUnits(row.original)}</span>
        ),
      },
      {
        id: "totalAmount",
        accessorFn: (row) => toNumber(row.totalAmount),
        meta: {
          label: "Amount",
          align: "center",
          exportValue: (row: DashboardRecentSale) => toNumber(row.totalAmount),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Amount" />
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
          exportValue: (row: DashboardRecentSale) =>
            row.status === "corrected" ? "Corrected" : "Active",
        },
        header: "Status",
        cell: ({ row }) => (
          <SaleStatusBadge status={row.original.status as SaleStatus} />
        ),
        enableSorting: false,
      },
    ],
    [],
  );

  return (
    <Card
      className="dash-card-embed mb-16"
      title="Today's Sales"
      link="View all"
      onLink={() => router.push("/sales-history")}
    >
      <DataTable
        columns={columns}
        data={pageRows}
        rowCount={sales.length}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPaginationChange={({ pageIndex: nextPage, pageSize: nextSize }) => {
          setPageIndex(nextPage);
          setPageSize(nextSize);
        }}
        enableRowSelection={false}
        enableColumnVisibility={false}
        enableExport={false}
        getRowId={(row) => row.id}
        emptyTitle="No sales today"
        emptyDescription="Submit a sale today to see it here."
      />
    </Card>
  );
}
