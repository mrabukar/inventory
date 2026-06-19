"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { OrganizationLogoUpload } from "@/components/organization/organization-logo-upload";
import {
  getOrganization,
  updateOrganization,
} from "@/service/organizations/organizations";
import {
  deleteOrganizationLogo,
  uploadOrganizationLogo,
} from "@/service/organizations/logo";
import { useCreateUser } from "@/hooks/users/use-create-user";
import { useAppStore } from "@/store/app";
import { isStrongPassword, STRONG_PASSWORD_MESSAGE } from "@/lib/auth/password";

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

  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const updateMutation = useMutation({
    mutationFn: (input: { hasStores?: boolean; isActive?: boolean; name?: string }) =>
      updateOrganization(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      addToast({ title: "Organization updated" });
    },
    onError: (error: Error) => {
      addErrorToast({ title: "Update failed", sub: error.message });
    },
  });

  const createAdmin = useCreateUser(id);

  if (isPending || !org) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  return (
    <>
      <PageHeader title={org.name} desc="Organization settings and users" />

      <div className="mb-8 grid gap-4 max-w-xl">
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

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={org.hasStores}
            onCheckedChange={(value) =>
              updateMutation.mutate({ hasStores: value === true })
            }
          />
          Uses stores and branch managers
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={org.isActive}
            onCheckedChange={(value) =>
              updateMutation.mutate({ isActive: value === true })
            }
          />
          Active
        </label>
        <p className="text-sm text-muted-foreground">
          {org._count.users} user(s) · {org._count.stores} store(s)
        </p>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Users</h2>
      <div className="mb-8 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {org.users.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={3}>
                  No users yet.
                </td>
              </tr>
            ) : (
              org.users.map((user) => (
                <tr key={user.id} className="border-t border-border">
                  <td className="px-4 py-3">{user.name}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">{user.role}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Create org admin</h2>
      <form
        className="max-w-lg space-y-4"
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
          } catch (error) {
            addErrorToast({
              title: "Failed to create admin",
              sub: error instanceof Error ? error.message : undefined,
            });
          }
        }}
      >
        <input
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Admin name"
          value={adminName}
          onChange={(e) => setAdminName(e.target.value)}
          required
        />
        <input
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Admin email"
          type="email"
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          required
        />
        <input
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Password"
          type="password"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          required
        />
        <Button type="submit" disabled={createAdmin.isPending}>
          {createAdmin.isPending ? "Creating…" : "Create admin"}
        </Button>
      </form>
    </>
  );
}
