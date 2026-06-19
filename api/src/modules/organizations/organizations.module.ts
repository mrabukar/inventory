import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { StoresModule } from "../stores/stores.module";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";

@Module({
  imports: [PrismaModule, StoresModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
