"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, Plus } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { listOrganizations } from "@/service/organizations/organizations";
import type { Organization } from "@/types/organizations/organization";

export default function OrganizationsPage() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const listQuery = useMemo(
    () => ({
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
    }),
    [pageIndex, pageSize, debouncedSearch],
  );

  const { data, isPending, isFetching, isError, error } = useQuery({
    queryKey: ["organizations", listQuery],
    queryFn: () => listOrganizations(listQuery),
  });

  const isLoading =
    isPending || (isFetching && (data?.data.length ?? 0) === 0);
  const organizations = data?.data ?? [];
  const rowCount = data?.meta.total ?? 0;

  const columns = useMemo<ColumnDef<Organization>[]>(
    () => [
      {
        accessorKey: "name",
        meta: { label: "Name", align: "center" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <Link
            href={`/super-admin/organizations/${row.original.id}`}
            className="strong hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "hasStores",
        meta: {
          label: "Stores",
          align: "center",
          exportValue: (row: Organization) =>
            row.hasStores ? "Multi-store" : "Direct sales",
        },
        header: "Stores",
        cell: ({ row }) =>
          row.original.hasStores ? "Multi-store" : "Direct sales",
        enableSorting: false,
      },
      {
        accessorKey: "isActive",
        meta: {
          label: "Status",
          align: "center",
          exportValue: (row: Organization) =>
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
        cell: ({ row }) => (
          <div className="dt-actions">
            <Link
              href={`/super-admin/organizations/${row.original.id}`}
              className="dt-act"
              title="Manage"
            >
              <ArrowRight size={16} />
            </Link>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Organizations"
        desc="All tenant organizations on the platform"
        action={
          <Button asChild>
            <Link href="/super-admin/organizations/new">
              <Plus className="size-4" />
              New organization
            </Link>
          </Button>
        }
      />

      {isError && (
        <div className="alert-error mb-4">
          {error instanceof Error ? error.message : "Failed to load organizations."}
        </div>
      )}

      <DataTable
        columns={columns}
        data={organizations}
        rowCount={rowCount}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPaginationChange={({ pageIndex: nextPage, pageSize: nextSize }) => {
          setPageIndex(nextPage);
          setPageSize(nextSize);
        }}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPageIndex(0);
        }}
        searchPlaceholder="Search organizations…"
        isLoading={isLoading}
        enableRowSelection={false}
        enableExport={false}
        getRowId={(row) => row.id}
        emptyTitle="No organizations found"
        emptyDescription="Try adjusting your search or create a new organization."
      />
    </>
  );
}
