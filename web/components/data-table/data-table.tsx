"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";

import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";

export interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  rowCount: number;
  pageIndex: number;
  pageSize: number;
  onPaginationChange: (state: PaginationState) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  isLoading?: boolean;
  enableRowSelection?: boolean;
  enableColumnVisibility?: boolean;
  enableExport?: boolean;
  exportFileName?: string;
  onExportAll?: () => Promise<TData[]>;
  getRowId?: (row: TData, index: number) => string;
  toolbarExtra?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<TData>({
  columns,
  data,
  rowCount,
  pageIndex,
  pageSize,
  onPaginationChange,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  isLoading = false,
  enableRowSelection = true,
  enableColumnVisibility = true,
  enableExport = true,
  exportFileName = "export",
  onExportAll,
  getRowId,
  toolbarExtra,
  emptyTitle = "No results",
  emptyDescription = "Try adjusting your filters.",
}: DataTableProps<TData>) {
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const selectionColumn = React.useMemo<ColumnDef<TData>>(
    () => ({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { export: false, align: "center" },
    }),
    [],
  );

  const tableColumns = React.useMemo(
    () => (enableRowSelection ? [selectionColumn, ...columns] : columns),
    [columns, enableRowSelection, selectionColumn],
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    rowCount,
    state: {
      pagination: { pageIndex, pageSize },
      rowSelection,
      columnVisibility,
      sorting,
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex, pageSize })
          : updater;
      onPaginationChange(next);
    },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    enableRowSelection,
    getRowId,
  });

  React.useEffect(() => {
    setRowSelection({});
  }, [pageIndex, pageSize, data, searchValue]);

  const showEmpty = !isLoading && data.length === 0;
  const visibleColumns = table.getVisibleLeafColumns();
  const skeletonRows = Math.min(pageSize, 5);

  function columnAlign(columnId: string) {
    const column = table.getColumn(columnId);
    return (
      (column?.columnDef.meta as { align?: string } | undefined)?.align ??
      "center"
    );
  }

  function cellAlignClass(columnId: string) {
    const align = columnAlign(columnId);
    if (align === "left") return "dt-cell-left";
    if (align === "right") return "dt-cell-right";
    return "dt-cell-center";
  }

  function headAlignClass(columnId: string) {
    const align = columnAlign(columnId);
    if (align === "left") return "dt-th-left";
    if (align === "right") return "dt-th-right";
    return "dt-th-center";
  }

  return (
    <div className="dt">
      <DataTableToolbar
        table={table}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder={searchPlaceholder}
        enableColumnVisibility={enableColumnVisibility}
        enableExport={enableExport}
        exportFileName={exportFileName}
        onExportAll={onExportAll}
        toolbarExtra={toolbarExtra}
      />

      <div className="dt-scroll">
        <table className="dt-table">
          <thead className="dt-head">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={headAlignClass(header.column.id)}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="dt-body">
            {isLoading &&
              Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                <tr
                  key={`skeleton-row-${rowIndex}`}
                  className="dt-row dt-skeleton-row"
                >
                  {(visibleColumns.length > 0
                    ? visibleColumns
                    : tableColumns.map((col, i) => ({
                        id: col.id ?? `col-${i}`,
                      }))
                  ).map((column, colIndex) => (
                    <td
                      key={`skeleton-${rowIndex}-${column.id}-${colIndex}`}
                      className={cellAlignClass(column.id)}
                    >
                      <span className="dt-skeleton" aria-hidden="true" />
                    </td>
                  ))}
                </tr>
              ))}

            {!isLoading &&
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="dt-row"
                  data-selected={row.getIsSelected() || undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cellAlignClass(cell.column.id)}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))}

            {showEmpty && (
              <tr>
                <td colSpan={visibleColumns.length} className="dt-empty">
                  <EmptyState title={emptyTitle} sub={emptyDescription} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DataTablePagination table={table} rowCount={rowCount} />
    </div>
  );
}
