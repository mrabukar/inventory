import { Global, Module } from "@nestjs/common";
import { ObjectStorageService } from "./object-storage.service";
import { OrganizationLogoService } from "./organization-logo.service";

@Global()
@Module({
  providers: [ObjectStorageService, OrganizationLogoService],
  exports: [ObjectStorageService, OrganizationLogoService],
})
export class StorageModule {}
