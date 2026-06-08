export interface ReportPeriod {
  from: string;
  to: string;
  timezone: string;
}

export type PeriodDeltaDirection = "up" | "down" | "flat";

export interface PeriodDelta {
  /** Percent change vs previous period; null when previous value was 0. */
  percent: number | null;
  direction: PeriodDeltaDirection;
  label: string;
}

export interface AdminPeriodComparison {
  label: string;
  previousPeriod: { from: string; to: string };
  totalRevenue: PeriodDelta;
  grossProfit: PeriodDelta;
  netProfit: PeriodDelta;
  totalExpenses: PeriodDelta;
  totalUnitsSold: PeriodDelta;
}
