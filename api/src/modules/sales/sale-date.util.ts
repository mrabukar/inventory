import { BadRequestException } from "@nestjs/common";
import {
  calendarDateDaysAgo,
  calendarDateToDbDate,
  compareCalendarDates,
  extractCalendarDate,
  todayCalendarDate,
} from "../../common/utils/app-timezone.util";

/** Sale date: today or up to 7 days in the past; no future dates (app timezone). */
export function parseAndValidateSaleDate(value: string): Date {
  const datePart = extractCalendarDate(value);
  const today = todayCalendarDate();
  const minDate = calendarDateDaysAgo(7, today);

  if (compareCalendarDates(datePart, today) > 0) {
    throw new BadRequestException("Sale date cannot be in the future");
  }

  if (compareCalendarDates(datePart, minDate) < 0) {
    throw new BadRequestException(
      "Sale date cannot be more than 7 days in the past",
    );
  }

  return calendarDateToDbDate(datePart);
}
