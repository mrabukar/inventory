"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { StockBadge } from "@/components/ui/badge";
import { ProductName } from "@/components/ui/product-name";
import { formatProductLabel } from "@/lib/products/format";
import { Card } from "@/components/ui/card";
import { inventoryQueryKey } from "@/hooks/inventory/use-inventory";
import { listInventory } from "@/service/inventory/list-inventory";
import type { Inventory } from "@/types/inventory/inventory";

type StockAlertRow = Inventory & { alertType: "low" | "out" };

interface Props {
  lowStockCount: number;
  outOfStockCount: number;
}

export function ManagerStockAlertsTable({
  lowStockCount,
  outOfStockCount,
}: Props) {
  const router = useRouter();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });

  const listQuery = useMemo(() => ({ page: 1, limit: 100 }), []);

  const [lowStockQuery, outOfStockQuery] = useQueries({
    queries: [
      {
        queryKey: inventoryQueryKey("low-stock", listQuery),
        queryFn: () => listInventory(listQuery, "low-stock"),
        enabled: lowStockCount > 0,
      },
      {
        queryKey: inventoryQueryKey("out-of-stock", listQuery),
        queryFn: () => listInventory(listQuery, "out-of-stock"),
        enabled: outOfStockCount > 0,
      },
    ],
  });

  const rows = useMemo<StockAlertRow[]>(() => {
    const low = (lowStockQuery.data?.data ?? []).map((row) => ({
      ...row,
      alertType: "low" as const,
    }));
    const out = (outOfStockQuery.data?.data ?? []).map((row) => ({
      ...row,
      alertType: "out" as const,
    }));
    return [...low, ...out];
  }, [lowStockQuery.data, outOfStockQuery.data]);

  const pageRows = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    return rows.slice(start, start + pagination.pageSize);
  }, [rows, pagination.pageIndex, pagination.pageSize]);

  const isLoading =
    (lowStockCount > 0 && lowStockQuery.isPending) ||
    (outOfStockCount > 0 && outOfStockQuery.isPending);

  const columns = useMemo<ColumnDef<StockAlertRow>[]>(
    () => [
      {
        id: "product",
        accessorFn: (row) =>
          formatProductLabel(row.product.name, row.product.model),
        meta: {
          label: "Product",
          exportValue: (row: StockAlertRow) =>
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
        accessorKey: "quantity",
        meta: {
          label: "Qty",
          align: "center",
          exportValue: (row: StockAlertRow) => row.quantity,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Qty" />
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
          exportValue: (row: StockAlertRow) => row.lowStockThreshold,
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
        meta: { label: "Status", align: "center", export: false },
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
        id: "alertType",
        accessorFn: (row) => row.alertType,
        meta: {
          label: "Alert",
          align: "center",
          exportValue: (row: StockAlertRow) =>
            row.alertType === "out" ? "Out of stock" : "Low stock",
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Alert" />
        ),
        cell: ({ row }) => (
          <span
            className={
              row.original.alertType === "out" ? "t-rose strong" : "t-amber strong"
            }
          >
            {row.original.alertType === "out" ? "Out of stock" : "Low stock"}
          </span>
        ),
      },
    ],
    [],
  );

  if (lowStockCount <= 0 && outOfStockCount <= 0) return null;

  return (
    <Card
      className="dash-card-embed"
      title="Stock Alerts"
      titleIcon={AlertTriangle}
      link="View my stock"
      onLink={() => router.push("/my-stock")}
    >
      <DataTable
        columns={columns}
        data={pageRows}
        rowCount={rows.length}
        pageIndex={pagination.pageIndex}
        pageSize={pagination.pageSize}
        onPaginationChange={setPagination}
        isLoading={isLoading}
        enableRowSelection={false}
        enableColumnVisibility={false}
        enableExport={false}
        getRowId={(row) => `${row.alertType}-${row.id}`}
        emptyTitle="No stock alerts"
        emptyDescription="All inventory levels are healthy."
      />
    </Card>
  );
}
