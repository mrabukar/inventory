import type { PeriodDelta } from "@/types/reports/common";

export function formatPeriodTrend(
  delta: PeriodDelta,
): { trend?: string; trendDir?: "up" | "down" } {
  if (delta.percent === null || delta.direction === "flat") {
    return {};
  }

  return {
    trend: `${Math.abs(delta.percent).toFixed(1)}%`,
    trendDir: delta.direction === "up" ? "up" : "down",
  };
}

/** For expenses, an increase is unfavorable — invert trend styling. */
export function formatExpenseTrend(
  delta: PeriodDelta,
): { trend?: string; trendDir?: "up" | "down" } {
  const base = formatPeriodTrend(delta);
  if (!base.trendDir) return base;

  return {
    trend: base.trend,
    trendDir: base.trendDir === "up" ? "down" : "up",
  };
}

export function formatSaleDate(saleDate: string): string {
  return saleDate.slice(0, 10);
}

export function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

/** Preserve decimal strings from the API when seeding price inputs. */
export function formatPriceInput(value: number | string): string {
  return typeof value === "string" ? value : String(value);
}
