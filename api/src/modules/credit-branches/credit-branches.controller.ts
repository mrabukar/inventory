import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CreditBranchesService } from "./credit-branches.service";
import { BranchStatementQueryDto } from "./dto/branch-statement-query.dto";
import { CreateBranchReturnDto } from "./dto/create-branch-return.dto";
import { CreateCreditBranchDto } from "./dto/create-credit-branch.dto";
import { CreditStockDto } from "./dto/credit-stock.dto";

@Controller("credit-branches")
export class CreditBranchesController {
  constructor(private readonly creditBranches: CreditBranchesService) {}

  @Get()
  @Roles(UserRole.admin)
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.creditBranches.findAll(user);
  }

  @Get(":id")
  @Roles(UserRole.admin, UserRole.branch_manager)
  findOne(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.creditBranches.findOne(id, user);
  }

  @Get(":id/statement")
  @Roles(UserRole.admin, UserRole.branch_manager)
  getStatement(
    @Param("id") id: string,
    @Query() query: BranchStatementQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.creditBranches.getStatement(id, query, user);
  }

  @Get(":id/credits")
  @Roles(UserRole.admin)
  listCredits(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.creditBranches.listCredits(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.admin)
  createBranch(
    @Body() dto: CreateCreditBranchDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.creditBranches.createBranch(dto, user);
  }

  @Post(":id/credits")
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.admin)
  creditStock(
    @Param("id") id: string,
    @Body() dto: CreditStockDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.creditBranches.creditStock(id, dto, user);
  }

  @Post(":id/returns")
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.admin)
  createReturn(
    @Param("id") id: string,
    @Body() dto: CreateBranchReturnDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.creditBranches.createReturn(id, dto, user);
  }
}
