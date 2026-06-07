import { Controller, Get, Query } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ReportQueryDto } from "./dto/report-query.dto";
import { ProductDistributionQueryDto } from "./dto/product-distribution-query.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("admin-dashboard")
  @Roles(UserRole.admin)
  getAdminDashboard(@Query() query: ReportQueryDto) {
    return this.reportsService.getAdminDashboard(query);
  }

  @Get("manager-dashboard")
  @Roles(UserRole.branch_manager)
  getManagerDashboard(@CurrentUser() user: CurrentUserPayload) {
    return this.reportsService.getManagerDashboard(user);
  }

  @Get("financial-summary")
  @Roles(UserRole.admin)
  getFinancialSummary(@Query() query: ReportQueryDto) {
    return this.reportsService.getFinancialSummary(query);
  }

  @Get("product-distribution")
  @Roles(UserRole.admin)
  getProductDistribution(@Query() query: ProductDistributionQueryDto) {
    return this.reportsService.getProductDistribution(query);
  }
}
