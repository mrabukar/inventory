"use client";

import { XCircle } from "lucide-react";

import { StockReportLoadingSkeleton } from "./components/loading-skeleton";
import { StockReportTable } from "./components/stock-report-table";
import { ReportFilterBar } from "@/components/filters/report-filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useReportFilters } from "@/hooks/filters/use-report-filters";
import { useStockReport } from "@/hooks/reports/use-stock-report";
import { useAppStore } from "@/store/app";

export default function StockReportPage() {
  const hasStores = useAppStore((s) => s.user?.hasStores ?? true);
  const filters = useReportFilters();
  const { data, isPending, isFetching, isError, error } = useStockReport(
    filters.query,
  );

  const isLoading = isPending || isFetching;

  return (
    <>
      <PageHeader
        title="Stock Report"
        desc={
          hasStores
            ? "Purchase, on-hand stock, and sales units by product for the selected period."
            : "Organization-wide purchase, on-hand stock, and sales units by product."
        }
        action={
          <ReportFilterBar
            filters={filters}
            showCategoryFilter
            showStoreFilter={hasStores}
          />
        }
      />

      {isLoading ? (
        <StockReportLoadingSkeleton />
      ) : isError ? (
        <div className="alert-error">
          <XCircle size={16} />
          {error instanceof Error
            ? error.message
            : "Failed to load stock report."}
        </div>
      ) : data && data.products.length > 0 ? (
        <StockReportTable totals={data.totals} products={data.products} />
      ) : (
        <EmptyState
          title="No stock report data"
          sub="No product activity found for the selected filters."
        />
      )}
    </>
  );
}
