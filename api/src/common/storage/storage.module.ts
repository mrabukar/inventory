import { Global, Module } from "@nestjs/common";
import { ObjectStorageService } from "./object-storage.service";
import { OrganizationLogoService } from "./organization-logo.service";
import { OrganizationStampService } from "./organization-stamp.service";

@Global()
@Module({
  providers: [
    ObjectStorageService,
    OrganizationLogoService,
    OrganizationStampService,
  ],
  exports: [
    ObjectStorageService,
    OrganizationLogoService,
    OrganizationStampService,
  ],
})
export class StorageModule {}
