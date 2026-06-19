import type { ReportExportContext } from "./report-export.types";

export function buildExportMetaRows(
  context: ReportExportContext,
): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ["Organization", context.organizationName],
    ["Report", context.reportTitle],
    ["Period", `${context.periodFrom} to ${context.periodTo}`],
    ["Period timezone", context.periodTimezone],
    ["Store filter", context.storeName ?? "All stores"],
    ["Generated at", context.generatedAtLabel],
  ];

  if (context.categoryName) {
    rows.splice(5, 0, ["Category filter", context.categoryName]);
  }

  return rows;
}
