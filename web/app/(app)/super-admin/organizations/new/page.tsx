"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { createOrganization } from "@/service/organizations/organizations";
import { uploadOrganizationLogo } from "@/service/organizations/logo";
import { useAppStore } from "@/store/app";

export default function NewOrganizationPage() {
  const router = useRouter();
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const [name, setName] = useState("");
  const [hasStores, setHasStores] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

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
        desc="Create a tenant organization, then add its admin user from the org detail page."
      />

      <form
        className="max-w-lg space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          mutation.mutate();
        }}
      >
        <div className="grid gap-2">
          <label className="text-sm font-medium">Organization name</label>
          <input
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={hasStores}
            onCheckedChange={(value) => setHasStores(value === true)}
          />
          This organization uses stores and branch managers
        </label>

        <div className="grid gap-2">
          <label className="text-sm font-medium">Report logo (optional)</label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => logoInputRef.current?.click()}
            >
              {logoFile ? "Change logo" : "Choose logo"}
            </Button>
            {logoFile ? (
              <span className="text-sm text-muted-foreground">{logoFile.name}</span>
            ) : null}
          </div>
        </div>

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating…" : "Create organization"}
        </Button>
      </form>
    </>
  );
}
