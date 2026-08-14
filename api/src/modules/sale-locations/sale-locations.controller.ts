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
import { CreateSaleLocationDto } from "./dto/create-sale-location.dto";
import { UpdateSaleLocationDto } from "./dto/update-sale-location.dto";
import { SaleLocationsService } from "./sale-locations.service";

@Roles(UserRole.admin)
@Controller("sale-locations")
export class SaleLocationsController {
  constructor(private readonly saleLocationsService: SaleLocationsService) {}

  @Get()
  findAll(
    @Query("includeInactive") includeInactive: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.saleLocationsService.findAll(includeInactive === "true", user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateSaleLocationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.saleLocationsService.create(dto, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateSaleLocationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.saleLocationsService.update(id, dto, user);
  }
}
