"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck, Eye, EyeOff, XCircle } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { BackupCodesDisplay } from "@/components/auth/backup-codes-display";
import { useEnableTwoFactor, useVerifyTotp } from "@/hooks/auth/use-two-factor";
import { fetchCurrentUser, SESSION_QUERY_KEY } from "@/hooks/auth/session";
import { homePathForRole } from "@/lib/auth/routes";
import { useAppStore } from "@/store/app";
import { cn } from "@/lib/utils";

const inputCls = cn(
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
  "ring-offset-background transition-colors placeholder:text-muted-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

const codeInputCls = cn(
  "flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-center text-lg font-mono tracking-[0.3em]",
  "ring-offset-background transition-colors placeholder:text-muted-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

type Step = "password" | "scan" | "backup";

export default function SetupTwoFactorPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setUser = useAppStore((s) => s.setUser);

  const enableTwoFactor = useEnableTwoFactor();
  const verifyTotp = useVerifyTotp();

  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [savedCodes, setSavedCodes] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totpSecret = totpURI
    ? new URL(totpURI).searchParams.get("secret") ?? ""
    : "";

  const handleEnableStep = async () => {
    if (!password.trim()) {
      setErrorMessage("Password is required");
      return;
    }
    setErrorMessage(null);

    try {
      const data = await enableTwoFactor.mutateAsync({ password });
      setTotpURI(data.totpURI);
      setBackupCodes(data.backupCodes);
      setStep("scan");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to enable 2FA",
      );
    }
  };

  const handleVerifyStep = async () => {
    const trimmed = verifyCode.trim();
    if (!trimmed || trimmed.length !== 6) {
      setErrorMessage("Enter the 6-digit code from your authenticator app");
      return;
    }
    setErrorMessage(null);

    try {
      await verifyTotp.mutateAsync({ code: trimmed });
      setStep("backup");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Invalid code. Try again.",
      );
    }
  };

  const handleFinish = async () => {
    const user = await fetchCurrentUser();
    setUser(user);
    queryClient.setQueryData(SESSION_QUERY_KEY, user);
    router.push(homePathForRole(user.role));
  };

  const isPending = enableTwoFactor.isPending || verifyTotp.isPending;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[480px] space-y-6">
        <div className="flex items-center gap-2.5">
          <LogoMark size={32} />
          <span className="text-xl font-bold tracking-tight text-foreground">
            inventory
          </span>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Set up two-factor authentication
              </h1>
              <p className="text-sm text-muted-foreground">
                {step === "password" &&
                  "Two-factor authentication adds an extra layer of security to your account."}
                {step === "scan" &&
                  "Scan this QR code with Google Authenticator or any TOTP app."}
                {step === "backup" &&
                  "Each code can only be used once. Store them in a safe place."}
              </p>
            </div>
          </div>

          {/* Step indicators */}
          <div className="mb-6 flex gap-1">
            {(["password", "scan", "backup"] as Step[]).map((s, i) => (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  i <= ["password", "scan", "backup"].indexOf(step)
                    ? "bg-primary"
                    : "bg-muted",
                )}
              />
            ))}
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

          {/* Step 1: Enter password */}
          {step === "password" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="setup-pw" className="text-sm font-medium">
                  Current password
                </label>
                <div className="relative">
                  <input
                    id="setup-pw"
                    className={cn(inputCls, "pr-10")}
                    type={showPw ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMessage(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleEnableStep();
                    }}
                    disabled={isPending}
                    autoFocus
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowPw((s) => !s)}
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => void handleEnableStep()}
                disabled={isPending}
              >
                {isPending ? "Setting up..." : "Continue"}
              </Button>
            </div>
          )}

          {/* Step 2: Scan QR and verify */}
          {step === "scan" && (
            <div className="space-y-4">
              <div className="flex justify-center rounded-md border border-border bg-white p-4">
                <QRCodeSVG value={totpURI} size={200} />
              </div>

              {showSecret ? (
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="mb-1 text-xs text-muted-foreground">Secret key</p>
                  <p className="break-all font-mono text-sm select-all">
                    {totpSecret}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  className="w-full text-center text-sm text-primary hover:underline"
                  onClick={() => setShowSecret(true)}
                >
                  Can&apos;t scan? Click to show the secret key
                </button>
              )}

              <div className="space-y-1.5">
                <label htmlFor="verify-code" className="text-sm font-medium">
                  Verification code
                </label>
                <input
                  id="verify-code"
                  className={codeInputCls}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => {
                    setVerifyCode(e.target.value.replace(/\D/g, ""));
                    setErrorMessage(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleVerifyStep();
                  }}
                  disabled={isPending}
                  autoFocus
                  autoComplete="one-time-code"
                />
              </div>

              <Button
                className="w-full"
                onClick={() => void handleVerifyStep()}
                disabled={isPending}
              >
                {isPending ? "Verifying..." : "Verify & activate"}
              </Button>
            </div>
          )}

          {/* Step 3: Save backup codes */}
          {step === "backup" && (
            <div className="space-y-4">
              <BackupCodesDisplay codes={backupCodes} />

              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="saved-codes"
                  className="size-4 rounded border-input"
                  checked={savedCodes}
                  onChange={(e) => setSavedCodes(e.target.checked)}
                />
                <label
                  htmlFor="saved-codes"
                  className="cursor-pointer select-none text-sm text-muted-foreground"
                >
                  I have saved my backup codes
                </label>
              </div>

              <Button
                className="w-full"
                onClick={() => void handleFinish()}
                disabled={!savedCodes}
              >
                Continue to app
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
