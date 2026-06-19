import { Module } from "@nestjs/common";
import { OrganizationBrandingController } from "./organization-branding.controller";

@Module({
  controllers: [OrganizationBrandingController],
})
export class OrganizationBrandingModule {}
