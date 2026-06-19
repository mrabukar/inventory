import { Module } from "@nestjs/common";
import { TenantStoreResolver } from "../../common/tenant/tenant-store-resolver.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { StoresController } from "./stores.controller";
import { StoresService } from "./stores.service";

@Module({
  imports: [PrismaModule],
  controllers: [StoresController],
  providers: [StoresService, TenantStoreResolver],
  exports: [StoresService, TenantStoreResolver],
})
export class StoresModule {}
