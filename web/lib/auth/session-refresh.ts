import { authClient } from "@/lib/auth/client";

/** Poll interval — must be ≤ session updateAge on the API (currently 2 minutes). */
export const SESSION_REFRESH_INTERVAL_MS = 2 * 60 * 1000;

/** Extend the Better Auth session cookie via GET /api/auth/get-session. */
export async function refreshAuthSession(): Promise<void> {
  await authClient.getSession();
}
