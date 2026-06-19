import { Injectable } from "@nestjs/common";
import sharp from "sharp";
import { CurrentUserPayload } from "../../../common/decorators/current-user.decorator";
import { OrganizationLogoService } from "../../../common/storage/organization-logo.service";
import { TenantStoreResolver } from "../../../common/tenant/tenant-store-resolver.service";
import { requireOrganizationId } from "../../../common/utils/require-organization-id.util";
import { PrismaService } from "../../../prisma/prisma.service";
import { ReportExportQueryDto } from "../dto/report-export-query.dto";
import { ReportsService } from "../reports.service";
import {
  formatGeneratedAt,
  resolveExportTimezone,
} from "./export-format.util";
import {
  buildFinancialExcel,
  buildFinancialPdf,
} from "./financial-export.builder";
import type { ExportFileResult, ReportExportContext, ReportPeriodInfo } from "./report-export.types";
import { buildStockExcel, buildStockPdf } from "./stock-export.builder";
import { logReportExport } from "./report-export-audit.util";

@Injectable()
export class ReportExportService {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly prisma: PrismaService,
    private readonly tenantStoreResolver: TenantStoreResolver,
    private readonly organizationLogo: OrganizationLogoService,
  ) {}

  async exportFinancialSummary(
    query: ReportExportQueryDto,
    user: CurrentUserPayload,
  ): Promise<ExportFileResult> {
    const data = await this.reportsService.getFinancialSummary(query, user);
    const context = await this.buildContext(
      user,
      query,
      {
        from: data.period.from,
        to: data.period.to,
        timezone: data.period.timezone,
      },
      "Financial Summary",
    );

    const file =
      query.format === "pdf"
        ? await buildFinancialPdf(data, context)
        : await buildFinancialExcel(data, context);

    await logReportExport(
      this.prisma,
      user,
      query,
      "financial-summary",
      file,
    );

    return file;
  }

  async exportStockReport(
    query: ReportExportQueryDto,
    user: CurrentUserPayload,
  ): Promise<ExportFileResult> {
    const data = await this.reportsService.getStockReport(query, user);
    const context = await this.buildContext(
      user,
      query,
      {
        from: data.period.from,
        to: data.period.to,
        timezone: data.period.timezone,
      },
      "Stock Report",
    );

    const file =
      query.format === "pdf"
        ? await buildStockPdf(data, context)
        : await buildStockExcel(data, context);

    await logReportExport(this.prisma, user, query, "stock-report", file);

    return file;
  }

  private async buildContext(
    user: CurrentUserPayload,
    query: ReportExportQueryDto,
    period: ReportPeriodInfo,
    reportTitle: string,
  ): Promise<ReportExportContext> {
    const organizationId = requireOrganizationId(user);
    const exportTimezone = resolveExportTimezone(query.timezone);
    const storeId = await this.tenantStoreResolver.resolveStoreFilter(
      user,
      query.storeId,
    );

    const [organization, store, category, logo] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      }),
      storeId
        ? this.prisma.store.findFirst({
            where: { id: storeId, organizationId },
            select: { name: true },
          })
        : Promise.resolve(null),
      query.categoryId
        ? this.prisma.category.findFirst({
            where: { id: query.categoryId, organizationId },
            select: { name: true },
          })
        : Promise.resolve(null),
      this.organizationLogo.getLogoBytesByOrganizationId(organizationId),
    ]);

    let logoDataUrl: string | null = null;
    let logoAspectRatio: number | null = null;

    if (logo) {
      const metadata = await sharp(logo.buffer).metadata();
      logoDataUrl = `data:${logo.contentType};base64,${logo.buffer.toString("base64")}`;
      if (metadata.width && metadata.height) {
        logoAspectRatio = metadata.width / metadata.height;
      }
    }

    return {
      organizationName: organization?.name ?? "Organization",
      storeName: store?.name ?? null,
      categoryName: category?.name ?? null,
      reportTitle,
      periodFrom: period.from,
      periodTo: period.to,
      periodTimezone: period.timezone,
      generatedAtLabel: formatGeneratedAt(exportTimezone),
      logoDataUrl,
      logoAspectRatio,
    };
  }
}
