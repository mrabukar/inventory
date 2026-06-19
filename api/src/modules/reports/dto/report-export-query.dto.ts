import { IsIn, IsOptional, IsString } from "class-validator";
import { ReportQueryDto } from "./report-query.dto";

export const REPORT_EXPORT_FORMATS = ["xlsx", "pdf"] as const;
export type ReportExportFormat = (typeof REPORT_EXPORT_FORMATS)[number];

export class ReportExportQueryDto extends ReportQueryDto {
  @IsIn(REPORT_EXPORT_FORMATS)
  format!: ReportExportFormat;

  @IsOptional()
  @IsString()
  timezone?: string;
}
