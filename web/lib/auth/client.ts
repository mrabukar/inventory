import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { getApiBaseUrl } from "@/lib/api-base-url";

export const authClient = createAuthClient({
  baseURL: getApiBaseUrl(),
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect: () => {
        window.location.href = "/login/verify-2fa";
      },
    }),
  ],
});
