import { BadRequestException } from "@nestjs/common";
import {
  calendarDateToDbDate,
  compareCalendarDates,
  extractCalendarDate,
  todayCalendarDate,
} from "../../common/utils/app-timezone.util";

/** Purchase date: today or any past date; no future dates (app timezone). */
export function parseAndValidatePurchaseDate(value: string): Date {
  const datePart = extractCalendarDate(value);
  const today = todayCalendarDate();

  if (compareCalendarDates(datePart, today) > 0) {
    throw new BadRequestException("Purchase date cannot be in the future");
  }

  return calendarDateToDbDate(datePart);
}
