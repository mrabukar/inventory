import { BadRequestException } from "@nestjs/common";
import {
  calendarDateToDbDate,
  compareCalendarDates,
  extractCalendarDate,
  todayCalendarDate,
} from "../../common/utils/app-timezone.util";

/** Expense date: today or past only; no future dates (app timezone). */
export function parseAndValidateExpenseDate(value: string): Date {
  const datePart = extractCalendarDate(value);
  const today = todayCalendarDate();

  if (compareCalendarDates(datePart, today) > 0) {
    throw new BadRequestException("Expense date cannot be in the future");
  }

  return calendarDateToDbDate(datePart);
}
