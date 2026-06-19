import { Controller, Get, Query, Res } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { Response } from "express";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ReportExportQueryDto } from "./dto/report-export-query.dto";
import { ReportQueryDto } from "./dto/report-query.dto";
import { ProductDistributionQueryDto } from "./dto/product-distribution-query.dto";
import { ReportExportService } from "./export/report-export.service";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportExportService: ReportExportService,
  ) {}

  @Get("admin-dashboard")
  @Roles(UserRole.admin)
  getAdminDashboard(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reportsService.getAdminDashboard(query, user);
  }

  @Get("manager-dashboard")
  @Roles(UserRole.branch_manager)
  getManagerDashboard(@CurrentUser() user: CurrentUserPayload) {
    return this.reportsService.getManagerDashboard(user);
  }

  @Get("financial-summary")
  @Roles(UserRole.admin, UserRole.branch_manager)
  getFinancialSummary(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reportsService.getFinancialSummary(query, user);
  }

  @Get("financial-summary/export")
  @Roles(UserRole.admin, UserRole.branch_manager)
  async exportFinancialSummary(
    @Query() query: ReportExportQueryDto,
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ) {
    const file = await this.reportExportService.exportFinancialSummary(
      query,
      user,
    );
    res.setHeader("Content-Type", file.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.buffer);
  }

  @Get("product-distribution")
  @Roles(UserRole.admin)
  getProductDistribution(
    @Query() query: ProductDistributionQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reportsService.getProductDistribution(query, user);
  }

  @Get("stock-report")
  @Roles(UserRole.admin, UserRole.branch_manager)
  getStockReport(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reportsService.getStockReport(query, user);
  }

  @Get("stock-report/export")
  @Roles(UserRole.admin, UserRole.branch_manager)
  async exportStockReport(
    @Query() query: ReportExportQueryDto,
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ) {
    const file = await this.reportExportService.exportStockReport(query, user);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.buffer);
  }
}
