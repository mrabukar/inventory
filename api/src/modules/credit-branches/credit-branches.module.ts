import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ProductsModule } from "../products/products.module";
import { StoresModule } from "../stores/stores.module";
import { CreditBranchesController } from "./credit-branches.controller";
import { CreditBranchesService } from "./credit-branches.service";

@Module({
  imports: [PrismaModule, ProductsModule, StoresModule],
  controllers: [CreditBranchesController],
  providers: [CreditBranchesService],
  exports: [CreditBranchesService],
})
export class CreditBranchesModule {}
