import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { UsersModule } from "../users/users.module";
import { StoresModule } from "../stores/stores.module";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsLogoController } from "./organizations-logo.controller";
import { OrganizationsService } from "./organizations.service";

@Module({
  imports: [PrismaModule, StoresModule, UsersModule],
  controllers: [OrganizationsController, OrganizationsLogoController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
