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
import { CorrectSaleDto } from "./dto/correct-sale.dto";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { SaleQueryDto } from "./dto/sale-query.dto";
import { SalesService } from "./sales.service";

@Controller("sales")
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @Roles(UserRole.admin, UserRole.branch_manager)
  findAll(
    @Query() query: SaleQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.salesService.findAll(query, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.branch_manager)
  create(@Body() dto: CreateSaleDto, @CurrentUser() user: CurrentUserPayload) {
    return this.salesService.create(dto, user);
  }

  @Patch(":id/correct")
  @Roles(UserRole.branch_manager)
  correct(
    @Param("id") id: string,
    @Body() dto: CorrectSaleDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.salesService.correct(id, dto, user);
  }
}
