"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { listOrganizations } from "@/service/organizations/organizations";

export default function OrganizationsPage() {
  const [search, setSearch] = useState("");
  const query = useMemo(() => ({ page: 1, limit: 50, search: search || undefined }), [search]);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["organizations", query],
    queryFn: () => listOrganizations(query),
  });

  const rows = data?.data ?? [];

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

      <div className="mb-4">
        <input
          className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Search organizations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isError && (
        <div className="alert-error mb-4">
          {error instanceof Error ? error.message : "Failed to load organizations."}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Stores</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={3}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={3}>
                  No organizations yet.
                </td>
              </tr>
            ) : (
              rows.map((org) => (
                <tr key={org.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link
                      href={`/super-admin/organizations/${org.id}`}
                      className="font-medium hover:underline"
                    >
                      {org.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {org.hasStores ? "Multi-store" : "Direct sales"}
                  </td>
                  <td className="px-4 py-3">
                    {org.isActive ? "Active" : "Inactive"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
