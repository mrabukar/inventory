import { Module } from "@nestjs/common";
import { PublicTenantController } from "./public-tenant.controller";

@Module({ controllers: [PublicTenantController] })
export class PublicTenantModule {}
