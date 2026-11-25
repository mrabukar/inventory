import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { CorrectSaleDto } from "./dto/correct-sale.dto";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { RejectSaleDto } from "./dto/reject-sale.dto";
import { SaleQueryDto } from "./dto/sale-query.dto";
import { SalesService } from "./sales.service";

@Controller("sales")
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @PageRead(["sales", "sale-approvals"], UserRole.branch_manager)
  findAll(
    @Query() query: SaleQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.salesService.findAll(query, user);
  }

  @Get("pending-count")
  @PageRead(["sale-approvals"])
  pendingCount(@CurrentUser() user: CurrentUserPayload) {
    return this.salesService.countPending(user);
  }

  @Get(":id")
  @PageRead(["sales", "sale-approvals", "invoices"], UserRole.branch_manager)
  findOne(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.salesService.findOne(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.branch_manager, UserRole.admin)
  create(@Body() dto: CreateSaleDto, @CurrentUser() user: CurrentUserPayload) {
    return this.salesService.create(dto, user);
  }

  @Patch(":id/correct")
  @Roles(UserRole.branch_manager, UserRole.admin)
  correct(
    @Param("id") id: string,
    @Body() dto: CorrectSaleDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.salesService.correct(id, dto, user);
  }

  @Patch(":id/approve")
  @Roles(UserRole.admin)
  approve(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.salesService.approve(id, user);
  }

  @Patch(":id/reject")
  @Roles(UserRole.admin)
  reject(
    @Param("id") id: string,
    @Body() dto: RejectSaleDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.salesService.reject(id, dto, user);
  }
}
