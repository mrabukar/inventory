import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { PageRead } from "../../common/decorators/page-access.decorator";
import { BranchPaymentsService } from "./branch-payments.service";
import { BranchPaymentQueryDto } from "./dto/branch-payment-query.dto";
import { RejectBranchPaymentDto } from "./dto/reject-branch-payment.dto";
import { SubmitBranchPaymentDto } from "./dto/submit-branch-payment.dto";

@Controller("branch-payments")
export class BranchPaymentsController {
  constructor(private readonly branchPayments: BranchPaymentsService) {}

  @Get()
  @PageRead(["branch-payments"], UserRole.branch_manager)
  findAll(
    @Query() query: BranchPaymentQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.branchPayments.findAll(query, user);
  }

  @Get("pending-count")
  @PageRead(["branch-payments", "credit-branches"])
  pendingCount(@CurrentUser() user: CurrentUserPayload) {
    return this.branchPayments.countPending(user);
  }

  @Post()
  @Roles(UserRole.branch_manager)
  submit(
    @Body() dto: SubmitBranchPaymentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.branchPayments.submit(dto, user);
  }

  @Patch(":id/approve")
  @Roles(UserRole.admin)
  approve(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.branchPayments.approve(id, user);
  }

  @Patch(":id/reject")
  @Roles(UserRole.admin)
  reject(
    @Param("id") id: string,
    @Body() dto: RejectBranchPaymentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.branchPayments.reject(id, dto, user);
  }
}
