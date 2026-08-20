import { Global, Module } from "@nestjs/common";
import { ObjectStorageService } from "./object-storage.service";
import { OrganizationLogoService } from "./organization-logo.service";
import { OrganizationSignatureService } from "./organization-signature.service";
import { OrganizationStampService } from "./organization-stamp.service";

@Global()
@Module({
  providers: [
    ObjectStorageService,
    OrganizationLogoService,
    OrganizationStampService,
    OrganizationSignatureService,
  ],
  exports: [
    ObjectStorageService,
    OrganizationLogoService,
    OrganizationStampService,
    OrganizationSignatureService,
  ],
})
export class StorageModule {}
