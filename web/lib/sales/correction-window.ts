export const SALE_CORRECTION_WINDOW_HOURS = 12;

/** Organizations without stores (admin records and corrects sales) get 30 days. */
export const NO_STORES_CORRECTION_WINDOW_HOURS = 30 * 24;

export function correctionWindowHours(hasStores: boolean | null): number {
  return hasStores === false
    ? NO_STORES_CORRECTION_WINDOW_HOURS
    : SALE_CORRECTION_WINDOW_HOURS;
}

/** Human wording for the window, e.g. "12 hours" or "30 days". */
export function correctionWindowLabel(hasStores: boolean | null): string {
  return hasStores === false ? "30 days" : `${SALE_CORRECTION_WINDOW_HOURS} hours`;
}

/** True when the sale was recorded within the correction window. */
export function isSaleWithinCorrectionWindow(
  createdAt: string,
  hasStores: boolean | null = true,
  now = Date.now(),
): boolean {
  const recordedAt = new Date(createdAt).getTime();
  if (!Number.isFinite(recordedAt)) return false;
  return now - recordedAt <= correctionWindowHours(hasStores) * 60 * 60 * 1000;
}
