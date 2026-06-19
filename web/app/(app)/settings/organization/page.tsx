"use client";

import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { OrganizationLogoUpload } from "@/components/organization/organization-logo-upload";
import { SESSION_QUERY_KEY, useSession } from "@/hooks/auth/session";
import {
  deleteCurrentOrganizationLogo,
  uploadCurrentOrganizationLogo,
} from "@/service/organizations/logo";

export default function OrganizationSettingsPage() {
  const queryClient = useQueryClient();
  const { user, isLoading } = useSession();

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
  };

  if (isLoading || !user) {
    return <p className="text-muted-foreground">Loading organization…</p>;
  }

  return (
    <>
      <PageHeader
        title="Organization"
        desc="Branding and report settings for your company"
      />

      <div className="max-w-2xl">
        <OrganizationLogoUpload
          scope="current"
          hasLogo={Boolean(user.organizationLogoKey)}
          logoUpdatedAt={user.organizationLogoUpdatedAt}
          onUploaded={refresh}
          onDeleted={refresh}
          uploadLogo={uploadCurrentOrganizationLogo}
          deleteLogo={deleteCurrentOrganizationLogo}
        />
      </div>
    </>
  );
}
