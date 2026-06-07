import {
  zonedDayEnd,
  zonedDayStart,
} from "../../common/utils/app-timezone.util";

/** Parse audit log range start (date-only → start of app-TZ day as UTC instant). */
export function parseAuditRangeStart(value: string): Date {
  const trimmed = value.trim();

  if (trimmed.includes("T") || trimmed.includes(" ")) {
    return new Date(trimmed.replace(" ", "T"));
  }

  return zonedDayStart(trimmed);
}

/** Parse audit log range end (date-only → end of app-TZ day as UTC instant). */
export function parseAuditRangeEnd(value: string): Date {
  const trimmed = value.trim();

  if (trimmed.includes("T") || trimmed.includes(" ")) {
    return new Date(trimmed.replace(" ", "T"));
  }

  return zonedDayEnd(trimmed);
}
