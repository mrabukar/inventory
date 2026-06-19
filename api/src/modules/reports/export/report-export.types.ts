export interface ExportFileResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

export interface ReportExportContext {
  organizationName: string;
  storeName: string | null;
  categoryName: string | null;
  reportTitle: string;
  periodFrom: string;
  periodTo: string;
  periodTimezone: string;
  generatedAtLabel: string;
  logoDataUrl: string | null;
  logoAspectRatio: number | null;
}

export interface ReportPeriodInfo {
  from: string;
  to: string;
  timezone: string;
}
