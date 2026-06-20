"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { OrganizationLogoUpload } from "@/components/organization/organization-logo-upload";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { SESSION_QUERY_KEY, useSession } from "@/hooks/auth/session";
import {
  deleteCurrentOrganizationLogo,
  uploadCurrentOrganizationLogo,
} from "@/service/organizations/logo";
import {
  getCurrentOrganization,
  updateCurrentOrganization,
} from "@/service/organizations/organizations";
import { useAppStore } from "@/store/app";

const inputCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export default function OrganizationSettingsPage() {
  const queryClient = useQueryClient();
  const { user, isLoading: sessionLoading } = useSession();
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);

  const { data: org, isPending } = useQuery({
    queryKey: ["organization", "current"],
    queryFn: getCurrentOrganization,
    enabled: Boolean(user),
  });

  const [name, setName] = useState("");

  useEffect(() => {
    if (!org) return;
    setName(org.name);
  }, [org]);

  const updateMutation = useMutation({
    mutationFn: () => updateCurrentOrganization({ name: name.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["organization", "current"] });
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      addToast({ title: "Organization updated" });
    },
    onError: (error: Error) => {
      addErrorToast({ title: "Update failed", sub: error.message });
    },
  });

  const refreshLogo = () => {
    void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ["organization", "current"] });
  };

  const settingsDirty = org != null && name.trim() !== org.name;

  if (sessionLoading || !user || isPending || !org) {
    return <p className="text-muted-foreground">Loading organization…</p>;
  }

  return (
    <>
      <PageHeader
        title="Organization"
        desc="Branding and report settings for your company"
      />

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

            <div className="grid gap-2">
              <span className="text-sm font-medium leading-none">
                Organization type
              </span>
              <p className="text-sm text-muted-foreground">
                {org.hasStores ? "Multi-store" : "Direct sales"}
              </p>
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium leading-none">Status</span>
              <div>
                <StatusBadge active={org.isActive} />
              </div>
            </div>

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
          scope="current"
          hasLogo={Boolean(user.organizationLogoKey ?? org.logoKey)}
          logoUpdatedAt={user.organizationLogoUpdatedAt ?? org.logoUpdatedAt}
          onUploaded={refreshLogo}
          onDeleted={refreshLogo}
          uploadLogo={uploadCurrentOrganizationLogo}
          deleteLogo={deleteCurrentOrganizationLogo}
        />
      </div>
    </>
  );
}
