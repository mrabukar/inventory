import { Module } from "@nestjs/common";
import { OrganizationsModule } from "../organizations/organizations.module";
import { OrganizationBrandingController } from "./organization-branding.controller";

@Module({
  imports: [OrganizationsModule],
  controllers: [OrganizationBrandingController],
})
export class OrganizationBrandingModule {}
