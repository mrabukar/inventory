"use client";

import type { ReportFilters } from "@/hooks/filters/use-report-filters";
import { useCategories } from "@/hooks/categories/use-categories";
import { Combobox } from "@/components/ui/combobox";

interface CategoryFilterProps {
  filters: ReportFilters;
}

export function CategoryFilter({ filters }: CategoryFilterProps) {
  const { data: categories = [], isLoading } = useCategories();

  const items = categories.map((category) => ({
    value: String(category.id),
    label: category.name,
    keywords: [category.name],
  }));

  return (
    <Combobox
      value={
        filters.query.categoryId != null
          ? String(filters.query.categoryId)
          : undefined
      }
      onValueChange={(value) => {
        filters.setCategoryId(value ? Number(value) : undefined);
      }}
      items={items}
      placeholder="Category"
      searchPlaceholder="Search categories…"
      emptyText="No categories found."
      loading={isLoading}
      className="min-w-[160px]"
    />
  );
}
