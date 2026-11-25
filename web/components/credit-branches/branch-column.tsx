"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { useViewBranchId } from "@/hooks/branch-view/use-branch-view";
import { ALL_BRANCHES } from "@/lib/branch-scope";

/** True when the page lists every branch together, so each row needs its branch. */
export function useShowBranchColumn(): boolean {
  return useViewBranchId() === ALL_BRANCHES;
}

/** A "Branch" column showing which credit branch a row belongs to. */
export function branchColumn<T>(
  branchName: (row: T) => string | null | undefined,
): ColumnDef<T> {
  return {
    id: "branch",
    accessorFn: (row) => branchName(row) ?? "",
    meta: {
      label: "Branch",
      exportValue: (row: T) => branchName(row) ?? "",
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Branch" />
    ),
    cell: ({ row }) =>
      branchName(row.original) ?? <span className="muted">—</span>,
  };
}
