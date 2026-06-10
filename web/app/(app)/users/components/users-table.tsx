"use client";

import { useMemo } from "react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Pencil, Power, PowerOff } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { RoleBadge, StatusBadge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { User } from "@/types/users/user";

interface UsersTableProps {
  rows: User[];
  rowCount: number;
  pageIndex: number;
  pageSize: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onPaginationChange: (state: PaginationState) => void;
  isLoading?: boolean;
  onExportAll?: () => Promise<User[]>;
  onEdit: (user: User) => void;
  onDeactivate: (user: User) => void;
  onActivate: (user: User) => void;
  toolbarExtra?: React.ReactNode;
}

export function UsersTable({
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
  onDeactivate,
  onActivate,
  toolbarExtra,
}: UsersTableProps) {
  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: "name",
        meta: {
          label: "Name",
          exportValue: (row: User) => row.name,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => <span className="strong">{row.original.name}</span>,
      },
      {
        accessorKey: "email",
        meta: {
          label: "Email",
          exportValue: (row: User) => row.email,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Email" />
        ),
        cell: ({ row }) => (
          <span className="muted">{row.original.email}</span>
        ),
      },
      {
        accessorKey: "role",
        meta: {
          label: "Role",
          exportValue: (row: User) => row.role,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
      },
      {
        id: "store",
        accessorFn: (row) => row.store?.name ?? "—",
        meta: {
          label: "Store",
          exportValue: (row: User) => row.store?.name ?? "—",
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Store" />
        ),
        cell: ({ row }) => row.original.store?.name ?? "—",
      },
      {
        accessorKey: "isActive",
        meta: {
          label: "Status",
          exportValue: (row: User) => (row.isActive ? "Active" : "Inactive"),
        },
        header: "Status",
        cell: ({ row }) => <StatusBadge active={row.original.isActive} />,
        enableSorting: false,
      },
      {
        accessorKey: "createdAt",
        meta: {
          label: "Created",
          exportValue: (row: User) => row.createdAt.slice(0, 10),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => (
          <span className="muted">{formatRelativeTime(row.original.createdAt)}</span>
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
            {row.original.isActive ? (
              <button
                type="button"
                className="dt-act danger"
                title="Deactivate"
                onClick={() => onDeactivate(row.original)}
              >
                <PowerOff size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="dt-act"
                title="Reactivate"
                onClick={() => onActivate(row.original)}
              >
                <Power size={16} />
              </button>
            )}
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [onEdit, onDeactivate, onActivate],
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
      searchPlaceholder="Search name or email…"
      isLoading={isLoading}
      exportFileName="users"
      onExportAll={onExportAll}
      getRowId={(row) => row.id}
      toolbarExtra={toolbarExtra}
      emptyTitle="No users found"
      emptyDescription="Try adjusting your search or filters."
    />
  );
}
