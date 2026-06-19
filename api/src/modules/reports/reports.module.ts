import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { StoresModule } from "../stores/stores.module";
import { ReportExportService } from "./export/report-export.service";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [PrismaModule, StoresModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportExportService],
})
export class ReportsModule {}
