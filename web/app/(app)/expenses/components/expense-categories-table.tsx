"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import type { ExpenseCategory } from "@/types/expenses/expense-category";

interface ExpenseCategoriesTableProps {
  rows: ExpenseCategory[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  isLoading?: boolean;
  onEdit: (category: ExpenseCategory) => void;
  onDelete: (category: ExpenseCategory) => void;
}

export function ExpenseCategoriesTable({
  rows,
  searchValue,
  onSearchChange,
  isLoading = false,
  onEdit,
  onDelete,
}: ExpenseCategoriesTableProps) {
  const columns = useMemo<ColumnDef<ExpenseCategory>[]>(
    () => [
      {
        accessorKey: "name",
        meta: {
          label: "Name",
          exportValue: (row: ExpenseCategory) => row.name,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <span className="strong">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "description",
        meta: {
          label: "Description",
          exportValue: (row: ExpenseCategory) => row.description ?? "—",
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Description" />
        ),
        cell: ({ row }) => (
          <span className="muted">{row.original.description ?? "—"}</span>
        ),
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
              title="Edit"
              onClick={() => onEdit(row.original)}
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              className="dt-act danger"
              title="Delete"
              onClick={() => onDelete(row.original)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [onDelete, onEdit],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      rowCount={rows.length}
      pageIndex={0}
      pageSize={100}
      onPaginationChange={() => {}}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search categories…"
      isLoading={isLoading}
      enableRowSelection={false}
      enableExport={false}
      enableColumnVisibility={false}
      getRowId={(row) => String(row.id)}
      emptyTitle="No categories found"
      emptyDescription="Try adjusting your search or add a new category."
    />
  );
}
