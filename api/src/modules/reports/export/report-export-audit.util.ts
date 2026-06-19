import { AuditAction, Prisma } from "@prisma/client";
import type { CurrentUserPayload } from "../../../common/decorators/current-user.decorator";
import { requireOrganizationId } from "../../../common/utils/require-organization-id.util";
import { PrismaService } from "../../../prisma/prisma.service";
import type { ReportExportQueryDto } from "../dto/report-export-query.dto";
import type { ExportFileResult } from "./report-export.types";

export type ReportExportSlug = "financial-summary" | "stock-report";

export async function logReportExport(
  prisma: PrismaService,
  user: CurrentUserPayload,
  query: ReportExportQueryDto,
  report: ReportExportSlug,
  file: ExportFileResult,
): Promise<void> {
  const organizationId = requireOrganizationId(user);

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      organizationId,
      action: AuditAction.REPORT_EXPORTED,
      entityType: "report",
      entityId: report,
      oldValue: Prisma.JsonNull,
      newValue: {
        report,
        format: query.format,
        fromDate: query.fromDate ?? null,
        toDate: query.toDate ?? null,
        storeId: query.storeId ?? null,
        categoryId: query.categoryId ?? null,
        timezone: query.timezone ?? null,
        filename: file.filename,
      },
    },
  });
}
