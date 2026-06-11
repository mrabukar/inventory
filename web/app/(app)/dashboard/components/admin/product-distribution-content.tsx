"use client";

import { useMemo } from "react";
import { XCircle } from "lucide-react";

import { StripedLineChart } from "@/components/charts/striped-line-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { useProductDistribution } from "@/hooks/reports/use-product-distribution";
import type { ProductDistributionQuery } from "@/types/reports/product-distribution";
import { DONUT_COLORS } from "../donut-colors";

interface Props {
  query: ProductDistributionQuery | null;
  subtitle?: string;
  chartHeight?: number;
  emptySub?: string;
}

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="dt-skeleton"
      aria-hidden="true"
      style={{ width: "100%", height, maxWidth: "none", borderRadius: 8 }}
    />
  );
}

export function ProductDistributionContent({
  query,
  subtitle,
  chartHeight = 300,
  emptySub = "No units sold in this category for the selected period.",
}: Props) {
  const placeholderQuery: ProductDistributionQuery = {
    fromDate: query?.fromDate ?? "",
    toDate: query?.toDate ?? "",
    storeId: query?.storeId,
    categoryId: -1,
  };

  const { data, isLoading, isError, error } = useProductDistribution(
    query ?? placeholderQuery,
  );

  const categoryLabel = data?.filters.categoryName;

  const chartData = useMemo(() => {
    const trend = data?.trend;
    if (!trend || trend.series.length === 0) {
      return null;
    }

    return {
      labels: trend.dates,
      series: trend.series.map((row, index) => ({
        label: row.productName,
        values: row.values,
        color: DONUT_COLORS[index % DONUT_COLORS.length],
        formatValue: (value: number) => value.toLocaleString(),
      })),
    };
  }, [data?.trend]);

  const resolvedSubtitle =
    subtitle ??
    (categoryLabel
      ? `Daily units sold by product in ${categoryLabel}${
          data ? ` — ${data.totalUnitsSold.toLocaleString()} total` : ""
        }`
      : "Daily units sold by product");

  if (!query) {
    return <ChartSkeleton height={chartHeight} />;
  }

  return (
    <>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
        {resolvedSubtitle}
      </p>

      {isLoading ? (
        <ChartSkeleton height={chartHeight} />
      ) : isError ? (
        <div className="alert-error">
          <XCircle size={16} />
          {error instanceof Error
            ? error.message
            : "Failed to load product distribution."}
        </div>
      ) : chartData ? (
        <StripedLineChart
          labels={chartData.labels}
          height={chartHeight}
          series={chartData.series}
        />
      ) : (
        <EmptyState title="No product sales" sub={emptySub} />
      )}
    </>
  );
}
