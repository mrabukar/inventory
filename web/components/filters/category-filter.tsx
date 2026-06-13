"use client";

import type { ReportFilters } from "@/hooks/filters/use-report-filters";
import { useCategories } from "@/hooks/categories/use-categories";
import { Combobox } from "@/components/ui/combobox";

interface CategoryFilterProps {
  filters?: ReportFilters;
  value?: number;
  onValueChange?: (categoryId: number | undefined) => void;
  allowClear?: boolean;
}

export function CategoryFilter({
  filters,
  value,
  onValueChange,
  allowClear = true,
}: CategoryFilterProps) {
  const { data: categories = [], isLoading } = useCategories();

  const selectedCategoryId =
    value !== undefined ? value : filters?.query.categoryId;

  const items = categories.map((category) => ({
    value: String(category.id),
    label: category.name,
    keywords: [category.name],
  }));

  return (
    <Combobox
      value={
        selectedCategoryId != null ? String(selectedCategoryId) : undefined
      }
      onValueChange={(nextValue) => {
        const categoryId = nextValue ? Number(nextValue) : undefined;
        if (onValueChange) {
          onValueChange(categoryId);
          return;
        }
        filters?.setCategoryId(categoryId);
      }}
      items={items}
      placeholder="Category"
      searchPlaceholder="Search categories…"
      emptyText="No categories found."
      clearOption={allowClear ? { label: "All categories" } : undefined}
      loading={isLoading}
      className="min-w-[160px]"
    />
  );
}
