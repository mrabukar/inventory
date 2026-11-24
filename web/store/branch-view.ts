"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface BranchViewState {
  /** The credit branch the admin is browsing; null means the organization's own data. */
  branchId: string | null;
  setBranchId: (id: string | null) => void;
}

/**
 * Kept in sessionStorage: it survives a refresh but not a new session, so a
 * fresh sign-in always starts on the organization's own data.
 */
export const useBranchViewStore = create<BranchViewState>()(
  persist(
    (set) => ({
      branchId: null,
      setBranchId: (branchId) => set({ branchId }),
    }),
    {
      name: "inventory-branch-view",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
