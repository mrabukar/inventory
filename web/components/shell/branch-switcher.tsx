"use client";

import { useEffect } from "react";
import { Landmark } from "lucide-react";

import { Combobox } from "@/components/ui/combobox";
import { useBranchView } from "@/hooks/branch-view/use-branch-view";

/**
 * Lets the admin of an organization without stores look at one of its credit
 * branches. Shown only on pages that can show a branch's data.
 */
export function BranchSwitcher() {
  const view = useBranchView();

  // A branch that no longer exists (or another organization's, left over in
  // this tab) falls back to the organization's own data.
  const { stale, select } = view;
  useEffect(() => {
    if (stale) select(null);
  }, [stale, select]);

  if (!view.enabled || !view.onBranchPage) return null;

  return (
    <div className="flex items-center gap-2" title="Choose whose data to show">
      <Landmark size={16} className="shrink-0 text-muted-foreground" />
      <Combobox
        value={view.selected?.id}
        onValueChange={(id) => view.select(id ?? null)}
        items={view.branches.map((branch) => ({
          value: branch.id,
          label: branch.name,
          keywords: [branch.name],
        }))}
        placeholder={view.organizationName}
        searchPlaceholder="Search branches…"
        emptyText="No branches found."
        clearOption={{ label: view.organizationName }}
        loading={view.isLoading}
        className="w-44 sm:w-52"
      />
    </div>
  );
}
