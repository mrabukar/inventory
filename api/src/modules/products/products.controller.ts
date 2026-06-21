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
import { CreateProductDto } from "./dto/create-product.dto";
import { DeactivateProductDto } from "./dto/deactivate-product.dto";
import { ProductQueryDto } from "./dto/product-query.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { SetOpeningCostDto } from "../purchases/dto/set-opening-cost.dto";
import { ProductsService } from "./products.service";
import { PurchasesService } from "../purchases/purchases.service";
import { PurchaseQueryDto } from "../purchases/dto/purchase-query.dto";

@Roles(UserRole.admin)
@Controller("products")
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly purchasesService: PurchasesService,
  ) {}

  @Get()
  findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get(":id/purchases")
  findPurchases(@Param("id") id: string, @Query() query: PurchaseQueryDto) {
    return this.purchasesService.findByProduct(id, query);
  }

  @Post(":id/opening-cost")
  @HttpCode(HttpStatus.CREATED)
  recordOpeningCost(
    @Param("id") id: string,
    @Body() dto: SetOpeningCostDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.purchasesService.recordOpeningCost(id, dto, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.productsService.create(dto, user);
  }

  @Patch(":id/deactivate")
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(
    @Param("id") id: string,
    @Body() dto: DeactivateProductDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.productsService.deactivate(id, dto, user);
  }

  @Patch(":id/reactivate")
  reactivate(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.productsService.reactivate(id, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.productsService.update(id, dto, user);
  }
}
