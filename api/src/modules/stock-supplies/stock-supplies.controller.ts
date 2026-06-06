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
import { CreateStockCorrectionDto } from "./dto/create-stock-correction.dto";
import { CreateStockSupplyDto } from "./dto/create-stock-supply.dto";
import { StockSupplyQueryDto } from "./dto/stock-supply-query.dto";
import { StockSuppliesService } from "./stock-supplies.service";

@Roles(UserRole.admin)
@Controller("stock-supplies")
export class StockSuppliesController {
  constructor(private readonly stockSuppliesService: StockSuppliesService) {}

  @Get()
  findAll(@Query() query: StockSupplyQueryDto) {
    return this.stockSuppliesService.findAll(query);
  }

  @Post("corrections/add")
  @HttpCode(HttpStatus.CREATED)
  correctionAdd(
    @Body() dto: CreateStockCorrectionDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.stockSuppliesService.correctionAdd(dto, user);
  }

  @Post("corrections/subtract")
  @HttpCode(HttpStatus.CREATED)
  correctionSubtract(
    @Body() dto: CreateStockCorrectionDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.stockSuppliesService.correctionSubtract(dto, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateStockSupplyDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.stockSuppliesService.create(dto, user);
  }
}
