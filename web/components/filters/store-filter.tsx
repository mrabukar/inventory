"use client";

import type { ReportFilters } from "@/hooks/filters/use-report-filters";
import { useStores } from "@/hooks/stores/list-stores";
import { Combobox } from "@/components/ui/combobox";

interface StoreFilterProps {
  filters: ReportFilters;
}

export function StoreFilter({ filters }: StoreFilterProps) {
  const { data, isLoading } = useStores({ limit: 100 });
  const stores = data?.data ?? [];

  const items = stores.map((store) => ({
    value: store.id,
    label: store.name,
    keywords: [store.name, store.address],
  }));

  return (
    <Combobox
      value={filters.query.storeId}
      onValueChange={filters.setStoreId}
      items={items}
      placeholder="All stores"
      searchPlaceholder="Search stores…"
      emptyText="No stores found."
      clearOption={{ label: "All stores" }}
      loading={isLoading}
    />
  );
}
