import { format, parse } from "date-fns";

export const APP_TIMEZONE = "Africa/Mogadishu";

export function ymdToDate(ymd: string): Date {
  return parse(ymd, "yyyy-MM-dd", new Date());
}

export function dateToYmd(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

interface CalendarParts {
  year: number;
  month: number;
  day: number;
}

function getCalendarParts(date = new Date(), timeZone = APP_TIMEZONE): CalendarParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  return { year, month, day };
}

export function toYmd(
  year: number,
  month: number,
  day: number,
): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function todayYmd(timeZone = APP_TIMEZONE): string {
  const { year, month, day } = getCalendarParts(new Date(), timeZone);
  return toYmd(year, month, day);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getLast7DaysRange(timeZone = APP_TIMEZONE): {
  fromDate: string;
  toDate: string;
} {
  const { year, month, day } = getCalendarParts(new Date(), timeZone);
  const end = new Date(year, month - 1, day);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  return {
    fromDate: toYmd(start.getFullYear(), start.getMonth() + 1, start.getDate()),
    toDate: toYmd(year, month, day),
  };
}

export function getLast30DaysRange(timeZone = APP_TIMEZONE): {
  fromDate: string;
  toDate: string;
} {
  const { year, month, day } = getCalendarParts(new Date(), timeZone);
  const end = new Date(year, month - 1, day);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);

  return {
    fromDate: toYmd(start.getFullYear(), start.getMonth() + 1, start.getDate()),
    toDate: toYmd(year, month, day),
  };
}

export function getCurrentMonthRange(timeZone = APP_TIMEZONE): {
  fromDate: string;
  toDate: string;
} {
  const { year, month, day } = getCalendarParts(new Date(), timeZone);
  return {
    fromDate: toYmd(year, month, 1),
    toDate: toYmd(year, month, day),
  };
}

export function getCurrentMonthLabel(timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
  }).format(new Date());
}

export function getLastMonthRange(timeZone = APP_TIMEZONE): {
  fromDate: string;
  toDate: string;
} {
  const { year, month } = getCalendarParts(new Date(), timeZone);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const lastDay = daysInMonth(prevYear, prevMonth);

  return {
    fromDate: toYmd(prevYear, prevMonth, 1),
    toDate: toYmd(prevYear, prevMonth, lastDay),
  };
}

export function getLastSixMonthsRange(timeZone = APP_TIMEZONE): {
  fromDate: string;
  toDate: string;
} {
  const { year, month, day } = getCalendarParts(new Date(), timeZone);
  let fromMonth = month - 5;
  let fromYear = year;

  while (fromMonth <= 0) {
    fromMonth += 12;
    fromYear -= 1;
  }

  return {
    fromDate: toYmd(fromYear, fromMonth, 1),
    toDate: toYmd(year, month, day),
  };
}

export function formatPeriodLabel(fromDate: string, toDate: string): string {
  const format = (ymd: string) => {
    const [year, month, day] = ymd.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(year, month - 1, day));
  };

  return `${format(fromDate)} → ${format(toDate)}`;
}

export function formatDisplayDate(iso: string, timeZone = APP_TIMEZONE): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function isSameRange(
  a: { fromDate: string; toDate: string },
  b: { fromDate: string; toDate: string },
): boolean {
  return a.fromDate === b.fromDate && a.toDate === b.toDate;
}
