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
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { CreateStoreDto } from "./dto/create-store.dto";
import { StoreQueryDto } from "./dto/store-query.dto";
import { UpdateStoreDto } from "./dto/update-store.dto";
import { StoresService } from "./stores.service";

@Roles(UserRole.admin)
@Controller("stores")
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  findAll(@Query() query: StoreQueryDto) {
    return this.storesService.findAll(query);
  }

  @Get("warehouse")
  getWarehouse(@CurrentUser() user: CurrentUserPayload) {
    const organizationId = requireOrganizationId(user);
    return this.storesService.ensureOrgWarehouse(organizationId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.storesService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateStoreDto, @CurrentUser() user: CurrentUserPayload) {
    return this.storesService.create(dto, user);
  }

  @Patch(":id/deactivate")
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.storesService.deactivate(id, user);
  }

  @Patch(":id/reactivate")
  reactivate(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.storesService.reactivate(id, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateStoreDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.storesService.update(id, dto, user);
  }
}
