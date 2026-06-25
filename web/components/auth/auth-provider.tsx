"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/hooks/auth/session";
import { useSessionRefresh } from "@/hooks/auth/use-session-refresh";
import { buildLoginUrl } from "@/lib/auth/redirect";
import { clearClientSession, clearTenantQueries } from "@/lib/auth/query-cache";
import { registerUnauthorizedHandler } from "@/lib/auth/unauthorized";
import { useAppStore } from "@/store/app";

interface AuthContextValue {
  isLoading: boolean;
  isFetched: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  isLoading: true,
  isFetched: false,
  isAuthenticated: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

function tenantCacheKey(user: {
  id: string;
  organizationId: string | null;
} | null): string | null {
  if (!user) return null;
  return `${user.id}:${user.organizationId ?? "platform"}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user, isLoading, isFetched, isAuthenticated } = useSession();
  const setUser = useAppStore((s) => s.setUser);
  const clearUser = useAppStore((s) => s.clearUser);
  const tenantCacheKeyRef = useRef<string | null>(null);

  useSessionRefresh(isAuthenticated);

  useEffect(() => {
    if (!isFetched) return;
    if (user) {
      setUser(user);
    } else {
      clearUser();
    }
  }, [user, isFetched, setUser, clearUser]);

  useEffect(() => {
    return registerUnauthorizedHandler(() => {
      clearUser();
      clearClientSession(queryClient);
      const returnPath = `${window.location.pathname}${window.location.search}`;
      window.location.replace(buildLoginUrl(returnPath));
    });
  }, [queryClient, clearUser]);

  useEffect(() => {
    if (!isFetched) return;

    const nextKey = tenantCacheKey(user);
    const prevKey = tenantCacheKeyRef.current;

    if (prevKey !== null && nextKey !== null && prevKey !== nextKey) {
      clearTenantQueries(queryClient);
    }

    tenantCacheKeyRef.current = nextKey;
  }, [user, isFetched, queryClient]);

  return (
    <AuthContext.Provider value={{ isLoading, isFetched, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}
