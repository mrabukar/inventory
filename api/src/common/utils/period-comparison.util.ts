import { toPercent, toMoneyDecimal } from "./money.util";

export type PeriodDeltaDirection = "up" | "down" | "flat";

export interface PeriodDelta {
  /** Percent change vs previous period; `null` when previous value was 0. */
  percent: number | null;
  direction: PeriodDeltaDirection;
  label: string;
}

export const PERIOD_COMPARISON_LABEL = "vs last month";

/** Period-over-period percent change: ((current − previous) / previous) × 100. */
export function computePeriodDelta(
  current: number,
  previous: number,
  label: string = PERIOD_COMPARISON_LABEL,
): PeriodDelta {
  if (previous === 0) {
    return {
      percent: current === 0 ? 0 : null,
      direction: current > 0 ? "up" : "flat",
      label,
    };
  }

  const percent = toPercent(
    toMoneyDecimal(current).minus(previous).div(previous).times(100),
  );

  return {
    percent,
    direction: percent > 0 ? "up" : percent < 0 ? "down" : "flat",
    label,
  };
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

export function buildAdminPeriodComparison(
  current: {
    totalRevenue: number;
    grossProfit: number;
    netProfit: number;
    totalExpenses: number;
    totalUnitsSold: number;
  },
  previous: {
    totalRevenue: number;
    grossProfit: number;
    netProfit: number;
    totalExpenses: number;
    totalUnitsSold: number;
  },
  previousPeriod: { from: string; to: string },
): AdminPeriodComparison {
  return {
    label: PERIOD_COMPARISON_LABEL,
    previousPeriod,
    totalRevenue: computePeriodDelta(
      current.totalRevenue,
      previous.totalRevenue,
    ),
    grossProfit: computePeriodDelta(current.grossProfit, previous.grossProfit),
    netProfit: computePeriodDelta(current.netProfit, previous.netProfit),
    totalExpenses: computePeriodDelta(
      current.totalExpenses,
      previous.totalExpenses,
    ),
    totalUnitsSold: computePeriodDelta(
      current.totalUnitsSold,
      previous.totalUnitsSold,
    ),
  };
}

export interface ManagerPeriodComparison {
  label: string;
  todayRevenue: PeriodDelta;
  monthRevenue: PeriodDelta;
}

export function buildManagerPeriodComparison(
  current: { todayRevenue: number; monthRevenue: number },
  previous: { todayRevenue: number; monthRevenue: number },
): ManagerPeriodComparison {
  return {
    label: PERIOD_COMPARISON_LABEL,
    todayRevenue: computePeriodDelta(
      current.todayRevenue,
      previous.todayRevenue,
    ),
    monthRevenue: computePeriodDelta(
      current.monthRevenue,
      previous.monthRevenue,
    ),
  };
}
