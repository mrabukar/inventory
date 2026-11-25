"use client";

import { useReadOnlyView } from "@/hooks/branch-view/use-branch-view";
import { useMemo } from "react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Pencil, Power, PowerOff, ShieldCheck } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge, RoleBadge, StatusBadge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { twoFactorState, type User } from "@/types/users/user";

const TWO_FACTOR_LABEL = {
  on: "On",
  pending: "Setup pending",
  off: "Off",
} as const;

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
  onManageTwoFactor?: (user: User) => void;
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
  onManageTwoFactor,
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
        accessorKey: "twoFactorEnabled",
        meta: {
          label: "2FA",
          exportValue: (row: User) => TWO_FACTOR_LABEL[twoFactorState(row)],
        },
        header: "2FA",
        cell: ({ row }) => {
          const state = twoFactorState(row.original);
          const unprotectedAdmin =
            state === "off" && row.original.role === "admin";
          return (
            <span className="inline-flex items-center gap-1.5">
              <Badge
                color={
                  state === "on"
                    ? "emerald"
                    : state === "pending"
                      ? "amber"
                      : "slate"
                }
              >
                {TWO_FACTOR_LABEL[state]}
              </Badge>
              {unprotectedAdmin ? (
                <span
                  className="text-xs font-medium text-rose-600"
                  title="This admin signs in with only a password"
                >
                  Unprotected
                </span>
              ) : null}
            </span>
          );
        },
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
            {onManageTwoFactor && (
              <button
                type="button"
                className="dt-act"
                title="Two-factor sign-in"
                aria-label={`Two-factor sign-in for ${row.original.name}`}
                onClick={() => onManageTwoFactor(row.original)}
              >
                <ShieldCheck size={16} />
              </button>
            )}
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
    [onEdit, onDeactivate, onActivate, onManageTwoFactor],
  );

  // Nothing here may change data for a limited user (or while browsing branches).
  const readOnly = useReadOnlyView();
  const visibleColumns = useMemo(
    () => (readOnly ? columns.filter((c) => c.id !== "actions") : columns),
    [columns, readOnly],
  );

  return (
    <DataTable
      columns={visibleColumns}
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
