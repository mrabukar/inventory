export const SALE_CORRECTION_WINDOW_HOURS = 12;

/** True when the sale was recorded within the correction window. */
export function isSaleWithinCorrectionWindow(
  createdAt: string,
  now = Date.now(),
): boolean {
  const recordedAt = new Date(createdAt).getTime();
  if (!Number.isFinite(recordedAt)) return false;
  return now - recordedAt <= SALE_CORRECTION_WINDOW_HOURS * 60 * 60 * 1000;
}
