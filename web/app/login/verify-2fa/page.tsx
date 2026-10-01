"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, ArrowLeft, XCircle } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useVerifyTotp, useVerifyBackupCode } from "@/hooks/auth/use-two-factor";
import { fetchCurrentUser, SESSION_QUERY_KEY } from "@/hooks/auth/session";
import { homePathForRole } from "@/lib/auth/routes";
import { useAppStore } from "@/store/app";
import { cn } from "@/lib/utils";

const TOTP_CODE_LENGTH = 6;
/** Better-Auth formats length:10 codes as XXXXX-XXXXX (10 chars + hyphen). */
const BACKUP_CODE_LENGTH = 11;

const inputCls = cn(
  "flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-center text-lg font-mono",
  "ring-offset-background transition-colors placeholder:text-muted-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export default function VerifyTwoFactorPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setUser = useAppStore((s) => s.setUser);
  const verifyTotp = useVerifyTotp();
  const verifyBackup = useVerifyBackupCode();

  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPending = verifyTotp.isPending || verifyBackup.isPending;

  const handleVerify = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setErrorMessage(useBackupCode ? "Enter a backup code" : "Enter your 6-digit code");
      return;
    }

    setErrorMessage(null);

    try {
      if (useBackupCode) {
        await verifyBackup.mutateAsync({ code: trimmed });
      } else {
        await verifyTotp.mutateAsync({ code: trimmed, trustDevice });
      }

      const user = await fetchCurrentUser();
      setUser(user);
      queryClient.setQueryData(SESSION_QUERY_KEY, user);
      router.push(
        user.twoFactorEnabled ? homePathForRole(user.role) : "/setup-2fa",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Verification failed. Please try again.",
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[420px] space-y-6">
        <div className="flex items-center gap-2.5">
          <LogoMark size={32} />
          <span className="text-xl font-bold tracking-tight text-foreground">
            inventory
          </span>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
              <KeyRound className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                {useBackupCode ? "Enter a backup code" : "Two-factor authentication"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {useBackupCode
                  ? "Enter one of your backup codes, including the hyphen"
                  : "Enter the 6-digit code from your authenticator app"}
              </p>
            </div>
          </div>

          {errorMessage && (
            <div
              className="mb-4 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
              role="alert"
            >
              <XCircle className="size-4 shrink-0" />
              {errorMessage}
            </div>
          )}

          <div className="space-y-4">
            <input
              className={cn(inputCls, useBackupCode ? "tracking-wide" : "tracking-[0.3em]")}
              type="text"
              inputMode={useBackupCode ? "text" : "numeric"}
              maxLength={useBackupCode ? BACKUP_CODE_LENGTH : TOTP_CODE_LENGTH}
              placeholder={useBackupCode ? "XXXXX-XXXXX" : "000000"}
              value={code}
              onChange={(e) => {
                setCode(
                  useBackupCode
                    ? e.target.value.slice(0, BACKUP_CODE_LENGTH)
                    : e.target.value.replace(/\D/g, "").slice(0, TOTP_CODE_LENGTH),
                );
                setErrorMessage(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleVerify();
              }}
              disabled={isPending}
              autoFocus
              autoComplete="one-time-code"
            />

            {!useBackupCode && (
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="trust-device"
                  className="size-4 rounded border-input"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                  disabled={isPending}
                />
                <label
                  htmlFor="trust-device"
                  className="cursor-pointer select-none text-sm text-muted-foreground"
                >
                  Trust this device for 30 days
                </label>
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => void handleVerify()}
              disabled={isPending}
            >
              {isPending ? "Verifying..." : "Verify"}
            </Button>
          </div>

          <div className="mt-4 flex flex-col items-center gap-2 text-sm">
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => {
                setUseBackupCode(!useBackupCode);
                setCode("");
                setErrorMessage(null);
              }}
              disabled={isPending}
            >
              {useBackupCode
                ? "Use authenticator code instead"
                : "Use a backup code instead"}
            </button>
            <button
              type="button"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => router.push("/login")}
              disabled={isPending}
            >
              <ArrowLeft className="size-3.5" />
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
