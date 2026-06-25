import { createAuthClient } from "better-auth/react";
import { getApiBaseUrl } from "@/lib/api-base-url";

export const authClient = createAuthClient({ baseURL: getApiBaseUrl() });
