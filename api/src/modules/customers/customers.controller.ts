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
import { CustomersService } from "./customers.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { CustomerQueryDto } from "./dto/customer-query.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

@Roles(UserRole.admin)
@Controller("customers")
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles(UserRole.admin, UserRole.branch_manager)
  findAll(@Query() query: CustomerQueryDto) {
    return this.customersService.findAll(query);
  }

  @Get("receivables")
  receivables(@CurrentUser() user: CurrentUserPayload) {
    return this.customersService.getReceivables(user);
  }

  @Get(":id/balance")
  balance(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.customersService.getBalance(id, user);
  }

  @Get(":id/statement")
  statement(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.customersService.getStatement(id, user);
  }

  @Get(":id")
  @Roles(UserRole.admin, UserRole.branch_manager)
  findOne(@Param("id") id: string) {
    return this.customersService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.customersService.create(dto, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.customersService.update(id, dto, user);
  }
}
