"use client";

import { createContext, useContext, useEffect } from "react";
import { useSession } from "@/lib/auth/hooks";
import { useAppStore } from "@/store/app";

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  isLoading: true,
  isAuthenticated: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useSession();
  const setUser = useAppStore((s) => s.setUser);
  const clearUser = useAppStore((s) => s.clearUser);

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      setUser(user);
    } else {
      clearUser();
    }
  }, [user, isLoading, setUser, clearUser]);

  return (
    <AuthContext.Provider value={{ isLoading, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}
