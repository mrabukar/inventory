"use client";

import { useMemo } from "react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { fmt } from "@/lib/utils";
import {
  expenseAmount,
  expenseCategoryColor,
  formatExpenseDate,
  type Expense,
} from "@/types/expenses/expense";

interface ExpensesTableProps {
  rows: Expense[];
  rowCount: number;
  pageIndex: number;
  pageSize: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onPaginationChange: (state: PaginationState) => void;
  isLoading?: boolean;
  onExportAll?: () => Promise<Expense[]>;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  toolbarExtra?: React.ReactNode;
}

export function ExpensesTable({
  rows,
  rowCount,
  pageIndex,
  pageSize,
  searchValue,
  onSearchChange,
  onPaginationChange,
  isLoading = false,
  onExportAll,
  onEdit,
  onDelete,
  toolbarExtra,
}: ExpensesTableProps) {
  const columns = useMemo<ColumnDef<Expense>[]>(
    () => [
      {
        accessorKey: "expenseDate",
        meta: {
          label: "Date",
          exportValue: (row: Expense) => formatExpenseDate(row.expenseDate),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => (
          <span className="muted">
            {formatExpenseDate(row.original.expenseDate)}
          </span>
        ),
      },
      {
        accessorKey: "title",
        meta: {
          label: "Title",
          exportValue: (row: Expense) => row.title,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Title" />
        ),
        cell: ({ row }) => (
          <span className="strong">{row.original.title}</span>
        ),
      },
      {
        id: "category",
        accessorFn: (row) => row.category.name,
        meta: {
          label: "Category",
          exportValue: (row: Expense) => row.category.name,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Category" />
        ),
        cell: ({ row }) => (
          <Badge
            color={
              expenseCategoryColor(row.original.category.name) as
                | "indigo"
                | "teal"
                | "violet"
                | "emerald"
                | "amber"
                | "rose"
                | "slate"
            }
          >
            {row.original.category.name}
          </Badge>
        ),
      },
      {
        id: "store",
        accessorFn: (row) => row.store?.name ?? "Company-wide",
        meta: {
          label: "Store",
          exportValue: (row: Expense) => row.store?.name ?? "Company-wide",
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Store" />
        ),
        cell: ({ row }) =>
          row.original.store ? (
            row.original.store.name
          ) : (
            <Badge color="slate">Company-wide</Badge>
          ),
      },
      {
        id: "amount",
        accessorFn: (row) => expenseAmount(row),
        meta: {
          label: "Amount",
          align: "right",
          exportValue: (row: Expense) => expenseAmount(row),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Amount" />
        ),
        cell: ({ row }) => (
          <span className="num t-amber strong">
            {fmt(expenseAmount(row.original))}
          </span>
        ),
      },
      {
        id: "createdBy",
        accessorFn: (row) => row.createdBy.name,
        meta: {
          label: "Created by",
          exportValue: (row: Expense) => row.createdBy.name,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created by" />
        ),
        cell: ({ row }) => (
          <span className="muted">{row.original.createdBy.name}</span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="r">Actions</span>,
        cell: ({ row }) => (
          <div className="actions">
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
      rowCount={rowCount}
      pageIndex={pageIndex}
      pageSize={pageSize}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      onPaginationChange={onPaginationChange}
      isLoading={isLoading}
      searchPlaceholder="Search expenses…"
      onExportAll={onExportAll}
      toolbarExtra={toolbarExtra}
    />
  );
}
