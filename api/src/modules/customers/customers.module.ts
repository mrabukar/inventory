import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { PaymentsModule } from "../payments/payments.module";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
