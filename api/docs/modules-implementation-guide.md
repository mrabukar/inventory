# NestJS Modules Implementation Guide

This document defines the exact conventions, patterns, and rules to follow when building every domain module in this API. All modules must follow this guide to stay consistent.

---

## Table of Contents

1. [Stack & Global Setup](#1-stack--global-setup)
2. [Shared Infrastructure (build once, reuse everywhere)](#2-shared-infrastructure-build-once-reuse-everywhere)
3. [Module File Structure](#3-module-file-structure)
4. [Step-by-Step: Building a Module](#4-step-by-step-building-a-module)
5. [DTO Conventions](#5-dto-conventions)
6. [Controller Conventions](#6-controller-conventions)
7. [Service Conventions](#7-service-conventions)
8. [Auth, Roles & Current User](#8-auth-roles--current-user)
9. [Error Handling](#9-error-handling)
10. [Audit Logging](#10-audit-logging)
11. [Soft Delete](#11-soft-delete)
12. [Pagination](#12-pagination)
13. [Registering a Module in AppModule](#13-registering-a-module-in-appmodule)
14. [Module Build Order](#14-module-build-order)

---

## 1. Stack & Global Setup

| Concern | Tool |
|---|---|
| Framework | NestJS 11, TypeScript |
| Database ORM | Prisma 6 (`PrismaService` extends `PrismaClient`) |
| Auth | `@thallesp/nestjs-better-auth` — cookie-based sessions |
| Auth guard | Global `BetterAuthGuard` — all routes protected by default |
| Rate limiting | Global `ThrottlerGuard` — 100 req/min |
| Validation | `class-validator` + `class-transformer` |
| API docs | `@nestjs/swagger` — available at `/api/docs` |
| Logging | `nestjs-pino` — structured JSON |

**Key global behaviours:**
- Every route requires a valid session **by default** — opt out with `@AllowAnonymous()`
- Rate limiting applies to every route **by default** — opt out with `@SkipThrottle()`
- Validation pipe is global — DTOs with `class-validator` decorators are validated automatically
- Cookie name for Swagger auth: `better-auth.session_token`

---

## 2. Shared Infrastructure (build once, reuse everywhere)

Before building any domain module, create these shared files. They are used across all modules.

### 2.1 `@CurrentUser()` param decorator

**File:** `src/common/decorators/current-user.decorator.ts`

Extracts the authenticated user from the better-auth session attached to the request.

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type CurrentUserPayload = {
  id: string;
  email: string;
  role: 'admin' | 'branch_manager';
  storeId: string | null;
  isActive: boolean;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.session?.user as CurrentUserPayload;
  },
);
```

**Usage in controllers:**
```typescript
@Get()
findAll(@CurrentUser() user: CurrentUserPayload) {
  return this.storeService.findAll(user);
}
```

---

### 2.2 `@Roles()` decorator

**File:** `src/common/decorators/roles.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: ('admin' | 'branch_manager')[]) =>
  SetMetadata(ROLES_KEY, roles);
```

---

### 2.3 `RolesGuard`

**File:** `src/common/guards/roles.guard.ts`

Reads the `@Roles()` metadata and compares against the current user's role. Must be applied **after** the auth guard (which is global), so the user is always available.

```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.session?.user;

    if (!user) {
      throw new ForbiddenException('Forbidden');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Forbidden');
    }

    return true;
  }
}
```

**Registration:** Add `RolesGuard` as a global guard in `AppModule` (after `ThrottlerGuard`):

```typescript
{ provide: APP_GUARD, useClass: RolesGuard }
```

---

### 2.4 `PaginationQueryDto`

**File:** `src/common/dto/pagination-query.dto.ts`

Shared query DTO for all list endpoints.

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
```

---

### 2.5 `PaginatedResponseDto<T>`

**File:** `src/common/dto/paginated-response.dto.ts`

```typescript
export class PaginatedResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
```

---

## 3. Module File Structure

Every domain module lives in `src/modules/{name}/` and follows this layout:

```
src/modules/stores/
├── stores.module.ts
├── stores.controller.ts
├── stores.service.ts
└── dto/
    ├── create-store.dto.ts
    ├── update-store.dto.ts
    └── store-query.dto.ts        ← list filters (extends PaginationQueryDto)
```

No additional files unless genuinely needed (e.g., a separate response class for complex shapes).

---

## 4. Step-by-Step: Building a Module

Follow this order for **every single endpoint**:

1. **DTO first** — define the input shape and validation before anything else
2. **Service method** — write the business logic using Prisma
3. **Controller route** — wire the DTO + service + Swagger decorators
4. **Register module** — import into `AppModule`
5. **Test in Swagger** — verify before moving to next endpoint

---

## 5. DTO Conventions

### 5.1 Rules

- Every input field must have `@ApiProperty` or `@ApiPropertyOptional`
- Every field must have at least one `class-validator` decorator
- Use `@IsOptional()` before other validators on optional fields
- Use `PartialType(CreateXxxDto)` for update DTOs — never rewrite fields manually
- String inputs: always add `@IsString()` + `@MaxLength(n)`
- Decimal inputs: use `@IsNumber()` + `@IsPositive()` + `@Type(() => Number)`
- Date inputs: use `@IsDateString()`
- Boolean inputs: use `@IsBoolean()` + `@Type(() => Boolean)`
- UUIDs / CUIDs: use `@IsString()` (Prisma uses CUID strings, not UUID v4)

### 5.2 Create DTO example

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateStoreDto {
  @ApiProperty({ example: 'Main Branch' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: '123 Main St, City' })
  @IsString()
  @MaxLength(255)
  address: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
```

### 5.3 Update DTO

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateStoreDto } from './create-store.dto';

export class UpdateStoreDto extends PartialType(CreateStoreDto) {}
```

### 5.4 List query DTO

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class StoreQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by name (partial match)' })
  @IsOptional()
  @IsString()
  search?: string;
}
```

---

## 6. Controller Conventions

### 6.1 Required decorators on every controller

```typescript
@ApiTags('Stores')                          // groups in Swagger
@ApiCookieAuth('better-auth.session_token') // shows auth lock in Swagger
@Controller('stores')
export class StoresController { ... }
```

### 6.2 Required decorators on every protected route

```typescript
@ApiUnauthorizedResponse({ schema: { example: { message: 'Unauthorized' } } })
@ApiForbiddenResponse({ schema: { example: { message: 'Forbidden' } } })
```

### 6.3 Role restriction

Apply `@Roles()` at the controller level if the **entire** controller is for one role, or per-method if mixed:

```typescript
// Entire controller is admin-only:
@Roles('admin')
@Controller('stores')
export class StoresController { ... }

// Mixed roles per method:
@Roles('admin')
@Post()
create(...) {}

@Roles('admin', 'branch_manager')
@Get(':id')
findOne(...) {}
```

### 6.4 Response status codes

| Operation | Decorator | Status |
|---|---|---|
| POST (create) | `@HttpCode(HttpStatus.CREATED)` | 201 |
| GET (read) | _(default)_ | 200 |
| PATCH (update) | _(default)_ | 200 |
| DELETE / deactivate | `@HttpCode(HttpStatus.NO_CONTENT)` | 204 |

### 6.5 Full controller method example

```typescript
@Post()
@Roles('admin')
@ApiOperation({ summary: 'Create a new store' })
@ApiCreatedResponse({ description: 'Store created' })
@ApiBadRequestResponse({ description: 'Validation failed' })
@ApiUnauthorizedResponse({ schema: { example: { message: 'Unauthorized' } } })
@ApiForbiddenResponse({ schema: { example: { message: 'Forbidden' } } })
async create(
  @Body() dto: CreateStoreDto,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.storesService.create(dto, user);
}
```

### 6.6 Never do these in controllers

- No business logic — delegate everything to the service
- No Prisma calls — that belongs in the service
- No try/catch — let NestJS exception filters handle errors

---

## 7. Service Conventions

### 7.1 Structure

```typescript
@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}
  // methods...
}
```

### 7.2 Prisma patterns

**Find one or throw:**
```typescript
const store = await this.prisma.store.findUnique({ where: { id } });
if (!store) throw new NotFoundException(`Store ${id} not found`);
```

**List with pagination:**
```typescript
const [data, total] = await this.prisma.$transaction([
  this.prisma.store.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
  }),
  this.prisma.store.count({ where }),
]);
return { data, total, page, limit };
```

**Create:**
```typescript
return this.prisma.store.create({ data: { ...dto } });
```

**Update:**
```typescript
return this.prisma.store.update({ where: { id }, data: { ...dto } });
```

### 7.3 Always scope branch manager queries

When a `branch_manager` calls a list or get endpoint, filter by their store:

```typescript
const where = user.role === 'branch_manager'
  ? { id: user.storeId }
  : {};
```

---

## 8. Auth, Roles & Current User

### 8.1 How authentication works

The global `BetterAuthGuard` validates the session cookie on every request. If the session is valid, `request.session.user` contains:

```typescript
{
  id: string;
  email: string;
  role: 'admin' | 'branch_manager';
  storeId: string | null;   // null for admin, store CUID for managers
  isActive: boolean;
}
```

### 8.2 How roles work

`RolesGuard` (global) reads `@Roles()` metadata:
- No `@Roles()` → any authenticated user can access
- `@Roles('admin')` → admin only
- `@Roles('admin', 'branch_manager')` → any authenticated user (same as no decorator, but explicit)

### 8.3 Public routes

Use `@AllowAnonymous()` from `@thallesp/nestjs-better-auth` — only for routes that genuinely need no session (e.g. health check, API info).

```typescript
@AllowAnonymous()
@Get()
healthCheck() { ... }
```

---

## 9. Error Handling

Use NestJS built-in HTTP exceptions — never catch-and-swallow:

| Situation | Exception |
|---|---|
| Resource not found | `NotFoundException` |
| Role not allowed | `ForbiddenException` |
| Input violates business rule | `BadRequestException` |
| Unique constraint violated | `ConflictException` |
| Stock would go negative | `BadRequestException` |
| DB unavailable | `ServiceUnavailableException` |

**Example:**
```typescript
if (!store) throw new NotFoundException(`Store ${id} not found`);
if (store.isActive === false) throw new BadRequestException('Store is inactive');
```

Never throw `HttpException` directly — always use the named subclasses above.

---

## 10. Audit Logging

Write to `AuditLog` after every mutating operation (create, update, deactivate). Do this inside the same service method, after the Prisma mutation succeeds.

```typescript
await this.prisma.auditLog.create({
  data: {
    userId: user.id,
    action: 'STORE_CREATED',       // use a descriptive string; see list below
    entityType: 'store',
    entityId: store.id,
    oldValue: null,                 // null for creates
    newValue: store,                // the full created/updated record
  },
});
```

> **Note:** For updates, capture `oldValue` with a `findUnique` **before** the update, then pass the updated record as `newValue`.

### Audit action reference

| Action | When |
|---|---|
| `USER_CREATED` | Admin creates a user |
| `USER_DEACTIVATED` | Admin deactivates a user |
| `PRODUCT_CREATED` | Admin creates a product |
| `PRODUCT_UPDATED` | Admin edits a product |
| `STOCK_SUPPLIED` | Admin supplies stock to a store |
| `SALE_CREATED` | Manager submits a sale |
| `SALE_CORRECTED` | Manager corrects a sale |
| `INVENTORY_UPDATED` | Any stock quantity change |
| `EXPENSE_CREATED` | Admin adds an expense |
| `EXPENSE_UPDATED` | Admin edits an expense |
| `EXPENSE_DELETED` | Admin deletes an expense |

---

## 11. Soft Delete

**Never call `prisma.model.delete()`** for Store, Product, or User.

Always use:
```typescript
await this.prisma.store.update({
  where: { id },
  data: { isActive: false },
});
```

Expenses are the **only** model that supports hard delete (per system design).

When listing resources, always filter out inactive records unless the caller is admin and explicitly requests them:

```typescript
const where = { isActive: true };
```

---

## 12. Pagination

All list endpoints accept `?page=1&limit=20` via `PaginationQueryDto`.

Response shape (always):
```json
{
  "data": [...],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

Default: `page=1`, `limit=20`, max `limit=100`.

---

## 13. Registering a Module in AppModule

After creating a module, import it in `src/app.module.ts`:

```typescript
import { StoresModule } from './modules/stores/stores.module';

@Module({
  imports: [
    // ...existing
    StoresModule,
  ],
})
export class AppModule {}
```

The module itself must import `PrismaModule` if it uses `PrismaService`:

```typescript
@Module({
  imports: [PrismaModule],
  controllers: [StoresController],
  providers: [StoresService],
  exports: [StoresService], // only if other modules need it
})
export class StoresModule {}
```

---

## 14. Module Build Order

Build and test one endpoint at a time via Swagger before moving on.

| # | Module | Endpoints |
|---|---|---|
| 1 | **Stores** | POST, GET all, GET one, PATCH, PATCH deactivate |
| 2 | **Categories** | GET all (read-only, seeded data) |
| 3 | **Products** | POST, GET all, GET one, PATCH, PATCH deactivate |
| 4 | **Inventory** | GET stock by store, GET stock for one product-store |
| 5 | **Stock Supply** | POST (admin supplies stock), GET history |
| 6 | **Sales** | POST (manager submits), GET history, PATCH correct |
| 7 | **Expenses** | POST, GET all, PATCH, DELETE |
| 8 | **Audit Log** | GET all (admin read-only) |
| 9 | **Reports** | GET dashboard stats, GET financial summary |

---

_Last updated: 2026-06-05_
