import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { BranchPaymentsController } from "./branch-payments.controller";
import { BranchPaymentsService } from "./branch-payments.service";

@Module({
  imports: [PrismaModule],
  controllers: [BranchPaymentsController],
  providers: [BranchPaymentsService],
  exports: [BranchPaymentsService],
})
export class BranchPaymentsModule {}
