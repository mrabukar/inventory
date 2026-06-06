import { Controller, Get, Param, Query } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { InventoryQueryDto } from "./dto/inventory-query.dto";
import { InventoryService } from "./inventory.service";

@Roles(UserRole.admin, UserRole.branch_manager)
@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get("stores/:storeId/products/:productId")
  findOne(
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inventoryService.findOne(storeId, productId, user);
  }

  @Get("stores/:storeId")
  findByStore(
    @Param("storeId") storeId: string,
    @Query() query: InventoryQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inventoryService.findByStore(storeId, query, user);
  }
}
