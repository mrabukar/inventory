import { PageHeader } from "@/components/ui/page-header";
import { ReportFilterBar } from "@/components/filters/report-filter-bar";
import type { useReportFilters } from "@/hooks/filters/use-report-filters";

interface Props {
  filters: ReturnType<typeof useReportFilters>;
}

export function DashboardPageHeader({ filters }: Props) {
  return (
    <PageHeader
      title="Dashboard"
      desc="Monitor revenue, profit, expenses, and inventory for the selected period."
      action={<ReportFilterBar filters={filters} />}
    />
  );
}
