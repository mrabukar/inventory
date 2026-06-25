import { BadRequestException } from "@nestjs/common";
import { DateTime, IANAZone } from "luxon";

const DEFAULT_TIMEZONE = "Africa/Mogadishu";
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** IANA timezone for business calendar dates (default: Mogadishu). */
export function getAppTimezone(): string {
  const configured = process.env.APP_TIMEZONE?.trim();
  const candidate = configured || DEFAULT_TIMEZONE;

  if (!IANAZone.isValidZone(candidate)) {
    return DEFAULT_TIMEZONE;
  }

  return candidate;
}

function parseCalendarDateParts(value: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));

  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new BadRequestException("Invalid date");
  }

  return { year, month, day };
}

/** Extract and validate `YYYY-MM-DD` from a date or datetime string. */
export function extractCalendarDate(value: string): string {
  const trimmed = value.trim();
  const datePart = trimmed.includes("T")
    ? trimmed.split("T")[0]
    : trimmed.includes(" ")
      ? trimmed.split(" ")[0]
      : trimmed;

  if (!CALENDAR_DATE_PATTERN.test(datePart)) {
    throw new BadRequestException("Invalid date format, expected YYYY-MM-DD");
  }

  parseCalendarDateParts(datePart);
  return datePart;
}

/** Today's calendar date in the app timezone. */
export function todayCalendarDate(): string {
  const today = DateTime.now().setZone(getAppTimezone()).toISODate();
  if (!today) {
    throw new Error("Failed to resolve today's calendar date");
  }
  return today;
}

/** Convert a calendar date to a Prisma/PostgreSQL `date` value. */
export function calendarDateToDbDate(calendarDate: string): Date {
  const validated = extractCalendarDate(calendarDate);
  return new Date(`${validated}T12:00:00.000Z`);
}

export function calendarDateDaysAgo(
  days: number,
  referenceCalendarDate?: string,
): string {
  const reference = extractCalendarDate(
    referenceCalendarDate ?? todayCalendarDate(),
  );
  const { year, month, day } = parseCalendarDateParts(reference);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() - days);

  return formatUtcCalendarDate(utc);
}

export function startOfMonthCalendarDate(calendarDate?: string): string {
  const reference = extractCalendarDate(calendarDate ?? todayCalendarDate());
  const { year, month } = parseCalendarDateParts(reference);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function calendarDateMonthsAgo(
  months: number,
  referenceCalendarDate: string,
): string {
  const reference = extractCalendarDate(referenceCalendarDate);
  const { year, month } = parseCalendarDateParts(reference);
  const utc = new Date(Date.UTC(year, month - 1, 1));
  utc.setUTCMonth(utc.getUTCMonth() - months);

  return formatUtcCalendarDate(
    new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), 1)),
  );
}

export function compareCalendarDates(a: string, b: string): number {
  return extractCalendarDate(a).localeCompare(extractCalendarDate(b));
}

/** Inclusive calendar-day range for `@db.Date` columns. */
export function parseDateColumnRangeStart(value: string): Date {
  return calendarDateToDbDate(extractCalendarDate(value));
}

export function parseDateColumnRangeEnd(value: string): Date {
  return calendarDateToDbDate(extractCalendarDate(value));
}

/** Start of a calendar day in the app timezone as a UTC instant (`createdAt` filters). */
export function zonedDayStart(value: string): Date {
  const calendarDate = extractCalendarDate(value);
  return DateTime.fromISO(calendarDate, { zone: getAppTimezone() })
    .startOf("day")
    .toUTC()
    .toJSDate();
}

/** End of a calendar day in the app timezone as a UTC instant (`createdAt` filters). */
export function zonedDayEnd(value: string): Date {
  const calendarDate = extractCalendarDate(value);
  return DateTime.fromISO(calendarDate, { zone: getAppTimezone() })
    .endOf("day")
    .toUTC()
    .toJSDate();
}

/** Inclusive start of a calendar day for timestamp columns (`createdAt`, etc.). */
export function parseTimestampRangeStart(value: string): Date {
  return zonedDayStart(extractCalendarDate(value));
}

/** Inclusive end of a calendar day for timestamp columns (`createdAt`, etc.). */
export function parseTimestampRangeEnd(value: string): Date {
  return zonedDayEnd(extractCalendarDate(value));
}

/** Iterate calendar dates inclusive from `from` through `to`. */
export function eachCalendarDate(
  fromCalendarDate: string,
  toCalendarDate: string,
): string[] {
  const from = extractCalendarDate(fromCalendarDate);
  const to = extractCalendarDate(toCalendarDate);

  if (compareCalendarDates(from, to) > 0) {
    throw new BadRequestException("fromDate must be on or before toDate");
  }

  const dates: string[] = [];
  const { year, month, day } = parseCalendarDateParts(from);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  const endParts = parseCalendarDateParts(to);
  const end = new Date(
    Date.UTC(endParts.year, endParts.month - 1, endParts.day),
  );

  while (cursor <= end) {
    dates.push(formatUtcCalendarDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export function formatMonthKey(calendarDate: string): string {
  const { year, month } = parseCalendarDateParts(
    extractCalendarDate(calendarDate),
  );
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthLabelFromKey(monthKey: string): string {
  const { year, month } = parseCalendarDateParts(
    extractCalendarDate(`${monthKey}-01`),
  );
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}

export function buildMonthSeries(
  fromCalendarDate: string,
  toCalendarDate: string,
): string[] {
  const from = extractCalendarDate(fromCalendarDate);
  const to = extractCalendarDate(toCalendarDate);

  if (compareCalendarDates(from, to) > 0) {
    throw new BadRequestException("fromDate must be on or before toDate");
  }

  const keys: string[] = [];
  const fromParts = parseCalendarDateParts(from);
  const toParts = parseCalendarDateParts(to);
  let year = fromParts.year;
  let month = fromParts.month;

  while (
    year < toParts.year ||
    (year === toParts.year && month <= toParts.month)
  ) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return keys;
}

export interface ReportDateRange {
  fromCalendar: string;
  toCalendar: string;
  /** Inclusive bounds for `@db.Date` columns (`saleDate`, `expenseDate`). */
  fromDate: Date;
  toDate: Date;
  /** Bounds for timestamp columns (`createdAt`). */
  fromTimestamp: Date;
  toTimestamp: Date;
}

/** Default reporting window: start of month 6 months ago through today (app TZ). */
export function resolveReportDateRange(
  fromDate?: string,
  toDate?: string,
): ReportDateRange {
  const toCalendar =
    typeof toDate === "string" && toDate.trim()
      ? extractCalendarDate(toDate.trim())
      : todayCalendarDate();

  const fromCalendar =
    typeof fromDate === "string" && fromDate.trim()
      ? extractCalendarDate(fromDate.trim())
      : calendarDateMonthsAgo(5, toCalendar);

  if (compareCalendarDates(fromCalendar, toCalendar) > 0) {
    throw new BadRequestException("fromDate must be on or before toDate");
  }

  return {
    fromCalendar,
    toCalendar,
    fromDate: calendarDateToDbDate(fromCalendar),
    toDate: calendarDateToDbDate(toCalendar),
    fromTimestamp: zonedDayStart(fromCalendar),
    toTimestamp: zonedDayEnd(toCalendar),
  };
}

/** Same calendar dates shifted back one month (e.g. Jun 1–7 → May 1–7). */
export function shiftCalendarDateBackMonths(
  calendarDate: string,
  months: number,
): string {
  const reference = extractCalendarDate(calendarDate);
  const { year, month, day } = parseCalendarDateParts(reference);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCMonth(utc.getUTCMonth() - months);
  return formatUtcCalendarDate(utc);
}

export function toReportDateRange(
  fromCalendar: string,
  toCalendar: string,
): ReportDateRange {
  const from = extractCalendarDate(fromCalendar);
  const to = extractCalendarDate(toCalendar);

  if (compareCalendarDates(from, to) > 0) {
    throw new BadRequestException("fromDate must be on or before toDate");
  }

  return {
    fromCalendar: from,
    toCalendar: to,
    fromDate: calendarDateToDbDate(from),
    toDate: calendarDateToDbDate(to),
    fromTimestamp: zonedDayStart(from),
    toTimestamp: zonedDayEnd(to),
  };
}

export function resolvePreviousMonthRange(
  range: ReportDateRange,
): ReportDateRange {
  return toReportDateRange(
    shiftCalendarDateBackMonths(range.fromCalendar, 1),
    shiftCalendarDateBackMonths(range.toCalendar, 1),
  );
}

function formatUtcCalendarDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
