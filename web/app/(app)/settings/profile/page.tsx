"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { KeyRound, ShieldCheck, Eye, EyeOff, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BackupCodesDisplay } from "@/components/auth/backup-codes-display";
import { useSession } from "@/hooks/auth/session";
import { useUpdateMe } from "@/hooks/auth/use-update-me";
import { useGetTotpUri, useGenerateBackupCodes } from "@/hooks/auth/use-two-factor";
import { appRoleLabel } from "@/lib/types";
import { useAppStore } from "@/store/app";
import { cn } from "@/lib/utils";

const inputCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const readOnlyCls = cn(
  inputCls,
  "cursor-default bg-muted/50 text-muted-foreground",
);

type SecurityModal = "qr" | "backup" | null;

export default function ProfileSettingsPage() {
  const { user, isLoading: sessionLoading } = useSession();
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const updateMe = useUpdateMe();
  const getTotpUri = useGetTotpUri();
  const generateBackupCodes = useGenerateBackupCodes();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [securityModal, setSecurityModal] = useState<SecurityModal>(null);
  const [modalPassword, setModalPassword] = useState("");
  const [showModalPw, setShowModalPw] = useState(false);
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

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

  const closeModal = () => {
    setSecurityModal(null);
    setModalPassword("");
    setShowModalPw(false);
    setTotpURI(null);
    setBackupCodes(null);
    setModalError(null);
  };

  const handleViewQR = async () => {
    if (!modalPassword.trim()) {
      setModalError("Password is required");
      return;
    }
    setModalError(null);
    try {
      const data = await getTotpUri.mutateAsync({ password: modalPassword });
      setTotpURI(data.totpURI);
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "Failed to get QR code");
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!modalPassword.trim()) {
      setModalError("Password is required");
      return;
    }
    setModalError(null);
    try {
      const data = await generateBackupCodes.mutateAsync({ password: modalPassword });
      setBackupCodes(data.backupCodes);
      addToast({ title: "Backup codes regenerated" });
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "Failed to regenerate codes");
    }
  };

  if (sessionLoading || !user) {
    return <p className="text-muted-foreground">Loading profile...</p>;
  }

  const isModalPending = getTotpUri.isPending || generateBackupCodes.isPending;

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
              {updateMe.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </Card>

        <Card title="Security" pad>
          <div className="space-y-5">
            {/* 2FA status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600" />
                <span className="text-sm font-medium">Two-factor authentication</span>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                Active
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Two-factor authentication is required for all accounts and cannot be disabled.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSecurityModal("qr")}
              >
                View QR code
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSecurityModal("backup")}
              >
                Regenerate backup codes
              </Button>
            </div>

            <hr className="border-border" />

            {/* Change password */}
            <p className="text-sm text-muted-foreground">
              Update your password regularly to keep your account secure.
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

      {/* QR code modal */}
      {securityModal === "qr" && (
        <SecurityModalWrapper title="View QR code" onClose={closeModal}>
          {totpURI ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Scan this QR code with your authenticator app to add your account on a new device.
              </p>
              <div className="flex justify-center rounded-md border border-border bg-white p-4">
                <QRCodeSVG value={totpURI} size={200} />
              </div>
              <Button className="w-full" variant="outline" onClick={closeModal}>
                Done
              </Button>
            </div>
          ) : (
            <PasswordPrompt
              error={modalError}
              password={modalPassword}
              showPassword={showModalPw}
              isPending={isModalPending}
              onPasswordChange={(v) => {
                setModalPassword(v);
                setModalError(null);
              }}
              onToggleShow={() => setShowModalPw((s) => !s)}
              onSubmit={() => void handleViewQR()}
              submitLabel="View QR code"
            />
          )}
        </SecurityModalWrapper>
      )}

      {/* Backup codes modal */}
      {securityModal === "backup" && (
        <SecurityModalWrapper title="Regenerate backup codes" onClose={closeModal}>
          {backupCodes ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your old backup codes have been invalidated. Save these new codes in a safe place.
              </p>
              <BackupCodesDisplay codes={backupCodes} />
              <Button className="w-full" variant="outline" onClick={closeModal}>
                Done
              </Button>
            </div>
          ) : (
            <PasswordPrompt
              error={modalError}
              password={modalPassword}
              showPassword={showModalPw}
              isPending={isModalPending}
              onPasswordChange={(v) => {
                setModalPassword(v);
                setModalError(null);
              }}
              onToggleShow={() => setShowModalPw((s) => !s)}
              onSubmit={() => void handleRegenerateBackupCodes()}
              submitLabel="Regenerate codes"
            />
          )}
        </SecurityModalWrapper>
      )}
    </>
  );
}

function SecurityModalWrapper({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="dialog" style={{ zIndex: 200 }}>
      <div className="overlay" onClick={onClose} />
      <div className="dialog-box" style={{ maxWidth: 420 }}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function PasswordPrompt({
  error,
  password,
  showPassword,
  isPending,
  onPasswordChange,
  onToggleShow,
  onSubmit,
  submitLabel,
}: {
  error: string | null;
  password: string;
  showPassword: boolean;
  isPending: boolean;
  onPasswordChange: (v: string) => void;
  onToggleShow: () => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter your current password to continue.
      </p>
      {error && (
        <div
          className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
          role="alert"
        >
          <XCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}
      <div className="relative">
        <input
          className={cn(inputCls, "pr-10")}
          type={showPassword ? "text" : "password"}
          placeholder="Enter your password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
          disabled={isPending}
          autoFocus
          autoComplete="current-password"
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          onClick={onToggleShow}
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <Button className="w-full" onClick={onSubmit} disabled={isPending}>
        {isPending ? "Loading..." : submitLabel}
      </Button>
    </div>
  );
}
