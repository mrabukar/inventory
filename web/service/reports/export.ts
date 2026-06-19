import { ApiError } from "@/service/client";
import type { ReportQuery } from "@/types/reports/query";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ReportExportKind = "financial-summary" | "stock-report";
export type ReportExportFormat = "xlsx" | "pdf";

function parseFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;

  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const match = /filename="([^"]+)"/i.exec(contentDisposition);
  return match?.[1] ?? null;
}

function toQueryString(
  params: ReportQuery,
  format: ReportExportFormat,
): string {
  const search = new URLSearchParams();
  search.set("format", format);
  search.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
  search.set("fromDate", params.fromDate);
  search.set("toDate", params.toDate);
  if (params.storeId) search.set("storeId", params.storeId);
  if (params.categoryId != null) {
    search.set("categoryId", String(params.categoryId));
  }
  return search.toString();
}

export async function downloadReportExport(
  report: ReportExportKind,
  format: ReportExportFormat,
  params: ReportQuery,
): Promise<void> {
  const query = toQueryString(params, format);
  const res = await fetch(`${API_URL}/api/reports/${report}/export?${query}`, {
    credentials: "include",
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as {
        message?: string | string[];
        error?: string;
      };
      const raw = body.message ?? body.error;
      message = Array.isArray(raw) ? raw.join(", ") : (raw ?? message);
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(res.status, message);
  }

  const blob = await res.blob();
  const filename =
    parseFilename(res.headers.get("Content-Disposition")) ??
    `${report}.${format === "xlsx" ? "xlsx" : "pdf"}`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
