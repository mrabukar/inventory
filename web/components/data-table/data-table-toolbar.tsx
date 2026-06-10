"use client";

import type { Table } from "@tanstack/react-table";
import { Download, Search, X } from "lucide-react";

import { exportRowsToCsv } from "@/components/data-table/export-csv";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  enableColumnVisibility?: boolean;
  enableExport?: boolean;
  exportFileName?: string;
  onExportAll?: () => Promise<TData[]>;
  toolbarExtra?: React.ReactNode;
}

export function DataTableToolbar<TData>({
  table,
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search…",
  enableColumnVisibility = true,
  enableExport = true,
  exportFileName = "export",
  onExportAll,
  toolbarExtra,
}: DataTableToolbarProps<TData>) {
  const selectedRows = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original);
  const hasSelection = selectedRows.length > 0;
  const columns = table.getAllColumns().map((col) => col.columnDef);

  async function handleExportAll() {
    const rows = onExportAll
      ? await onExportAll()
      : table.getRowModel().rows.map((row) => row.original);
    exportRowsToCsv(rows, columns, exportFileName);
  }

  function handleExportSelected() {
    exportRowsToCsv(selectedRows, columns, `${exportFileName}-selected`);
  }

  return (
    <div className="dt-toolbar">
      <div className="dt-toolbar-left">
        {onSearchChange && (
          <div className="dt-search">
            <Search size={16} color="var(--fg3)" />
            <input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchValue && (
              <button
                type="button"
                className="dt-search-clear"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
        {toolbarExtra}
      </div>
      <div className="dt-toolbar-right">
        {enableExport && (
          <>
            <button
              type="button"
              className="dt-btn"
              disabled={!hasSelection}
              onClick={handleExportSelected}
            >
              <Download size={15} />
              Export selected
            </button>
            <button
              type="button"
              className="dt-btn"
              onClick={() => void handleExportAll()}
            >
              <Download size={15} />
              Export all
            </button>
          </>
        )}
        {enableColumnVisibility && <DataTableViewOptions table={table} />}
      </div>
    </div>
  );
}
