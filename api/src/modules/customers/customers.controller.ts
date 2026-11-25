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
import { CustomersService } from "./customers.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { ReceivablesQueryDto } from "./dto/receivables-query.dto";
import { CustomerQueryDto } from "./dto/customer-query.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

@Roles(UserRole.admin)
@Controller("customers")
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @PageRead(
    ["customers", "payments", "invoices", "receivables"],
    UserRole.branch_manager,
  )
  findAll(
    @Query() query: CustomerQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.customersService.findAll(query, user);
  }

  @Get("receivables")
  @PageRead(["receivables", "payments", "dashboard"], UserRole.branch_manager)
  receivables(
    @Query() query: ReceivablesQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.customersService.getReceivables(user, query);
  }

  @Get(":id/balance")
  @PageRead(["customers", "payments"], UserRole.branch_manager)
  balance(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.customersService.getBalance(id, user);
  }

  @Get(":id/statement")
  @PageRead(["customers"], UserRole.branch_manager)
  statement(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.customersService.getStatement(id, user);
  }

  @Get(":id")
  @PageRead(["customers", "payments", "invoices"], UserRole.branch_manager)
  findOne(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.customersService.findOneFor(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.admin, UserRole.branch_manager)
  create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.customersService.create(dto, user);
  }

  @Patch(":id")
  @Roles(UserRole.admin, UserRole.branch_manager)
  update(
    @Param("id") id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.customersService.update(id, dto, user);
  }
}
