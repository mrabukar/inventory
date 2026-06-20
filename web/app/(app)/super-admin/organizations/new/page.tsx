"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { OrganizationLogoPicker } from "@/components/organization/organization-logo-picker";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { createOrganization } from "@/service/organizations/organizations";
import { uploadOrganizationLogo } from "@/service/organizations/logo";
import { useAppStore } from "@/store/app";

const inputCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export default function NewOrganizationPage() {
  const router = useRouter();
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const [name, setName] = useState("");
  const [hasStores, setHasStores] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const org = await createOrganization({ name: name.trim(), hasStores });
      if (logoFile) {
        await uploadOrganizationLogo(org.id, logoFile);
      }
      return org;
    },
    onSuccess: (org) => {
      addToast({ title: "Organization created" });
      router.push(`/super-admin/organizations/${org.id}`);
    },
    onError: (error: Error) => {
      addErrorToast({ title: "Failed to create organization", sub: error.message });
    },
  });

  return (
    <>
      <PageHeader
        title="New organization"
        desc="Create a tenant organization, then add its admin user from the detail page."
      />

      <div className="mb-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/super-admin/organizations">
            <ArrowLeft className="size-4" />
            Back to organizations
          </Link>
        </Button>
      </div>

      <form
        className="max-w-2xl space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          mutation.mutate();
        }}
      >
        <Card title="Organization details" pad>
          <div className="space-y-4">
            <div className="grid gap-2">
              <label htmlFor="org-name" className="text-sm font-medium leading-none">
                Organization name <span className="text-destructive">*</span>
              </label>
              <input
                id="org-name"
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Retail"
                required
                disabled={mutation.isPending}
              />
              <p className="text-sm text-muted-foreground">
                This name appears in the app and on exported reports.
              </p>
            </div>

            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={hasStores}
                disabled={mutation.isPending}
                onCheckedChange={(value) => setHasStores(value === true)}
              />
              <span>
                <span className="font-medium">Uses stores and branch managers</span>
                <span className="mt-1 block text-muted-foreground">
                  Turn off for direct-sales organizations without store locations or
                  branch managers.
                </span>
              </span>
            </label>
          </div>
        </Card>

        <Card title="Report branding" pad>
          <OrganizationLogoPicker
            value={logoFile}
            onChange={setLogoFile}
            disabled={mutation.isPending}
          />
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={mutation.isPending || !name.trim()}>
            {mutation.isPending ? "Creating…" : "Create organization"}
          </Button>
          <Button type="button" variant="outline" asChild disabled={mutation.isPending}>
            <Link href="/super-admin/organizations">Cancel</Link>
          </Button>
        </div>
      </form>
    </>
  );
}
