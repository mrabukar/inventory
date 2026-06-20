"use client";

import { useMemo } from "react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Pencil /* , Power, PowerOff */ } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { RoleBadge, StatusBadge } from "@/components/ui/badge";
import type { OrganizationUser } from "@/types/organizations/organization";

interface OrganizationUsersTableProps {
  rows: OrganizationUser[];
  rowCount: number;
  pageIndex: number;
  pageSize: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onPaginationChange: (state: PaginationState) => void;
  isLoading?: boolean;
  onEdit?: (user: OrganizationUser) => void;
  onDeactivate?: (user: OrganizationUser) => void;
  onActivate?: (user: OrganizationUser) => void;
}

export function OrganizationUsersTable({
  rows,
  rowCount,
  pageIndex,
  pageSize,
  searchValue,
  onSearchChange,
  onPaginationChange,
  isLoading = false,
  onEdit,
  onDeactivate,
  onActivate,
}: OrganizationUsersTableProps) {
  const columns = useMemo<ColumnDef<OrganizationUser>[]>(
    () => [
      {
        accessorKey: "name",
        meta: { label: "Name", align: "center" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => <span className="strong">{row.original.name}</span>,
      },
      {
        accessorKey: "email",
        meta: { label: "Email", align: "center" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Email" />
        ),
        cell: ({ row }) => (
          <span className="muted">{row.original.email}</span>
        ),
      },
      {
        accessorKey: "role",
        meta: { label: "Role", align: "center" },
        header: "Role",
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
        enableSorting: false,
      },
      {
        id: "store",
        accessorFn: (row) => row.store?.name ?? "—",
        meta: { label: "Store", align: "center" },
        header: "Store",
        cell: ({ row }) => row.original.store?.name ?? "—",
        enableSorting: false,
      },
      {
        accessorKey: "isActive",
        meta: {
          label: "Status",
          align: "center",
          exportValue: (row: OrganizationUser) =>
            row.isActive ? "Active" : "Inactive",
        },
        header: "Status",
        cell: ({ row }) => <StatusBadge active={row.original.isActive} />,
        enableSorting: false,
      },
      {
        id: "actions",
        meta: { export: false, align: "center" },
        header: "Actions",
        cell: ({ row }) => {
          if (row.original.role !== "admin") return null;
          return (
            <div className="dt-actions">
              <button
                type="button"
                className="dt-act"
                title="Edit"
                onClick={() => onEdit?.(row.original)}
              >
                <Pencil size={16} />
              </button>
              {/* {row.original.isActive ? (
                <button
                  type="button"
                  className="dt-act danger"
                  title="Deactivate"
                  onClick={() => onDeactivate?.(row.original)}
                >
                  <PowerOff size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="dt-act"
                  title="Reactivate"
                  onClick={() => onActivate?.(row.original)}
                >
                  <Power size={16} />
                </button>
              )} */}
            </div>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
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
      onPaginationChange={onPaginationChange}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search name or email…"
      isLoading={isLoading}
      enableRowSelection={false}
      enableExport={false}
      enableColumnVisibility={false}
      getRowId={(row) => row.id}
      emptyTitle="No users found"
      emptyDescription="Try adjusting your search or create an org admin below."
    />
  );
}
