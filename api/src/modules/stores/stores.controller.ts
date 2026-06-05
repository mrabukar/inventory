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
import {
  ApiCookieAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { SESSION_COOKIE_NAME } from "../auth/auth.constants";
import { Roles } from "../../common/decorators/roles.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { CreateStoreDto } from "./dto/create-store.dto";
import { StoresService } from "./stores.service";

@ApiTags("Stores")
@ApiCookieAuth(SESSION_COOKIE_NAME)
@Controller("stores")
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  @Roles(UserRole.admin)
  @ApiOperation({ summary: "List all active stores (admin only)" })
  @ApiOkResponse({
    description: "Paginated list of stores",
    schema: {
      example: {
        data: [
          {
            id: "clx...",
            name: "Main Branch",
            address: "123 Main St, Hargeisa",
            isActive: true,
            createdAt: "2026-06-05T00:00:00.000Z",
            updatedAt: "2026-06-05T00:00:00.000Z",
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: "Not authenticated" })
  @ApiForbiddenResponse({ description: "Admin role required" })
  findAll(@Query() query: PaginationQueryDto) {
    return this.storesService.findAll(query);
  }

  @Get(":id")
  @Roles(UserRole.admin)
  @ApiOperation({ summary: "Get a store by ID (admin only)" })
  @ApiOkResponse({
    description: "Store found",
    schema: {
      example: {
        id: "clx...",
        name: "Main Branch",
        address: "123 Main St, Hargeisa",
        isActive: true,
        createdAt: "2026-06-05T00:00:00.000Z",
        updatedAt: "2026-06-05T00:00:00.000Z",
      },
    },
  })
  @ApiNotFoundResponse({ description: "Store not found" })
  @ApiUnauthorizedResponse({ description: "Not authenticated" })
  @ApiForbiddenResponse({ description: "Admin role required" })
  findOne(@Param("id") id: string) {
    return this.storesService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: "Create a new store (admin only)" })
  @ApiCreatedResponse({
    description: "Store created successfully",
    schema: {
      example: {
        id: "clx...",
        name: "Main Branch",
        address: "123 Main St, Hargeisa",
        isActive: true,
        createdAt: "2026-06-05T00:00:00.000Z",
        updatedAt: "2026-06-05T00:00:00.000Z",
      },
    },
  })
  @ApiConflictResponse({ description: "A store with this name already exists" })
  @ApiUnauthorizedResponse({ description: "Not authenticated" })
  @ApiForbiddenResponse({ description: "Admin role required" })
  create(@Body() dto: CreateStoreDto) {
    console.log("dto body:", dto);
    return this.storesService.create(dto);
  }
}
