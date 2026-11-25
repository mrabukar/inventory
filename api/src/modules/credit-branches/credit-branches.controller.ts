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
import { CreditBranchesService } from "./credit-branches.service";
import { BranchStatementQueryDto } from "./dto/branch-statement-query.dto";
import { CreateBranchReturnDto } from "./dto/create-branch-return.dto";
import { CreateCreditBranchDto } from "./dto/create-credit-branch.dto";
import { CreditedStockQueryDto } from "./dto/credited-stock-query.dto";
import { CreditStockDto } from "./dto/credit-stock.dto";
import { UpdateCreditBranchDto } from "./dto/update-credit-branch.dto";

@Controller("credit-branches")
export class CreditBranchesController {
  constructor(private readonly creditBranches: CreditBranchesService) {}

  @Get()
  @PageRead([
    "dashboard",
    "sales",
    "inventory",
    "financial",
    "customers",
    "invoices",
    "payments",
    "receivables",
    "purchases",
    "audit",
    "users",
    "sale-approvals",
    "branch-payments",
    "credit-branches",
  ])
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.creditBranches.findAll(user);
  }

  // Declared before ":id" so "stock-credits" is not read as a branch id.
  @Get("stock-credits")
  @PageRead(["purchases"])
  listCreditedStock(
    @Query() query: CreditedStockQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.creditBranches.listCreditedStock(query, user);
  }

  @Get(":id")
  @PageRead(["credit-branches", "dashboard"], UserRole.branch_manager)
  findOne(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.creditBranches.findOne(id, user);
  }

  @Get(":id/statement")
  @PageRead(["credit-branches"], UserRole.branch_manager)
  getStatement(
    @Param("id") id: string,
    @Query() query: BranchStatementQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.creditBranches.getStatement(id, query, user);
  }

  @Get(":id/credits")
  @PageRead(["credit-branches"])
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

  @Patch(":id")
  @Roles(UserRole.admin, UserRole.branch_manager)
  updateBranch(
    @Param("id") id: string,
    @Body() dto: UpdateCreditBranchDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.creditBranches.updateBranch(id, dto, user);
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
