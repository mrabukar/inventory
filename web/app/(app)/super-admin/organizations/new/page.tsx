"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { createOrganization } from "@/service/organizations/organizations";
import { useAppStore } from "@/store/app";

export default function NewOrganizationPage() {
  const router = useRouter();
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const [name, setName] = useState("");
  const [hasStores, setHasStores] = useState(true);

  const mutation = useMutation({
    mutationFn: createOrganization,
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
          mutation.mutate({ name: name.trim(), hasStores });
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

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating…" : "Create organization"}
        </Button>
      </form>
    </>
  );
}
