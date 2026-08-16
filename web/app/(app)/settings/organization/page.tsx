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
  const [phone, setPhone] = useState("");
  const [evcNumber, setEvcNumber] = useState("");
  const [edahabNumber, setEdahabNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (!org) return;
    setName(org.name);
    setPhone(org.phone ?? "");
    setEvcNumber(org.evcNumber ?? "");
    setEdahabNumber(org.edahabNumber ?? "");
    setAccountNumber(org.accountNumber ?? "");
    setAddress(org.address ?? "");
  }, [org]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateCurrentOrganization({
        name: name.trim(),
        phone: phone.trim(),
        evcNumber: evcNumber.trim(),
        edahabNumber: edahabNumber.trim(),
        accountNumber: accountNumber.trim(),
        address: address.trim(),
      }),
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

  const settingsDirty =
    org != null &&
    (name.trim() !== org.name ||
      phone.trim() !== (org.phone ?? "") ||
      evcNumber.trim() !== (org.evcNumber ?? "") ||
      edahabNumber.trim() !== (org.edahabNumber ?? "") ||
      accountNumber.trim() !== (org.accountNumber ?? "") ||
      address.trim() !== (org.address ?? ""));

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

            {org.billingEnabled ? (
              <div className="grid gap-4 rounded-md border border-border p-3">
                <p className="text-sm font-medium">
                  Invoice details
                  <span className="ml-2 font-normal text-muted-foreground">
                    shown on customer invoices
                  </span>
                </p>
                <div className="grid gap-2">
                  <label
                    htmlFor="org-phone"
                    className="text-sm font-medium leading-none"
                  >
                    Phone
                  </label>
                  <input
                    id="org-phone"
                    className={inputCls}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Contact phone"
                    disabled={updateMutation.isPending}
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    htmlFor="org-evc-number"
                    className="text-sm font-medium leading-none"
                  >
                    EVC number
                  </label>
                  <input
                    id="org-evc-number"
                    className={inputCls}
                    value={evcNumber}
                    onChange={(e) => setEvcNumber(e.target.value)}
                    placeholder="EVC Plus number customers pay to"
                    disabled={updateMutation.isPending}
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    htmlFor="org-edahab-number"
                    className="text-sm font-medium leading-none"
                  >
                    E-Dahab number
                  </label>
                  <input
                    id="org-edahab-number"
                    className={inputCls}
                    value={edahabNumber}
                    onChange={(e) => setEdahabNumber(e.target.value)}
                    placeholder="E-Dahab number customers pay to"
                    disabled={updateMutation.isPending}
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    htmlFor="org-account-number"
                    className="text-sm font-medium leading-none"
                  >
                    Account/Bank number
                  </label>
                  <input
                    id="org-account-number"
                    className={inputCls}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Bank or account number customers pay to"
                    disabled={updateMutation.isPending}
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    htmlFor="org-address"
                    className="text-sm font-medium leading-none"
                  >
                    Address
                  </label>
                  <input
                    id="org-address"
                    className={inputCls}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Business address"
                    disabled={updateMutation.isPending}
                  />
                </div>
              </div>
            ) : null}

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
