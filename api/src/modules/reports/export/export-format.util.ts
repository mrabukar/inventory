import { BadRequestException } from "@nestjs/common";
import { DateTime, IANAZone } from "luxon";
import { getAppTimezone } from "../../../common/utils/app-timezone.util";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatExportMoney(value: number): string {
  if (!Number.isFinite(value)) {
    return "$0.00";
  }
  return `$${moneyFormatter.format(value)}`;
}

export function formatExportNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return value.toLocaleString("en-US");
}

export function buildExportFilename(
  slug: string,
  periodFrom: string,
  periodTo: string,
  extension: string,
): string {
  return `${slug}_${periodFrom}_${periodTo}.${extension}`;
}

export function resolveExportTimezone(input?: string): string {
  const timezone = input?.trim() || getAppTimezone();
  if (!IANAZone.isValidZone(timezone)) {
    throw new BadRequestException("Invalid timezone");
  }
  return timezone;
}

export function formatGeneratedAt(timezone: string): string {
  return DateTime.now().setZone(timezone).toFormat("ccc, dd LLL yyyy HH:mm ZZZZ");
}
