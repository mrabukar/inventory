import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { SaleLocationsController } from "./sale-locations.controller";
import { SaleLocationsService } from "./sale-locations.service";

@Module({
  imports: [PrismaModule],
  controllers: [SaleLocationsController],
  providers: [SaleLocationsService],
  exports: [SaleLocationsService],
})
export class SaleLocationsModule {}
