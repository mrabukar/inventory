import { Prisma } from "@prisma/client";
import { extractCalendarDate } from "./app-timezone.util";

/** Validated `YYYY-MM-DD` for PostgreSQL `::date` casts in `$queryRaw`. */
export function toSqlCalendarDate(calendarDate: string): string {
  return extractCalendarDate(calendarDate);
}

/**
 * Inclusive calendar-date bounds for PostgreSQL `date` columns in `$queryRaw`.
 * Use instead of JS `Date` values from `calendarDateToDbDate()` — noon UTC timestamps
 * exclude rows on the range start day when compared to `DATE` columns.
 */
export function sqlInclusiveDateRange(
  column: Prisma.Sql,
  fromCalendar: string,
  toCalendar: string,
): Prisma.Sql {
  const from = toSqlCalendarDate(fromCalendar);
  const to = toSqlCalendarDate(toCalendar);

  return Prisma.join(
    [Prisma.sql`${column} >= ${from}::date`, Prisma.sql`${column} <= ${to}::date`],
    " AND ",
  );
}
