"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { formatDisplayDate } from "@/lib/filters/dates";
import type { Customer } from "@/types/customers/customer";

interface CustomerTableProps {
  rows: Customer[];
  rowCount: number;
  pageIndex: number;
  pageSize: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onPaginationChange: (state: PaginationState) => void;
  isLoading?: boolean;
  toolbarExtra?: React.ReactNode;
  onEdit?: (customer: Customer) => void;
}

export function CustomerTable({
  rows,
  rowCount,
  pageIndex,
  pageSize,
  searchValue,
  onSearchChange,
  onPaginationChange,
  isLoading = false,
  toolbarExtra,
  onEdit,
}: CustomerTableProps) {
  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.name,
        meta: { label: "Name", exportValue: (row: Customer) => row.name },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <Link href={`/customers/${row.original.id}`} className="strong">
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "phone",
        meta: {
          label: "Phone",
          exportValue: (row: Customer) => row.phone ?? "",
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Phone" />
        ),
        cell: ({ row }) => (
          <span className="muted">{row.original.phone ?? "—"}</span>
        ),
      },
      {
        accessorKey: "email",
        meta: {
          label: "Email",
          exportValue: (row: Customer) => row.email ?? "",
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Email" />
        ),
        cell: ({ row }) => (
          <span className="muted">{row.original.email ?? "—"}</span>
        ),
      },
      {
        accessorKey: "createdAt",
        meta: {
          label: "Added",
          exportValue: (row: Customer) => formatDisplayDate(row.createdAt),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Added" />
        ),
        cell: ({ row }) => (
          <span className="muted">
            {formatDisplayDate(row.original.createdAt)}
          </span>
        ),
      },
      ...(onEdit
        ? [
            {
              id: "actions",
              meta: { export: false, align: "center" as const },
              header: "Actions",
              enableSorting: false,
              cell: ({ row }) => (
                <button
                  type="button"
                  className="dt-act"
                  title="Edit customer"
                  onClick={() => onEdit(row.original)}
                >
                  Edit
                </button>
              ),
            } satisfies ColumnDef<Customer>,
          ]
        : []),
    ],
    [onEdit],
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
      searchPlaceholder="Search customers…"
      toolbarExtra={toolbarExtra}
    />
  );
}
