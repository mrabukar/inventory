import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ProductsModule } from "../products/products.module";
import { StoresModule } from "../stores/stores.module";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";

@Module({
  imports: [PrismaModule, StoresModule, ProductsModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
