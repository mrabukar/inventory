"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useChangePassword } from "@/hooks/auth/use-change-password";
import { isCurrentPasswordError } from "@/lib/auth/auth-error";
import { isStrongPassword, STRONG_PASSWORD_MESSAGE } from "@/lib/auth/password";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app";

const inputCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  disabled,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggleShow: () => void;
  disabled?: boolean;
  error?: string;
  autoComplete?: string;
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium leading-none">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className={cn(inputCls, "pr-10", error && "border-destructive")}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          onClick={onToggleShow}
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const changePassword = useChangePassword();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<{
    current?: string;
    new?: string;
    confirm?: string;
  }>({});

  const validate = (): boolean => {
    const next: typeof errors = {};

    if (!currentPassword) {
      next.current = "Current password is required";
    }
    if (!newPassword) {
      next.new = "New password is required";
    } else if (newPassword.length < 8) {
      next.new = "Password must be at least 8 characters";
    } else if (!isStrongPassword(newPassword)) {
      next.new = STRONG_PASSWORD_MESSAGE;
    } else if (newPassword === currentPassword) {
      next.new = "New password must be different from your current password";
    }
    if (!confirmPassword) {
      next.confirm = "Please confirm your new password";
    } else if (confirmPassword !== newPassword) {
      next.confirm = "Passwords do not match";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          addToast({
            title: "Password changed",
            sub: "Sign in again with your new password.",
          });
          router.replace("/login");
        },
        onError: (error: Error) => {
          const message =
            error.message.trim() || "Failed to change password.";
          if (isCurrentPasswordError(message)) {
            setErrors((prev) => ({ ...prev, current: message }));
          } else if (/password must contain|uppercase|special character/i.test(message)) {
            setErrors((prev) => ({ ...prev, new: message }));
          }
          addErrorToast({ title: "Password change failed", sub: message });
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Change password"
        desc="Enter your current password, then choose a new one"
      />

      <Card title="Password" pad className="max-w-xl">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <PasswordField
            id="current-password"
            label="Current password"
            value={currentPassword}
            onChange={(v) => {
              setCurrentPassword(v);
              setErrors((e) => ({ ...e, current: undefined }));
            }}
            show={showCurrent}
            onToggleShow={() => setShowCurrent((s) => !s)}
            disabled={changePassword.isPending}
            error={errors.current}
            autoComplete="current-password"
          />

          <PasswordField
            id="new-password"
            label="New password"
            value={newPassword}
            onChange={(v) => {
              setNewPassword(v);
              setErrors((e) => ({ ...e, new: undefined }));
            }}
            show={showNew}
            onToggleShow={() => setShowNew((s) => !s)}
            disabled={changePassword.isPending}
            error={errors.new}
            autoComplete="new-password"
          />
          {!errors.new ? (
            <p className="-mt-2 text-sm text-muted-foreground">
              {STRONG_PASSWORD_MESSAGE}
            </p>
          ) : null}

          <PasswordField
            id="confirm-password"
            label="Confirm new password"
            value={confirmPassword}
            onChange={(v) => {
              setConfirmPassword(v);
              setErrors((e) => ({ ...e, confirm: undefined }));
            }}
            show={showConfirm}
            onToggleShow={() => setShowConfirm((s) => !s)}
            disabled={changePassword.isPending}
            error={errors.confirm}
            autoComplete="new-password"
          />

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? "Updating…" : "Update password"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/settings/profile">Back to profile</Link>
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
