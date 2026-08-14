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
import { CorrectPurchaseDto } from "./dto/correct-purchase.dto";
import { CreatePurchaseDto } from "./dto/create-purchase.dto";
import { CreatePurchaseBatchDto } from "./dto/create-purchase-batch.dto";
import { PurchaseQueryDto } from "./dto/purchase-query.dto";
import { PurchasesService } from "./purchases.service";

@Roles(UserRole.admin)
@Controller("purchases")
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  findAll(@Query() query: PurchaseQueryDto) {
    return this.purchasesService.findAll(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreatePurchaseDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.purchasesService.create(dto, user);
  }

  // "batch" must be declared before ":id" routes so it isn't misread as an id.
  @Post("batch")
  @HttpCode(HttpStatus.CREATED)
  createBatch(
    @Body() dto: CreatePurchaseBatchDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.purchasesService.createBatch(dto, user);
  }

  @Post(":id/correct/add")
  @HttpCode(HttpStatus.CREATED)
  correctAdd(
    @Param("id") id: string,
    @Body() dto: CorrectPurchaseDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.purchasesService.correctAdd(id, dto, user);
  }

  @Post(":id/correct/subtract")
  @HttpCode(HttpStatus.CREATED)
  correctSubtract(
    @Param("id") id: string,
    @Body() dto: CorrectPurchaseDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.purchasesService.correctSubtract(id, dto, user);
  }

  @Post(":id/correct")
  @HttpCode(HttpStatus.CREATED)
  correct(
    @Param("id") id: string,
    @Body() dto: CorrectPurchaseDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.purchasesService.correct(id, dto, user);
  }
}
