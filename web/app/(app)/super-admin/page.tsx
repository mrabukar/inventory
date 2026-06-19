"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Building2, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { getPlatformStats } from "@/service/organizations/organizations";

export default function SuperAdminDashboardPage() {
  const { data, isPending } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: getPlatformStats,
  });

  return (
    <>
      <PageHeader
        title="Platform"
        desc="Manage organizations and platform-wide settings"
        action={
          <Button asChild>
            <Link href="/super-admin/organizations/new">New organization</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <Building2 className="size-4" />
            <span className="text-sm font-medium">Organizations</span>
          </div>
          <p className="text-3xl font-semibold">
            {isPending ? "—" : (data?.organizationCount ?? 0)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <Users className="size-4" />
            <span className="text-sm font-medium">Tenant users</span>
          </div>
          <p className="text-3xl font-semibold">
            {isPending ? "—" : (data?.userCount ?? 0)}
          </p>
        </div>
      </div>
    </>
  );
}
