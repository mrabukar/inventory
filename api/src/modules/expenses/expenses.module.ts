import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ExpenseCategoriesModule } from "../expense-categories/expense-categories.module";
import { StoresModule } from "../stores/stores.module";
import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";

@Module({
  imports: [PrismaModule, ExpenseCategoriesModule, StoresModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}
