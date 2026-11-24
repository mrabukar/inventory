import { PageHeader } from "@/components/ui/page-header";
import { ReportFilterBar } from "@/components/filters/report-filter-bar";
import type { useReportFilters } from "@/hooks/filters/use-report-filters";
import { useAppStore } from "@/store/app";

interface Props {
  filters: ReturnType<typeof useReportFilters>;
}

export function DashboardPageHeader({ filters }: Props) {
  // An organization without stores picks a credit branch from the top bar.
  const hasStores = useAppStore((s) => s.user?.hasStores ?? true);
  return (
    <PageHeader
      className="page-head--band"
      title="Dashboard"
      desc="Monitor revenue, profit, expenses, and inventory for the selected period."
      action={<ReportFilterBar filters={filters} showStoreFilter={hasStores} />}
    />
  );
}
