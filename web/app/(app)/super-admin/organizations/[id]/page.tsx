"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

import { OrganizationLogoUpload } from "@/components/organization/organization-logo-upload";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
// import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
// import { useActivateOrganizationUser } from "@/hooks/organizations/use-activate-organization-user";
// import { useDeactivateOrganizationUser } from "@/hooks/organizations/use-deactivate-organization-user";
import { useUpdateOrganizationUser } from "@/hooks/organizations/use-update-organization-user";
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
import { cn } from "@/lib/utils";
import type { OrganizationUser } from "@/types/organizations/organization";
import type { User } from "@/types/users/user";
import {
  UserModal,
  type UserFormValues,
} from "@/app/(app)/users/components/user-modal";

import { OrganizationUsersTable } from "./components/organization-users-table";

const inputCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

function toUserModalUser(user: OrganizationUser): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: "admin",
    phone: user.phone,
    isActive: user.isActive,
    storeId: user.store?.id ?? null,
    store: user.store,
    createdAt: "",
    updatedAt: "",
  };
}

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
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showAdminConfirmPassword, setShowAdminConfirmPassword] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [editUser, setEditUser] = useState<OrganizationUser | null>(null);
  // const [confirmDeactivate, setConfirmDeactivate] =
  //   useState<OrganizationUser | null>(null);

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
      if (org) {
        setName(org.name);
        setHasStores(org.hasStores);
        setIsActive(org.isActive);
      }
    },
  });

  const createAdmin = useCreateUser(id);
  const updateOrgUser = useUpdateOrganizationUser(id);
  // const deactivateOrgUser = useDeactivateOrganizationUser(id);
  // const activateOrgUser = useActivateOrganizationUser(id);

  const settingsDirty =
    org != null &&
    (name.trim() !== org.name ||
      hasStores !== org.hasStores ||
      isActive !== org.isActive);

  if (isPending || !org) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  const saveOrgAdmin = async (form: UserFormValues) => {
    if (!editUser) return;
    try {
      const input: Parameters<typeof updateOrgUser.mutateAsync>[0]["input"] = {
        name: form.name,
        email: form.email,
        phone: form.phone || null,
      };
      if (form.password) input.password = form.password;

      await updateOrgUser.mutateAsync({ userId: editUser.id, input });
      addToast({ title: "Admin user updated" });
      setEditUser(null);
    } catch (error) {
      addErrorToast({
        title: "Failed to update admin",
        sub: error instanceof Error ? error.message : undefined,
      });
    }
  };

  // const handleDeactivate = async () => {
  //   if (!confirmDeactivate) return;
  //   try {
  //     await deactivateOrgUser.mutateAsync(confirmDeactivate.id);
  //     addToast({ title: "Admin user deactivated" });
  //     setConfirmDeactivate(null);
  //   } catch (error) {
  //     addErrorToast({
  //       title: "Failed to deactivate admin",
  //       sub: error instanceof Error ? error.message : undefined,
  //     });
  //   }
  // };

  // const handleActivate = async (user: OrganizationUser) => {
  //   try {
  //     await activateOrgUser.mutateAsync(user.id);
  //     addToast({ title: "Admin user reactivated" });
  //   } catch (error) {
  //     addErrorToast({
  //       title: "Failed to reactivate admin",
  //       sub: error instanceof Error ? error.message : undefined,
  //     });
  //   }
  // };

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
            onEdit={(user) => setEditUser(user)}
            // onDeactivate={(user) => setConfirmDeactivate(user)}
            // onActivate={(user) => void handleActivate(user)}
          />
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Create org admin" pad className="max-w-xl">
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (adminPassword !== adminConfirmPassword) {
                  setPasswordMismatch(true);
                  addErrorToast({ title: "Passwords do not match" });
                  return;
                }
                if (!isStrongPassword(adminPassword)) {
                  addErrorToast({ title: STRONG_PASSWORD_MESSAGE });
                  return;
                }
                setPasswordMismatch(false);
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
                  setAdminConfirmPassword("");
                  setShowAdminPassword(false);
                  setShowAdminConfirmPassword(false);
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
                <div className="relative">
                  <input
                    id="admin-password"
                    className={cn(inputCls, "pr-10")}
                    placeholder="Strong password"
                    type={showAdminPassword ? "text" : "password"}
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      setPasswordMismatch(false);
                    }}
                    required
                    disabled={createAdmin.isPending}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowAdminPassword((show) => !show)}
                    tabIndex={-1}
                    aria-label={showAdminPassword ? "Hide password" : "Show password"}
                  >
                    {showAdminPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {STRONG_PASSWORD_MESSAGE}
                </p>
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="admin-confirm-password"
                  className="text-sm font-medium leading-none"
                >
                  Confirm password <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <input
                    id="admin-confirm-password"
                    className={cn(inputCls, "pr-10")}
                    placeholder="Re-enter password"
                    type={showAdminConfirmPassword ? "text" : "password"}
                    value={adminConfirmPassword}
                    onChange={(e) => {
                      setAdminConfirmPassword(e.target.value);
                      setPasswordMismatch(false);
                    }}
                    required
                    disabled={createAdmin.isPending}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowAdminConfirmPassword((show) => !show)}
                    tabIndex={-1}
                    aria-label={
                      showAdminConfirmPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showAdminConfirmPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                {passwordMismatch ? (
                  <p className="text-sm text-destructive">Passwords do not match.</p>
                ) : null}
              </div>

              <Button type="submit" disabled={createAdmin.isPending}>
                {createAdmin.isPending ? "Creating…" : "Create admin"}
              </Button>
            </form>
          </Card>
        </div>
      </div>

      {editUser ? (
        <UserModal
          key={editUser.id}
          open
          mode="edit"
          user={toUserModalUser(editUser)}
          storeItems={[]}
          showStoreField={false}
          hideRoleField
          withPasswordConfirm
          onClose={() => setEditUser(null)}
          onSave={(form) => void saveOrgAdmin(form)}
          isSaving={updateOrgUser.isPending}
        />
      ) : null}

      {/* {confirmDeactivate ? (
        <ConfirmDialog
          title="Deactivate admin?"
          message={`Deactivate ${confirmDeactivate.name}? They will no longer be able to sign in.`}
          confirmLabel="Deactivate"
          variant="danger"
          isLoading={deactivateOrgUser.isPending}
          onConfirm={() => void handleDeactivate()}
          onClose={() => setConfirmDeactivate(null)}
        />
      ) : null} */}
    </>
  );
}
