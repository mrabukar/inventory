"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { OrganizationLogoUpload } from "@/components/organization/organization-logo-upload";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCreateUser } from "@/hooks/users/use-create-user";
import {
  getOrganization,
  listOrganizationUsers,
  updateOrganization,
} from "@/service/organizations/organizations";
import {
  deleteOrganizationLogo,
  uploadOrganizationLogo,
} from "@/service/organizations/logo";
import { useAppStore } from "@/store/app";
import { isStrongPassword, STRONG_PASSWORD_MESSAGE } from "@/lib/auth/password";

import { OrganizationUsersTable } from "./components/organization-users-table";

const inputCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export default function OrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);

  const { data: org, isPending } = useQuery({
    queryKey: ["organizations", id],
    queryFn: () => getOrganization(id),
    enabled: Boolean(id),
  });

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [usersSearch, setUsersSearch] = useState("");
  const debouncedUsersSearch = useDebouncedValue(usersSearch, 300);

  const usersQuery = useMemo(
    () => ({
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedUsersSearch || undefined,
    }),
    [pageIndex, pageSize, debouncedUsersSearch],
  );

  const {
    data: usersData,
    isPending: usersPending,
    isFetching: usersFetching,
  } = useQuery({
    queryKey: ["organizations", id, "users", usersQuery],
    queryFn: () => listOrganizationUsers(id, usersQuery),
    enabled: Boolean(id),
  });

  const usersLoading =
    usersPending || (usersFetching && (usersData?.data.length ?? 0) === 0);

  const [name, setName] = useState("");
  const [hasStores, setHasStores] = useState(true);
  const [isActive, setIsActive] = useState(true);

  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    if (!org) return;
    setName(org.name);
    setHasStores(org.hasStores);
    setIsActive(org.isActive);
  }, [org]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateOrganization(id, {
        name: name.trim(),
        hasStores,
        isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      addToast({ title: "Organization updated" });
    },
    onError: (error: Error) => {
      addErrorToast({ title: "Update failed", sub: error.message });
    },
  });

  const createAdmin = useCreateUser(id);

  const settingsDirty =
    org != null &&
    (name.trim() !== org.name ||
      hasStores !== org.hasStores ||
      isActive !== org.isActive);

  if (isPending || !org) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  return (
    <>
      <PageHeader title={org.name} desc="Organization settings and users" />

      <div className="mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/super-admin/organizations">
            <ArrowLeft className="size-4" />
            Back to organizations
          </Link>
        </Button>
      </div>

      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="General settings" pad>
            <div className="space-y-4">
              <div className="grid gap-2">
                <label htmlFor="org-name" className="text-sm font-medium leading-none">
                  Organization name
                </label>
                <input
                  id="org-name"
                  className={inputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={updateMutation.isPending}
                />
              </div>

              <label className="flex items-start gap-3 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={hasStores}
                  disabled={updateMutation.isPending}
                  onCheckedChange={(value) => setHasStores(value === true)}
                />
                <span>
                  <span className="font-medium">Uses stores and branch managers</span>
                  <span className="mt-1 block text-muted-foreground">
                    Direct-sales organizations can disable store-based workflows.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={isActive}
                  disabled={updateMutation.isPending}
                  onCheckedChange={(value) => setIsActive(value === true)}
                />
                <span>
                  <span className="font-medium">Active</span>
                  <span className="mt-1 block text-muted-foreground">
                    Inactive organizations cannot sign in or operate.
                  </span>
                </span>
              </label>

              <p className="text-sm text-muted-foreground">
                {org._count.users} user(s) · {org._count.stores} store(s)
              </p>

              <Button
                type="button"
                disabled={
                  updateMutation.isPending || !name.trim() || !settingsDirty
                }
                onClick={() => updateMutation.mutate()}
              >
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </Card>

          <OrganizationLogoUpload
            scope="organization"
            organizationId={org.id}
            hasLogo={Boolean(org.logoKey)}
            logoUpdatedAt={org.logoUpdatedAt}
            onUploaded={() =>
              queryClient.invalidateQueries({ queryKey: ["organizations", id] })
            }
            onDeleted={() =>
              queryClient.invalidateQueries({ queryKey: ["organizations", id] })
            }
            uploadLogo={(file) => uploadOrganizationLogo(org.id, file)}
            deleteLogo={() => deleteOrganizationLogo(org.id)}
          />
        </div>

        <Card title="Users" pad>
          <OrganizationUsersTable
            rows={usersData?.data ?? []}
            rowCount={usersData?.meta.total ?? 0}
            pageIndex={pageIndex}
            pageSize={pageSize}
            searchValue={usersSearch}
            onSearchChange={(value) => {
              setUsersSearch(value);
              setPageIndex(0);
            }}
            onPaginationChange={({ pageIndex: nextPage, pageSize: nextSize }) => {
              setPageIndex(nextPage);
              setPageSize(nextSize);
            }}
            isLoading={usersLoading}
          />
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Create org admin" pad className="max-w-xl">
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!isStrongPassword(adminPassword)) {
                  addErrorToast({ title: STRONG_PASSWORD_MESSAGE });
                  return;
                }
                try {
                  await createAdmin.mutateAsync({
                    name: adminName.trim(),
                    email: adminEmail.trim(),
                    password: adminPassword,
                    role: "admin",
                  });
                  addToast({ title: "Admin user created" });
                  setAdminName("");
                  setAdminEmail("");
                  setAdminPassword("");
                  queryClient.invalidateQueries({ queryKey: ["organizations", id] });
                  queryClient.invalidateQueries({
                    queryKey: ["organizations", id, "users"],
                  });
                } catch (error) {
                  addErrorToast({
                    title: "Failed to create admin",
                    sub: error instanceof Error ? error.message : undefined,
                  });
                }
              }}
            >
              <div className="grid gap-2">
                <label htmlFor="admin-name" className="text-sm font-medium leading-none">
                  Admin name <span className="text-destructive">*</span>
                </label>
                <input
                  id="admin-name"
                  className={inputCls}
                  placeholder="Jane Admin"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required
                  disabled={createAdmin.isPending}
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="admin-email" className="text-sm font-medium leading-none">
                  Admin email <span className="text-destructive">*</span>
                </label>
                <input
                  id="admin-email"
                  className={inputCls}
                  placeholder="admin@company.com"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                  disabled={createAdmin.isPending}
                />
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="admin-password"
                  className="text-sm font-medium leading-none"
                >
                  Password <span className="text-destructive">*</span>
                </label>
                <input
                  id="admin-password"
                  className={inputCls}
                  placeholder="Strong password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  disabled={createAdmin.isPending}
                />
                <p className="text-sm text-muted-foreground">
                  {STRONG_PASSWORD_MESSAGE}
                </p>
              </div>

              <Button type="submit" disabled={createAdmin.isPending}>
                {createAdmin.isPending ? "Creating…" : "Create admin"}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
