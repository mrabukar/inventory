"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ALL_BRANCHES } from "@/lib/branch-scope";

interface BranchViewState {
  /**
   * What the admin is looking at: "all" (every credit branch together, the
   * default), one branch's id, or null for the organization's own data.
   */
  branchId: string | null;
  setBranchId: (id: string | null) => void;
}

/**
 * Kept in sessionStorage: it survives a refresh but not a new session, so a
 * fresh sign-in always starts on all branches.
 */
export const useBranchViewStore = create<BranchViewState>()(
  persist(
    (set) => ({
      branchId: ALL_BRANCHES,
      setBranchId: (branchId) => set({ branchId }),
    }),
    {
      name: "inventory-branch-view",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
