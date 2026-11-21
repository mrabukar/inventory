"use client";

import { Combobox } from "@/components/ui/combobox";
import { useCreditBranches } from "@/hooks/credit-branches/use-credit-branches";
import type { ReportFilters } from "@/hooks/filters/use-report-filters";

interface BranchFilterProps {
  filters: ReportFilters;
  disabled?: boolean;
}

/** Lets an organization admin switch between the organization and one credit branch. */
export function BranchFilter({ filters, disabled = false }: BranchFilterProps) {
  const { data: branches = [], isLoading } = useCreditBranches();

  if (!isLoading && branches.length === 0) return null;

  return (
    <Combobox
      value={filters.query.storeId}
      onValueChange={filters.setStoreId}
      items={branches.map((branch) => ({
        value: branch.id,
        label: branch.name,
        keywords: [branch.name],
      }))}
      placeholder="Organization"
      searchPlaceholder="Search branches…"
      emptyText="No branches found."
      clearOption={{ label: "Organization" }}
      loading={isLoading}
      disabled={disabled}
    />
  );
}
