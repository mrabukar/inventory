"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { KeyRound, ShieldCheck, ShieldOff, Eye, EyeOff, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BackupCodesDisplay } from "@/components/auth/backup-codes-display";
import { useSession } from "@/hooks/auth/session";
import { useUpdateMe } from "@/hooks/auth/use-update-me";
import { useDisableOwnTwoFactor } from "@/hooks/auth/use-disable-own-two-factor";
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

type SecurityModal = "qr" | "backup" | "disable" | null;

export default function ProfileSettingsPage() {
  const { user, isLoading: sessionLoading } = useSession();
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const updateMe = useUpdateMe();
  const getTotpUri = useGetTotpUri();
  const generateBackupCodes = useGenerateBackupCodes();
  const disableOwn = useDisableOwnTwoFactor();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [securityModal, setSecurityModal] = useState<SecurityModal>(null);
  const [modalPassword, setModalPassword] = useState("");
  const [showModalPw, setShowModalPw] = useState(false);
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalCode, setModalCode] = useState("");

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
    setModalCode("");
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

  const handleDisableOwn = async () => {
    if (!modalPassword.trim()) {
      setModalError("Enter your password");
      return;
    }
    if (!/^\d{6}$/.test(modalCode)) {
      setModalError("Enter the 6-digit code from your authenticator app");
      return;
    }
    setModalError(null);
    try {
      await disableOwn.mutateAsync({ password: modalPassword, code: modalCode });
      addToast({
        title: "Two-factor turned off",
        sub: "You'll sign in with only your password.",
      });
      closeModal();
    } catch (error) {
      setModalError(
        error instanceof Error ? error.message : "Couldn't turn off two-factor",
      );
    }
  };

  if (sessionLoading || !user) {
    return <p className="text-muted-foreground">Loading profile...</p>;
  }

  const isModalPending = getTotpUri.isPending || generateBackupCodes.isPending;
  const twoFactorOn = user.twoFactorEnabled;
  const canTurnOff = twoFactorOn && user.role === "admin";

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
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {twoFactorOn ? (
                  <ShieldCheck className="size-4 text-emerald-600" aria-hidden />
                ) : (
                  <ShieldOff className="size-4 text-muted-foreground" aria-hidden />
                )}
                <span className="text-sm font-medium">Two-factor sign-in</span>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  twoFactorOn
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {twoFactorOn ? "On" : "Off"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {twoFactorOn
                ? "You sign in with your password and a 6-digit code from your authenticator app."
                : "You sign in with only your password. Adding an authenticator app means a stolen password alone can't open your account."}
            </p>

            {twoFactorOn ? (
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
                {canTurnOff ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setSecurityModal("disable")}
                  >
                    Turn off
                  </Button>
                ) : null}
              </div>
            ) : (
              <Button type="button" size="sm" asChild>
                <Link href="/setup-2fa">
                  <ShieldCheck className="size-4" />
                  Set up two-factor
                </Link>
              </Button>
            )}

            {twoFactorOn && !canTurnOff ? (
              <p className="text-xs text-muted-foreground">
                To turn off two-factor sign-in, ask an admin.
              </p>
            ) : null}

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

      {/* Turn off own 2FA (admins) */}
      {securityModal === "disable" && (
        <SecurityModalWrapper title="Turn off two-factor sign-in" onClose={closeModal}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              After this you&apos;ll sign in with only your password. Confirm
              it&apos;s you with your password and a current code.
            </p>
            {modalError && (
              <div
                className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
                role="alert"
              >
                <XCircle className="size-4 shrink-0" />
                {modalError}
              </div>
            )}
            <div className="grid gap-2">
              <label htmlFor="disable-2fa-password" className="text-sm font-medium leading-none">
                Password
              </label>
              <div className="relative">
                <input
                  id="disable-2fa-password"
                  className={cn(inputCls, "pr-10")}
                  type={showModalPw ? "text" : "password"}
                  value={modalPassword}
                  onChange={(e) => {
                    setModalPassword(e.target.value);
                    setModalError(null);
                  }}
                  disabled={disableOwn.isPending}
                  autoFocus
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setShowModalPw((s) => !s)}
                  tabIndex={-1}
                  aria-label={showModalPw ? "Hide password" : "Show password"}
                >
                  {showModalPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              <label htmlFor="disable-2fa-code" className="text-sm font-medium leading-none">
                Authenticator code
              </label>
              <input
                id="disable-2fa-code"
                className={cn(inputCls, "font-mono tracking-[0.3em]")}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={modalCode}
                onChange={(e) => {
                  setModalCode(e.target.value.replace(/\D/g, ""));
                  setModalError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleDisableOwn();
                }}
                disabled={disableOwn.isPending}
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={closeModal}
                disabled={disableOwn.isPending}
              >
                Keep it on
              </Button>
              <Button
                className="flex-1"
                variant="destructive"
                onClick={() => void handleDisableOwn()}
                disabled={disableOwn.isPending}
              >
                {disableOwn.isPending ? "Turning off…" : "Turn off"}
              </Button>
            </div>
          </div>
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
