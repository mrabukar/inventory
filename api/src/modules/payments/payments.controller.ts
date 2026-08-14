import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaymentQueryDto } from "./dto/payment-query.dto";
import { PaymentsService } from "./payments.service";

@Roles(UserRole.admin, UserRole.branch_manager)
@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  findAll(
    @Query() query: PaymentQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.paymentsService.findAll(query, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.paymentsService.create(dto, user);
  }
}
