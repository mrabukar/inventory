import { Controller, Get, Param, Query } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { InvoiceQueryDto } from "./dto/invoice-query.dto";
import { InvoicesService } from "./invoices.service";

@Roles(UserRole.admin, UserRole.branch_manager)
@Controller("invoices")
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  findAll(
    @Query() query: InvoiceQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.invoicesService.findAll(query, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.invoicesService.findOne(id, user);
  }
}
