"use client";

import { useMemo, useState } from "react";

import { CategoryFilter } from "@/components/filters/category-filter";
import { Card } from "@/components/ui/card";
import { useCategories } from "@/hooks/categories/use-categories";
import type { ReportFilters } from "@/hooks/filters/use-report-filters";
import {
  getCurrentMonthLabel,
  getCurrentMonthRange,
} from "@/lib/filters/dates";
import type { ProductDistributionQuery } from "@/types/reports/product-distribution";
import { ProductDistributionContent } from "./product-distribution-content";
import { ProductDistributionModal } from "./product-distribution-modal";

interface Props {
  filters: ReportFilters;
}

export function AdminProductDistributionChart({ filters }: Props) {
  const { query: reportQuery } = filters;
  const { data: categories = [] } = useCategories();
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const activeCategoryId = categoryId ?? categories[0]?.id;
  const monthRange = getCurrentMonthRange();
  const monthLabel = getCurrentMonthLabel();
  const [modalOpen, setModalOpen] = useState(false);

  const distributionQuery = useMemo((): ProductDistributionQuery | null => {
    if (activeCategoryId == null) return null;
    return {
      fromDate: monthRange.fromDate,
      toDate: monthRange.toDate,
      storeId: reportQuery.storeId,
      categoryId: activeCategoryId,
    };
  }, [
    activeCategoryId,
    monthRange.fromDate,
    monthRange.toDate,
    reportQuery.storeId,
  ]);

  return (
    <div className="mb-16">
      <Card
        title={`Product Distribution for this month — ${monthLabel}`}
        link="See custom product distribution"
        onLink={() => setModalOpen(true)}
        pad
      >
        <div
          className="dash-chart-toolbar"
          style={{ justifyContent: "flex-end", marginBottom: 0 }}
        >
          <CategoryFilter
            value={activeCategoryId}
            onValueChange={setCategoryId}
            allowClear={false}
          />
        </div>

        <ProductDistributionContent
          query={distributionQuery}
          chartHeight={300}
          emptySub="No units sold in this category this month."
        />
      </Card>

      <ProductDistributionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialCategoryId={activeCategoryId}
        initialStoreId={reportQuery.storeId}
      />
    </div>
  );
}
