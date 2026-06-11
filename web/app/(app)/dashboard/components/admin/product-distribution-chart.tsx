"use client";

import { useMemo, useState } from "react";

import { CategoryFilter } from "@/components/filters/category-filter";
import { Card } from "@/components/ui/card";
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
  const monthRange = getCurrentMonthRange();
  const monthLabel = getCurrentMonthLabel();
  const [modalOpen, setModalOpen] = useState(false);

  const distributionQuery = useMemo((): ProductDistributionQuery | null => {
    if (reportQuery.categoryId == null) return null;
    return {
      fromDate: monthRange.fromDate,
      toDate: monthRange.toDate,
      storeId: reportQuery.storeId,
      categoryId: reportQuery.categoryId,
    };
  }, [
    monthRange.fromDate,
    monthRange.toDate,
    reportQuery.categoryId,
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
          <CategoryFilter filters={filters} />
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
        initialCategoryId={reportQuery.categoryId}
        initialStoreId={reportQuery.storeId}
      />
    </div>
  );
}
