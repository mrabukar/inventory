import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { PageRead } from "../../common/decorators/page-access.decorator";
import { InventoryAlertQueryDto } from "./dto/inventory-alert-query.dto";
import { InventoryQueryDto } from "./dto/inventory-query.dto";
import { UpdateInventoryThresholdDto } from "./dto/update-inventory-threshold.dto";
import { WarehouseStockWriteOffDto } from "./dto/warehouse-stock-write-off.dto";
import { InventoryService } from "./inventory.service";

@Roles(UserRole.admin, UserRole.branch_manager)
@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get("warehouse")
  @PageRead(["warehouse", "purchases", "inventory"])
  findWarehouse(
    @Query() query: InventoryQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inventoryService.findWarehouse(query, user);
  }

  @Post("warehouse/write-off")
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  writeOffWarehouseStock(
    @Body() dto: WarehouseStockWriteOffDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inventoryService.writeOffWarehouseStock(dto, user);
  }

  @Get("low-stock")
  @PageRead(["dashboard", "inventory"], UserRole.branch_manager)
  findLowStock(
    @Query() query: InventoryAlertQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inventoryService.findLowStock(query, user);
  }

  @Get("out-of-stock")
  @PageRead(["dashboard", "inventory"], UserRole.branch_manager)
  findOutOfStock(
    @Query() query: InventoryAlertQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inventoryService.findOutOfStock(query, user);
  }

  @Get()
  @PageRead(["inventory", "warehouse", "purchases", "dashboard"], UserRole.branch_manager)
  findAll(
    @Query() query: InventoryQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inventoryService.findAll(query, user);
  }

  @Get("stores/:storeId/products/:productId")
  @PageRead(["inventory"], UserRole.branch_manager)
  findOne(
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inventoryService.findOne(storeId, productId, user);
  }

  @Get("stores/:storeId")
  @PageRead(["inventory"], UserRole.branch_manager)
  findByStore(
    @Param("storeId") storeId: string,
    @Query() query: InventoryQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inventoryService.findByStore(storeId, query, user);
  }

  @Patch("stores/:storeId/products/:productId/threshold")
  @Roles(UserRole.admin)
  updateLowStockThreshold(
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
    @Body() dto: UpdateInventoryThresholdDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inventoryService.updateLowStockThreshold(
      storeId,
      productId,
      dto.lowStockThreshold,
      user,
    );
  }
}
