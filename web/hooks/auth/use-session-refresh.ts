"use client";

import { useEffect } from "react";
import {
  refreshAuthSession,
  SESSION_REFRESH_INTERVAL_MS,
} from "@/lib/auth/session-refresh";

const FOCUS_REFRESH_MIN_GAP_MS = 5_000;

/**
 * Keeps the 5-minute session alive while the tab is open by polling get-session.
 * Requires API session.updateAge (2 minutes) so Better Auth can extend expiry.
 */
export function useSessionRefresh(isAuthenticated: boolean): void {
  useEffect(() => {
    if (!isAuthenticated) return;

    let lastRefreshAt = 0;

    const runRefresh = () => {
      lastRefreshAt = Date.now();
      void refreshAuthSession();
    };

    runRefresh();
    const intervalId = window.setInterval(runRefresh, SESSION_REFRESH_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefreshAt < FOCUS_REFRESH_MIN_GAP_MS) return;
      runRefresh();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isAuthenticated]);
}
