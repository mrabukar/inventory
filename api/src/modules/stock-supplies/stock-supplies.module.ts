import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ProductsModule } from "../products/products.module";
import { StoresModule } from "../stores/stores.module";
import { StockSuppliesController } from "./stock-supplies.controller";
import { StockSuppliesService } from "./stock-supplies.service";

@Module({
  imports: [PrismaModule, StoresModule, ProductsModule],
  controllers: [StockSuppliesController],
  providers: [StockSuppliesService],
  exports: [StockSuppliesService],
})
export class StockSuppliesModule {}
