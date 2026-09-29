"use client";

import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/lib/auth/client";

export function useEnableTwoFactor() {
  return useMutation({
    mutationFn: async ({ password }: { password: string }) => {
      const result = await authClient.twoFactor.enable({ password });
      if (result.error) {
        throw new Error(
          result.error.message?.trim() || "Failed to enable 2FA",
        );
      }
      return result.data as { totpURI: string; backupCodes: string[] };
    },
  });
}

export function useVerifyTotp() {
  return useMutation({
    mutationFn: async ({
      code,
      trustDevice,
    }: {
      code: string;
      trustDevice?: boolean;
    }) => {
      const result = await authClient.twoFactor.verifyTotp({
        code,
        trustDevice,
      });
      if (result.error) {
        throw new Error(
          result.error.message?.trim() || "Invalid verification code",
        );
      }
      return result.data;
    },
  });
}

export function useVerifyBackupCode() {
  return useMutation({
    mutationFn: async ({ code }: { code: string }) => {
      const result = await authClient.twoFactor.verifyBackupCode({ code });
      if (result.error) {
        throw new Error(
          result.error.message?.trim() || "Invalid backup code",
        );
      }
      return result.data;
    },
  });
}

export function useGenerateBackupCodes() {
  return useMutation({
    mutationFn: async ({ password }: { password: string }) => {
      const result = await authClient.twoFactor.generateBackupCodes({
        password,
      });
      if (result.error) {
        throw new Error(
          result.error.message?.trim() || "Failed to generate backup codes",
        );
      }
      return result.data as { backupCodes: string[] };
    },
  });
}

export function useGetTotpUri() {
  return useMutation({
    mutationFn: async ({ password }: { password: string }) => {
      const result = await authClient.twoFactor.getTotpUri({ password });
      if (result.error) {
        throw new Error(
          result.error.message?.trim() || "Failed to get QR code",
        );
      }
      return result.data as { totpURI: string };
    },
  });
}
