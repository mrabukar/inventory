"use client";

import { Landmark } from "lucide-react";

import { Combobox } from "@/components/ui/combobox";
import { useBranchScopeControl } from "@/hooks/branch-view/use-branch-view";
import { ALL_BRANCHES, ALL_BRANCHES_LABEL } from "@/lib/branch-scope";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app";

/** Stands for "the organization itself" inside the list (the stored choice is null). */
const OWN = "own";

interface Props {
  /**
   * Offer the organization itself. The approval pages leave it out: they are
   * about the branches, and the organization has nothing to approve.
   */
  includeOwn?: boolean;
  className?: string;
  disabled?: boolean;
}

/**
 * Lets the admin of a credit organization look at the organization itself,
 * every branch together, or one branch. Shown nowhere else.
 */
export function BranchScopeSelect({
  includeOwn = true,
  className,
  disabled = false,
}: Props) {
  const control = useBranchScopeControl();
  // The organization's own data is called by the organization's name.
  const organizationName = useAppStore(
    (s) => s.user?.organizationName?.trim() || "Organization",
  );

  if (!control.enabled) return null;

  const current =
    control.value === null ? (includeOwn ? OWN : ALL_BRANCHES) : control.value;

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      title="Choose whose data to show"
    >
      <Landmark size={16} className="shrink-0 text-muted-foreground" />
      <Combobox
        value={current}
        onValueChange={(id) => control.select(!id || id === OWN ? null : id)}
        items={[
          ...(includeOwn
            ? [{ value: OWN, label: organizationName }]
            : []),
          { value: ALL_BRANCHES, label: ALL_BRANCHES_LABEL },
          ...control.branches.map((branch) => ({
            value: branch.id,
            label: branch.name,
            keywords: [branch.name],
          })),
        ]}
        placeholder={ALL_BRANCHES_LABEL}
        searchPlaceholder="Search branches…"
        emptyText="No branches found."
        loading={control.isLoading}
        disabled={disabled}
        className="w-44 sm:w-52"
      />
    </div>
  );
}
