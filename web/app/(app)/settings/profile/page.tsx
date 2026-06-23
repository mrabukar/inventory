"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/hooks/auth/session";
import { useUpdateMe } from "@/hooks/auth/use-update-me";
import { appRoleLabel } from "@/lib/types";
import { useAppStore } from "@/store/app";
import { cn } from "@/lib/utils";

const inputCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const readOnlyCls = cn(
  inputCls,
  "cursor-default bg-muted/50 text-muted-foreground",
);

export default function ProfileSettingsPage() {
  const { user, isLoading: sessionLoading } = useSession();
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const updateMe = useUpdateMe();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPhone(user.phone ?? "");
  }, [user]);

  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  const profileDirty =
    user != null &&
    (trimmedName !== user.name || trimmedPhone !== (user.phone ?? ""));

  const handleSave = () => {
    if (!trimmedName) {
      addErrorToast({ title: "Name is required" });
      return;
    }

    updateMe.mutate(
      {
        name: trimmedName,
        phone: trimmedPhone || null,
      },
      {
        onSuccess: () => {
          addToast({ title: "Profile updated" });
        },
        onError: (error: Error) => {
          addErrorToast({ title: "Update failed", sub: error.message });
        },
      },
    );
  };

  if (sessionLoading || !user) {
    return <p className="text-muted-foreground">Loading profile…</p>;
  }

  return (
    <>
      <PageHeader
        title="Profile"
        desc="Update your name and phone number"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Personal information" pad>
          <div className="space-y-4">
            <div className="grid gap-2">
              <label htmlFor="profile-name" className="text-sm font-medium leading-none">
                Name
              </label>
              <input
                id="profile-name"
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={updateMe.isPending}
                autoComplete="name"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="profile-email" className="text-sm font-medium leading-none">
                Email
              </label>
              <input
                id="profile-email"
                type="email"
                className={readOnlyCls}
                value={user.email}
                readOnly
                disabled
                tabIndex={-1}
              />
              {/* <p className="text-xs text-muted-foreground">
                Contact an administrator to change your email.
              </p> */}
            </div>

            <div className="grid gap-2">
              <label htmlFor="profile-phone" className="text-sm font-medium leading-none">
                Phone <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <input
                id="profile-phone"
                type="tel"
                className={inputCls}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={updateMe.isPending}
                autoComplete="tel"
              />
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium leading-none">Role</span>
              <input
                className={readOnlyCls}
                value={appRoleLabel(user.role)}
                readOnly
                disabled
                tabIndex={-1}
              />
            </div>

            <Button
              type="button"
              disabled={updateMe.isPending || !profileDirty || !trimmedName}
              onClick={handleSave}
            >
              {updateMe.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </Card>

        <Card title="Security" pad>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Update your password regularly to keep your account secure. You will
              need your current password to set a new one.
            </p>
            <Button type="button" variant="outline" asChild>
              <Link href="/settings/password">
                <KeyRound className="size-4" />
                Change password
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
