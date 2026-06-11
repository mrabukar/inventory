"use client";

import { createContext, useContext, useEffect } from "react";
import { useSession } from "@/hooks/auth/session";
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isFetched, isAuthenticated } = useSession();
  const setUser = useAppStore((s) => s.setUser);
  const clearUser = useAppStore((s) => s.clearUser);

  useEffect(() => {
    if (!isFetched) return;
    if (user) {
      setUser(user);
    } else {
      clearUser();
    }
  }, [user, isFetched, setUser, clearUser]);

  return (
    <AuthContext.Provider value={{ isLoading, isFetched, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}
