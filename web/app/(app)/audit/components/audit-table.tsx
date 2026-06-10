"use client";

import { useMemo } from "react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Eye } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge, RoleBadge } from "@/components/ui/badge";
import {
  auditActionColor,
  formatAuditEntity,
  formatAuditTimestamp,
  type AuditLog,
} from "@/types/audit/audit-log";

interface AuditTableProps {
  rows: AuditLog[];
  rowCount: number;
  pageIndex: number;
  pageSize: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onPaginationChange: (state: PaginationState) => void;
  isLoading?: boolean;
  onExportAll?: () => Promise<AuditLog[]>;
  onView: (log: AuditLog) => void;
  toolbarExtra?: React.ReactNode;
}

export function AuditTable({
  rows,
  rowCount,
  pageIndex,
  pageSize,
  searchValue,
  onSearchChange,
  onPaginationChange,
  isLoading = false,
  onExportAll,
  onView,
  toolbarExtra,
}: AuditTableProps) {
  const columns = useMemo<ColumnDef<AuditLog>[]>(
    () => [
      {
        accessorKey: "createdAt",
        meta: {
          label: "Timestamp",
          exportValue: (row: AuditLog) => formatAuditTimestamp(row.createdAt),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Timestamp" />
        ),
        cell: ({ row }) => (
          <span className="muted" style={{ fontSize: 13 }}>
            {formatAuditTimestamp(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "user",
        accessorFn: (row) => row.user.name,
        meta: {
          label: "User",
          exportValue: (row: AuditLog) => row.user.name,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="User" />
        ),
        cell: ({ row }) => (
          <>
            <span className="strong">{row.original.user.name}</span>
            &nbsp;
            <RoleBadge role={row.original.user.role} />
          </>
        ),
      },
      {
        accessorKey: "action",
        meta: {
          label: "Action",
          exportValue: (row: AuditLog) => row.action,
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Action" />
        ),
        cell: ({ row }) => (
          <Badge color={auditActionColor(row.original.action) as never}>
            {row.original.action}
          </Badge>
        ),
      },
      {
        id: "entity",
        accessorFn: (row) => formatAuditEntity(row),
        meta: {
          label: "Entity",
          exportValue: (row: AuditLog) => formatAuditEntity(row),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Entity" />
        ),
        cell: ({ row }) => (
          <span className="num muted" style={{ fontSize: 13 }}>
            {formatAuditEntity(row.original)}
          </span>
        ),
      },
      {
        id: "actions",
        meta: { export: false, align: "center" },
        header: "Detail",
        cell: ({ row }) => (
          <div className="dt-actions">
            <button
              type="button"
              className="dt-act"
              title="View details"
              onClick={() => onView(row.original)}
            >
              <Eye size={16} />
            </button>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [onView],
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
      searchPlaceholder="Search by user name or email…"
      isLoading={isLoading}
      exportFileName="audit-log"
      onExportAll={onExportAll}
      getRowId={(row) => row.id}
      toolbarExtra={toolbarExtra}
      emptyTitle="No audit entries found"
      emptyDescription="Try adjusting your date range or filters."
    />
  );
}
