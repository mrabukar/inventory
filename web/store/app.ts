"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppUser, Toast } from "@/lib/types";

interface AppState {
  user: AppUser | null;
  collapsed: boolean;
  toasts: Toast[];
  login: (user: AppUser) => void;
  logout: () => void;
  setCollapsed: (v: boolean) => void;
  addToast: (t: Omit<Toast, "id">) => void;
  removeToast: (id: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      collapsed: false,
      toasts: [],

      login: (user) => set({ user }),
      logout: () => set({ user: null }),
      setCollapsed: (v) => set({ collapsed: v }),

      addToast: (t) => {
        const id = Date.now() + Math.random();
        set((s) => ({ toasts: [...s.toasts, { id, kind: "success", ...t }] }));
        setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 3200);
      },
      removeToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
    }),
    {
      name: "inventory-session",
      partialize: (s) => ({ user: s.user, collapsed: s.collapsed }),
    }
  )
);
