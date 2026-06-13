# Multi-Tenancy Design Document

> **Status:** Design complete — implementation not started. One blocking decision in Phase 0 (Category scope).  
> **Last updated:** 2026-06-13 (rev 3 — added Prisma `findUnique`/`update` `where` limitation, full 15-query raw-SQL list, Category seeding fork, expense-category compile break)  
> **Purpose:** Single source of truth for all decisions made before implementation. Reference this document phase by phase and tick off items as they are completed.

---

## 1. Background & Goal

The system is currently a **single-tenant** multi-store inventory management platform. The goal is to evolve it into a **multi-tenant SaaS platform** where each tenant is a company (organization) with its own completely isolated data.

### Key requirements

- Multiple companies share the same application and database
- Each company's data is **completely isolated** from every other company's data
- Tenant is resolved **from the logged-in user's account** — no subdomains, no login-time selection. The user's `organizationId` is set on their account at creation time and is carried in every session automatically
- Some companies have stores and branch managers (current model, unchanged)
- Some companies have **no stores** — only admins who do everything directly
- A **platform-level super-admin** manages organizations and sits above all tenant scope

---

## 2. Role Hierarchy

```
super_admin        ← platform level; organizationId = null; manages all orgs
  └── admin        ← tenant level; manages their org's data
        └── branch_manager  ← tenant level; scoped to one store (only in hasStores orgs)
```

### Role rules

| Role | organizationId | storeId | Can access |
|------|---------------|---------|------------|
| `super_admin` | `null` | `null` | All orgs, all `/super-admin/*` routes only |
| `admin` | required | `null` | Their org's data only, all admin routes |
| `branch_manager` | required | required | Their org's data, their store only |

### Current vs new `UserRole` enum (in `auth.prisma`)

```prisma
// CURRENT
enum UserRole {
  admin
  branch_manager
}

// NEW
enum UserRole {
  super_admin
  admin
  branch_manager
}
```

---

## 3. New `Organization` Model

New file: `api/prisma/models/organization.prisma`

```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String
  hasStores Boolean  @default(true)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users             User[]
  stores            Store[]
  products          Product[]
  categories        Category[]
  inventory         Inventory[]
  sales             Sale[]
  saleCorrections   SaleCorrection[]
  stockSupplies     StockSupply[]
  expenses          Expense[]
  expenseCategories ExpenseCategory[]
  auditLogs         AuditLog[]

  @@map("organization")
}
```

### The `hasStores` flag

| `hasStores` | Effect |
|-------------|--------|
| `true` | Full current model — stores, branch managers, stock supply, per-store inventory and dashboards |
| `false` | No stores, no branch_manager role. Admin submits sales directly. Inventory is a flat product→quantity list, not per-store. All store-related UI is hidden. |

---

## 4. Schema Changes — Per Model

Every existing model gets `organizationId` as a required FK except `Session`, `Account`, `Verification` (Better-Auth internals — untouched).

### 4.1 `User` (in `auth.prisma`)

```prisma
model User {
  // ... existing fields ...
  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id])
  role           UserRole      // now includes super_admin
}
```

`super_admin` has `organizationId = null` and `storeId = null`. All other roles must have `organizationId` set.

### 4.2 `Store`

```prisma
model Store {
  // ... existing fields ...
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
}
```

### 4.3 `Category`

**Breaking change on unique constraint** — currently `@@unique([name])` globally. Must become per-org.

```prisma
model Category {
  // ... existing fields ...
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  @@unique([name, organizationId])   // replaces @@unique([name])
}
```

### 4.4 `Product`

```prisma
model Product {
  // ... existing fields ...
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
}
```

### 4.5 `Inventory`

```prisma
model Inventory {
  // ... existing fields ...
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
}
```

### 4.6 `Sale`

```prisma
model Sale {
  // ... existing fields ...
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
}
```

### 4.7 `SaleCorrection`

```prisma
model SaleCorrection {
  // ... existing fields ...
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
}
```

### 4.8 `StockSupply`

```prisma
model StockSupply {
  // ... existing fields ...
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
}
```

### 4.9 `ExpenseCategory`

**Breaking change on unique constraint** — same as Category.

```prisma
model ExpenseCategory {
  // ... existing fields ...
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  @@unique([name, organizationId])   // replaces @@unique([name])
}
```

### 4.10 `Expense`

```prisma
model Expense {
  // ... existing fields ...
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
}
```

### 4.11 `AuditLog`

```prisma
model AuditLog {
  // ... existing fields ...
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
}
```

### 4.12 New `AuditAction` values (in `audit.prisma`)

```prisma
enum AuditAction {
  // ... existing values unchanged ...
  ORGANIZATION_CREATED
  ORGANIZATION_UPDATED
  ORGANIZATION_DEACTIVATED
  ORGANIZATION_REACTIVATED
}
```

---

## 5. Tenant Resolution — How It Works at Runtime

```
User logs in via Better-Auth (/api/auth/sign-in/email)
  → session is created and stored in DB
  → session user includes: id, role, organizationId, storeId, isActive
  → AuthGuard attaches user to NestJS request as CurrentUserPayload
  → TenantMiddleware reads organizationId from request user and sets AsyncLocalStorage context
  → Prisma middleware reads from AsyncLocalStorage and injects WHERE organizationId = ? on every query
  → super_admin has organizationId = null → middleware bypasses filter → can read across all orgs
```

### Updated `CurrentUserPayload` (`common/decorators/current-user.decorator.ts`)

```typescript
export type CurrentUserPayload = {
  id: string;
  email: string;
  role: UserRole;                  // now includes super_admin
  organizationId: string | null;   // null for super_admin only
  storeId: string | null;
  isActive: boolean;
};
```

---

## 6. Prisma Tenant Scoping Middleware

The middleware is the **safety net** — it automatically appends `organizationId` to every Prisma query so no service can accidentally leak cross-tenant data.

### How it works

- Uses Node.js `AsyncLocalStorage` to carry `organizationId` through the async request lifecycle
- A `TenantContext` service wraps `AsyncLocalStorage` — exposes `set(orgId)` and `get()`
- A NestJS `TenantMiddleware` runs before every request: reads `organizationId` from the authenticated user and calls `TenantContext.set()`
- The Prisma client middleware (registered in `PrismaService`) intercepts every operation and injects `where.organizationId = TenantContext.get()`

### Models the middleware applies to

`User`, `Store`, `Category`, `Product`, `Inventory`, `Sale`, `SaleCorrection`, `StockSupply`, `ExpenseCategory`, `Expense`, `AuditLog`

### Models the middleware explicitly skips

- `Organization` — this is the tenant table itself; unscoped by design
- `Session`, `Account`, `Verification` — Better-Auth internals, no `organizationId` field

### Super-admin bypass

When `TenantContext.get()` returns `null` (super_admin request), the middleware does **not** inject any filter. Super-admin queries across all tenants naturally.

### CRITICAL: Prisma `where` limitation on `findUnique` / `update` / `delete`

This is the single most important subtlety in the whole design. **Prisma does not allow arbitrary fields in the `where` of `findUnique`, `findUniqueOrThrow`, `update`, `delete`, and `upsert` — only unique selectors (`id`, or a compound `@@unique`).** You therefore **cannot** simply "inject `organizationId`" into these operations; Prisma will throw `Unknown argument 'organizationId'`. The middleware must transform them:

| Operation | Transformation required |
|-----------|------------------------|
| `findUnique` / `findUniqueOrThrow` | Rewrite to `findFirst` / `findFirstOrThrow`, then add `where.organizationId`. (Safe — same row, extra filter.) |
| `count`, `aggregate`, `groupBy`, `findMany`, `findFirst`, `updateMany`, `deleteMany` | `where` accepts arbitrary fields — inject `organizationId` directly. |
| `create` / `createMany` | Inject `organizationId` into `data` from context. |
| `update` / `delete` / `upsert` (unique `where`) | **Cannot add `organizationId` to the `where`.** Two options — decision below. |

**Decision for `update` / `delete` / `upsert`:** These are always preceded in our codebase by a scoped read (`findOne` → `findFirst`, which the middleware DOES scope). Since record IDs are globally-unique `cuid`s, a cross-tenant ID is effectively unguessable AND the preceding scoped read returns `NotFound` first. So we **leave `update`/`delete` as-is** and rely on (a) the preceding scoped `findFirst`, plus (b) globally-unique cuids as defense-in-depth. The two compound-unique inventory updates (`where: { productId_storeId }` in sales and stock-supplies) are safe because `productId` is a cuid that belongs to exactly one org. **This must be verified per call site in Phase 5**, not assumed.

> ⚠️ Integer autoincrement IDs (`Category.id`, `ExpenseCategory.id`) are **sequential and guessable** — org A can trivially guess org B's category IDs. For these tables the `findUnique → findFirst` conversion is **mandatory**, never optional. See Section 7.10/7.11.

### Does the middleware fire inside `$transaction`?

Yes — when implemented as a **Prisma Client Extension** (`$extends({ query: { ... } })`, the recommended API for Prisma 6; the legacy `$use` is deprecated), the `query` callbacks fire for operations on the interactive transaction client (`tx.x.create()`, `tx.x.update()`) too, because `tx` shares the extension chain. This matters: `sales.service.ts`, `stock-supplies.service.ts`, `expenses.service.ts`, and `users.service.ts` all do `tx.*.create()` inside `$transaction` and rely on auto-injection of `organizationId`. **Confirm this behavior with a test in Phase 2** — it is the load-bearing assumption.

### What the middleware CANNOT cover — raw SQL

`$queryRaw` and `$executeRaw` (including `tx.$queryRaw` / `tx.$executeRaw` inside transactions) bypass the extension entirely. These must be manually updated with `AND "organizationId" = ${organizationId}`. All affected locations are listed in Section 9 — there are **15 raw queries across 3 files**, not 2.

---

## 7. Backend Changes — File by File

### 7.1 `api/prisma/models/organization.prisma` — NEW FILE

Full model as defined in Section 3.

### 7.2 `api/prisma/schema.prisma`

Add import of `organization.prisma`.

### 7.3 `api/src/modules/auth/auth.config.ts`

**Critical** — `organizationId` must be added to Better-Auth `additionalFields` or it will never appear in the session user object. Without this, tenant context cannot be resolved from the session.

```typescript
user: {
  additionalFields: {
    role:           { type: "string",  required: true,  input: true  },
    isActive:       { type: "boolean", required: false, input: false },
    storeId:        { type: "string",  required: false, input: true  },
    organizationId: { type: "string",  required: false, input: true  }, // ADD THIS
    name:           { type: "string",  required: false, input: true  },
  },
},
```

> `input: true` allows it to be set during signup (needed when super_admin creates an org admin). `required: false` because `super_admin` has no org.

### 7.4 `api/src/modules/auth/auth.constants.ts`

`USER_ROLES` and `isUserRole()` are hardcoded to `[admin, branch_manager]`. The signup hook uses `isUserRole()` to validate the role field — it will reject `super_admin` if not updated.

```typescript
// CURRENT
export const USER_ROLES = [UserRole.admin, UserRole.branch_manager] as const;

// NEW
export const USER_ROLES = [UserRole.super_admin, UserRole.admin, UserRole.branch_manager] as const;
```

> `isUserRole()` derives from this array so it updates automatically.

### 7.5 `api/src/modules/auth/auth.hooks.ts`

Three separate issues in this file:

**Issue A — `AuthSignUpHook.validateSignUp`:**  
Currently enforces: `admin` cannot have `storeId`, `branch_manager` must have `storeId`. Need to extend for `super_admin`:
- `super_admin` cannot have `storeId` or `organizationId`
- `admin` must have `organizationId` (except in bootstrap mode — see Issue C)
- `branch_manager` must have `storeId` AND `organizationId`; the store must belong to the same `organizationId`
- `branch_manager` creation must be rejected if the org has `hasStores = false`

**Issue B — `AuthSignUpHook.requireAdminSession`:**  
Currently checks `session.user.role !== UserRole.admin` to allow user creation. Must also allow `super_admin`:

```typescript
// CURRENT
if (session.user.role !== UserRole.admin) { throw FORBIDDEN }

// NEW
if (session.user.role !== UserRole.admin && session.user.role !== UserRole.super_admin) {
  throw FORBIDDEN
}
```

Additionally: an `admin` creating a user must only be allowed to create users within their own `organizationId` — they cannot set a different `organizationId`.

**Issue C — `AuthUserDatabaseHook.beforeUserCreate`:**  
Currently sets `storeId` based on role. Must also handle `organizationId`:

```typescript
// Needs to handle:
// super_admin → storeId: null, organizationId: null
// admin       → storeId: null, organizationId: from body
// branch_manager → storeId: from body, organizationId: from body
```

**Issue D — `AuthSignUpHook.auditUserCreated`:**  
This runs as a Better-Auth after-hook, **outside of a normal NestJS request context**. The `AsyncLocalStorage` tenant context will NOT be set here. The Prisma middleware will not inject `organizationId` automatically.  
Solution: manually pass `organizationId` to `auditLog.create()` by reading it from the created user record:

```typescript
await this.prisma.auditLog.create({
  data: {
    userId: actorId,
    organizationId: created.organizationId,  // manually set — middleware won't help here
    action: AuditAction.USER_CREATED,
    entityType: "user",
    entityId: created.id,
    oldValue: Prisma.JsonNull,
    newValue: created,
  },
});
```

> Any other Better-Auth hooks that write to the DB have the same issue — check each one.

### 7.6 `api/src/modules/auth/me.service.ts`

The `/api/me` endpoint is the frontend's source of truth for user context. It currently returns `user + store`. It must also return `organization` (name + `hasStores`), because:
- The frontend uses this to populate the Zustand store
- `hasStores` must be known before the sidebar renders
- Without it, an extra API call would be required on every page load

```typescript
async getProfile(user: Record<string, unknown>) {
  // existing store lookup ...

  const organizationId = typeof user.organizationId === "string" ? user.organizationId : null;
  const organization = organizationId
    ? await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, hasStores: true },
      })
    : null;

  return {
    user: {
      ...user,
      store,
      organization,  // ADD: { id, name, hasStores } or null for super_admin
    },
  };
}
```

### 7.7 `api/src/common/decorators/current-user.decorator.ts`

Add `organizationId: string | null` to `CurrentUserPayload` type (see Section 5).

### 7.8 `api/src/common/utils/store-scope.util.ts`

All utility functions (`assertBranchManagerHasStore`, `assertStoreAccess`, `resolveStoreFilter`, `requireManagerStore`, `requireActiveManagerStore`) must be updated to treat `super_admin` as a bypass — same as how `admin` currently bypasses store checks.

### 7.9 `api/src/common/utils/inventory-lock.util.ts`

Two functions contain raw SQL:

**`findInventoryRowForUpdate`** — add `organizationId` to the WHERE:
```sql
SELECT id, "productId", "storeId", "organizationId", quantity
FROM inventory
WHERE "productId" = ${productId}
  AND "storeId" = ${storeId}
  AND "organizationId" = ${organizationId}
FOR UPDATE
```

**`acquireInventoryMutationLock`** — uses `pg_advisory_xact_lock(hashtext(productId), hashtext(storeId))`. Two tenants with coincidentally identical productId + storeId values would share the same advisory lock, which is a correctness issue. The lock key must incorporate `organizationId`:
```sql
SELECT pg_advisory_xact_lock(
  hashtext(${organizationId} || ':' || ${productId}),
  hashtext(${storeId})
)
```

Both functions need `organizationId: string` added to their signatures.

### 7.10 `api/src/modules/reports/reports.service.ts` — Raw SQL audit

**This is the most critical raw SQL concern.** The reports service has **10 raw SQL methods** that bypass Prisma middleware. Every one must be manually updated with `AND "organizationId" = ${organizationId}`:

| Method | Table(s) queried | Fix needed |
|--------|-----------------|------------|
| `sumCogs` | `sale` | Add `AND s."organizationId" = ${orgId}` inside `buildSaleSqlFilter` |
| `buildSaleSqlFilter` | `sale` | Central helper — adding org filter here fixes `sumCogs` and `fetchMonthlySales` |
| `fetchMonthlySales` | `sale` | Uses `buildSaleSqlFilter` — fixed by 7.10 above; also verify the raw SQL directly |
| `fetchMonthlyExpenses` | `expense` | Add `AND e."organizationId" = ${orgId}` |
| `countLowStock` | `inventory`, `product`, `store` | Add `AND i."organizationId" = ${orgId}` |
| `countOutOfStock` | `inventory`, `product`, `store` | Add `AND i."organizationId" = ${orgId}` |
| `fetchDailyRevenue` | `sale` | Add `AND s."organizationId" = ${orgId}` |
| `fetchProductDistributionTrend` | `sale`, `product` | Add `AND s."organizationId" = ${orgId}` |
| `fetchStockByCategory` | `inventory`, `product`, `category`, `store` | Add `AND i."organizationId" = ${orgId}` |
| `computeLiveStockMetrics` | `inventory`, `product`, `store` | Add `AND i."organizationId" = ${orgId}` |
| `fetchStockInvestment` | `stock_supply` | Add `AND ss."organizationId" = ${orgId}` |

All these methods must receive `organizationId` from the caller (`getAdminDashboard`, `getManagerDashboard`, etc.), which get it from the `CurrentUser` decorator.

### 7.11 New: `api/src/modules/organizations/` — NEW MODULE

**Routes (all require `@Roles(UserRole.super_admin)`):**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/organizations` | List all organizations |
| `POST` | `/api/organizations` | Create a new organization |
| `GET` | `/api/organizations/:id` | Get organization details + user list |
| `PATCH` | `/api/organizations/:id` | Update name, hasStores, isActive |

**User creation for an org** is handled through the existing signup flow (`POST /api/auth/sign-up/email`), not a separate endpoint. The super_admin calls signup with `organizationId` in the body, which Better-Auth sets on the new user via `additionalFields`. This approach keeps user creation consistent and avoids bypassing Better-Auth's password hashing and session logic.

Files to create:
- `organizations.module.ts`
- `organizations.controller.ts`
- `organizations.service.ts`
- `dto/create-organization.dto.ts`
- `dto/update-organization.dto.ts`

Register in `AppModule`.

### 7.12 `api/src/modules/users/users.service.ts`

- **`findAll`**: currently has no org scoping in the `where` clause — this is safe because Prisma middleware handles it. But super_admin calling `findAll` will see all users across all orgs — this is correct behavior for super_admin.
- **`update`**: when an `admin` updates a user, they must not be able to change the user's `organizationId` to a different org. Add a check.
- **`assertUniqueEmail`**: currently checks email uniqueness globally across all users. **Decision: keep email globally unique** (see Section 11). No change needed here.
- **`resolveStoreIdForRole`**: must handle `super_admin` — `super_admin` cannot have a `storeId`.
- **`update` and `activate`**: when re-assigning a `branch_manager` to a store, verify the store belongs to the same `organizationId` as the user.

### 7.13 `api/src/modules/categories/` — DESIGN FORK + no create endpoint

**Important discovery:** `CategoriesController` exposes only `GET /categories`. `CategoriesService` has only `findAll()`. **There is no way to create a category through the app** — categories are seeded directly into the DB. This forces a decision the earlier draft glossed over:

| Option | Implication |
|--------|-------------|
| **A — Category is GLOBAL (shared across all tenants)** | Do NOT add `organizationId` to `Category`. Do NOT change its unique constraint. All orgs share one taxonomy ("Electronics", "Groceries"…). Simplest; no per-org seeding needed. Products in every org pick from the same list. |
| **B — Category is per-org** | Add `organizationId` + `@@unique([name, organizationId])`. **But every new organization then needs its category list seeded**, and there is no UI/endpoint to do it — so org creation (Section 7.11) must seed a default category set, or build a category CRUD. |

**Recommendation: Option A (global categories)** unless the client explicitly wants each company to define its own product categories. It's far less work and matches the fact that categories have no management UI. **This decision must be confirmed with the client before Phase 1**, because it changes the schema (Section 4.3) and the migration.

> If Option A is chosen: revert the `Category` changes in Sections 3, 4.3, and remove it from the middleware model list. `assertCategoryExists` in `products.service.ts` then needs no org scoping. But note: a global category means a product's `categoryId` is not tenant-scoped, which is acceptable for a shared taxonomy.

### 7.14 `api/src/modules/expense-categories/expense-categories.service.ts`

Unlike `Category`, `ExpenseCategory` **has full CRUD** (create/update/remove/findAll/findOne), so per-org is viable and is the right model. Two concrete code issues:

1. **`assertUniqueName` will not COMPILE after the constraint change.** It currently calls `findUnique({ where: { name } })`. Once `@@unique([name])` becomes `@@unique([name, organizationId])`, `name` is no longer a standalone unique selector and Prisma's generated types drop it from `findUnique`'s `where`. **Must be rewritten to `findFirst({ where: { name } })`** (the middleware then scopes it to the org). The same applies to any other `findUnique({ where: { name } })` if one is added for `Category`.

2. **`findOne` uses `findUnique({ where: { id } })`** with a guessable integer `id`. The middleware must convert this to `findFirst` (per Section 6) so org A cannot read org B's expense category by guessing its integer id. `update`/`remove` are preceded by this scoped `findOne`, so they are protected once `findOne` is scoped.

3. **New orgs start with zero expense categories.** Decide whether org creation (Section 7.11) seeds a default set or the org admin creates them from scratch. Either is fine — just decide.

### 7.15 `api/src/modules/audit-logs/audit-logs.service.ts`

Middleware will auto-inject `organizationId` on `findMany`/`count` — verify this is sufficient for the audit log query patterns used here.

### 7.16 Per-org name uniqueness — automatic, desirable side effects

These manual uniqueness checks all use `findFirst` and become **per-org automatically** once the middleware scopes them — which is the behavior we want, no code change needed beyond the middleware:

- `products.service.ts` `assertUniqueActiveName` — product names become unique per-org (org A and org B can both have "iPhone 15")
- `stores.service.ts` `assertUniqueName` — store names become unique per-org

> Note: these are **manual** checks (not DB constraints), so they rely entirely on the middleware scoping the `findFirst`. If the middleware fails to scope, uniqueness silently becomes global again. Covered by the cross-tenant test in Phase 10.

### 7.14 `api/src/config/env.validation.ts`

No changes required — no new environment variables are introduced by multi-tenancy.

---

## 8. Frontend Changes — File by File

### 8.1 `web/lib/types.ts`

```typescript
// CURRENT
export type Role = "admin" | "manager";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  storeId: string | null;
  store: string | null;
}

// NEW
export type Role = "super_admin" | "admin" | "manager";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  storeId: string | null;
  store: string | null;
  organizationId: string | null;
  organizationName: string | null;
  hasStores: boolean | null;   // null for super_admin
}
```

### 8.2 `web/lib/auth/map-user.ts`

Currently maps `branch_manager` → `"manager"` and everything else implicitly → `"admin"`. `super_admin` would silently become `"admin"` — wrong. Must handle all three cases:

```typescript
export function mapApiUserToAppUser(apiUser: ApiUser): AppUser {
  const role: Role =
    apiUser.role === "branch_manager" ? "manager"
    : apiUser.role === "super_admin"  ? "super_admin"
    : "admin";

  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    role,
    storeId: apiUser.storeId,
    store: apiUser.store?.name ?? null,
    organizationId: apiUser.organization?.id ?? null,
    organizationName: apiUser.organization?.name ?? null,
    hasStores: apiUser.organization?.hasStores ?? null,
  };
}
```

The `ApiUser` type lives in **`web/types/auth/me.ts`** and currently reads:

```typescript
export type ApiRole = "admin" | "branch_manager";   // → add "super_admin"

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: ApiRole;
  storeId: string | null;
  isActive: boolean;
  store?: MeStore | null;
  // ADD:
  organization?: { id: string; name: string; hasStores: boolean } | null;
}
```

Both `ApiRole` (add `super_admin`) and `ApiUser` (add `organization`) must be updated, or `map-user.ts` won't type-check.

### 8.3 `web/lib/auth/routes.ts`

Currently only knows `"admin"` and `"manager"`. Three updates needed:

1. Add `/super-admin` to protected prefixes
2. Mark all `/super-admin/*` routes as super-admin-only
3. Mark all existing protected routes as forbidden for `super_admin` (they should be redirected to `/super-admin`)
4. Update `isRouteAllowedForRole` to accept `"super_admin"` and deny them access to tenant routes

```typescript
export const SUPER_ADMIN_ONLY_ROUTE_PREFIXES = ["/super-admin"] as const;

export function isRouteAllowedForRole(
  role: "super_admin" | "admin" | "manager",
  pathname: string,
): boolean {
  if (role === "super_admin") return isSuperAdminPath(pathname);
  if (role === "admin" && isManagerOnlyPath(pathname)) return false;
  if (role === "manager" && isAdminOnlyPath(pathname)) return false;
  return true;
}
```

### 8.4 `web/components/shell/app-shell.tsx`

Two updates:

1. **`roleDenied` redirect** — currently always redirects to `/dashboard`. `super_admin` should redirect to `/super-admin`:
```typescript
if (roleDenied) {
  router.replace(user?.role === "super_admin" ? "/super-admin" : "/dashboard");
}
```

2. **`PAGE_TITLES`** — add entries for all `/super-admin/*` routes.

### 8.5 `web/components/shell/sidebar.tsx`

Three updates:

1. **`Role` prop** — currently `"admin" | "manager"`. Must accept `"super_admin"` and render a separate `SUPER_ADMIN_NAV`.

2. **`ADMIN_NAV` is static** — must become dynamic based on `hasStores`. When `hasStores = false`, the entire "Stock" group (`/inventory`, `/supply`, `/stock-report`) should be removed:

```typescript
function buildAdminNav(hasStores: boolean): AdminNavEntry[] {
  const nav: AdminNavEntry[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/products", label: "Products", icon: Package },
  ];

  if (hasStores) {
    nav.push({
      type: "group",
      label: "Stock",
      icon: Boxes,
      children: [
        { href: "/inventory", label: "Inventory", icon: Layers },
        { href: "/supply", label: "Stock Supply", icon: Truck },
        { href: "/stock-report", label: "Stock Report", icon: FileBarChart2 },
      ],
    });
  }

  nav.push(
    { href: "/sales", label: "Sales", icon: ShoppingCart },
    { href: "/expenses", label: "Expenses", icon: CreditCard },
    { href: "/users", label: "Users", icon: Users },
    { href: "/audit", label: "Audit Log", icon: ClipboardList },
    { href: "/financial", label: "Financial Summary", icon: TrendingUp },
  );

  return nav;
}
```

3. **`Sidebar` props** — add `hasStores: boolean | null` to the props interface.

### 8.6 `web/store/app.ts`

The `AppUser` type used here derives from `web/lib/types.ts`. Once that is updated (Section 8.1), the Zustand store automatically carries the new fields. No structural changes needed — the persist middleware only persists `collapsed`, not the user object.

### 8.7 New: `web/app/(super-admin)/` route group

Separate route group with its own layout (separate sidebar showing only super-admin navigation). Does **not** use `AppShell` — needs a different shell that's aware of the super-admin context.

| Route | Purpose |
|-------|---------|
| `/super-admin` | Platform dashboard — org count, user count |
| `/super-admin/organizations` | Table of all organizations |
| `/super-admin/organizations/new` | Create org form (`name`, `hasStores`) |
| `/super-admin/organizations/[id]` | Org detail — users list, settings, toggle `hasStores`/`isActive` |

User creation for a new org happens via the `/api/auth/sign-up/email` endpoint — the super-admin fills a form with name, email, password, and the form posts to signup with `role: "admin"` and `organizationId: <orgId>`. No separate endpoint needed.

### 8.8 `web/lib/auth/routes.ts` — `hasStores = false` route changes

When `hasStores = false`, the following routes should be accessible to `admin` but currently are not (they don't exist for admin in the current role mapping):
- `/submit-sale` — currently manager-only; must become accessible to admin when `hasStores = false`

This is enforced **in the UI** (sidebar shows/hides) and **on the backend** (the sales endpoint already allows admin). No new route protection layer needed — the sidebar simply shows the link for admin when `hasStores = false`.

---

## 9. Raw SQL Locations — Complete List (15 queries, 3 files)

Confirmed via full-codebase grep for `$queryRaw` / `$executeRaw`. Every one bypasses the Prisma extension and needs a manual `organizationId` filter:

| File | Function | Tables | Status |
|------|----------|--------|--------|
| `inventory-lock.util.ts` | `findInventoryRowForUpdate` | `inventory` | Add `AND "organizationId" = ?` to WHERE |
| `inventory-lock.util.ts` | `acquireInventoryMutationLock` | advisory lock key | Include `organizationId` in lock key |
| `inventory.service.ts` | `buildLowStockFilter` (line ~268) | `inventory` | Add `AND "organizationId" = ?` — **was missing from v2** |
| `inventory.service.ts` | `findStockAlerts` count query (line ~331) | `inventory`, `product`, `store` | Add `AND i."organizationId" = ?` — **was missing from v2** |
| `inventory.service.ts` | `findStockAlerts` id query (line ~344) | `inventory`, `product`, `store` | Add `AND i."organizationId" = ?` — **was missing from v2** |
| `reports.service.ts` | `sumCogs` via `buildSaleSqlFilter` | `sale` | Add org filter to `buildSaleSqlFilter` |
| `reports.service.ts` | `fetchMonthlySales` | `sale` | Add org filter |
| `reports.service.ts` | `fetchMonthlyExpenses` | `expense` | Add `AND e."organizationId" = ?` |
| `reports.service.ts` | `countLowStock` | `inventory`, `product`, `store` | Add `AND i."organizationId" = ?` |
| `reports.service.ts` | `countOutOfStock` | `inventory`, `product`, `store` | Add `AND i."organizationId" = ?` |
| `reports.service.ts` | `fetchDailyRevenue` | `sale` | Add `AND s."organizationId" = ?` |
| `reports.service.ts` | `fetchProductDistributionTrend` | `sale`, `product` | Add `AND s."organizationId" = ?` |
| `reports.service.ts` | `fetchStockByCategory` | `inventory`, `product`, `category`, `store` | Add `AND i."organizationId" = ?` |
| `reports.service.ts` | `computeLiveStockMetrics` | `inventory`, `product`, `store` | Add `AND i."organizationId" = ?` |
| `reports.service.ts` | `fetchStockInvestment` | `stock_supply` | Add `AND ss."organizationId" = ?` |

**Exempt:** `health.controller.ts` runs `SELECT 1` (no table, no tenant data) — no change needed.

All report and inventory methods must receive `organizationId` from the controller (via `@CurrentUser()`).

---

## 10. Data Migration Plan

When the schema changes are applied, existing data must be backfilled. This is non-destructive — no data is deleted.

1. Add nullable `organizationId` column to all affected tables (migration runs with nullable first)
2. Create one `Organization` record: `{ name: "Default Organization", hasStores: true }`
3. Backfill `organizationId` on every row in: `User`, `Store`, `Category`, `Product`, `Inventory`, `Sale`, `SaleCorrection`, `StockSupply`, `ExpenseCategory`, `Expense`, `AuditLog`
4. Apply NOT NULL constraint on `organizationId` (second migration after backfill)
5. Create the first `super_admin` user directly in the seed script (with `organizationId = null`)
6. Set `ALLOW_SIGNUP=true` temporarily to bootstrap the super_admin, then disable

---

## 11. Decisions Made (Do Not Revisit Without Reason)

| Decision | Choice | Reason |
|----------|--------|--------|
| Tenant resolution | From logged-in user's `organizationId` in session | Simplest; no subdomains, no picker UI |
| Data isolation | Row-level (`organizationId` on every table) | Standard SaaS approach; Prisma middleware enforces it |
| Store optionality | `hasStores` flag on `Organization` | Explicit; easy to branch all logic on |
| Super-admin scope | `organizationId = null`; can only access `/super-admin/*` routes | Platform role sits above all tenants; must not access tenant data directly |
| Migration approach | Two-step: add nullable → backfill → add NOT NULL | Non-destructive; no data lost |
| **Category scope** | **DECISION PENDING — global (recommended) vs per-org** | Category has no create UI; per-org needs seeding. See Section 7.13. **Confirm with client before Phase 1.** |
| ExpenseCategory uniqueness | Unique per org `[name, organizationId]` | Has full CRUD, so per-org works; two orgs can have same expense category name |
| `update`/`delete`/`upsert` tenant scoping | Rely on preceding scoped `findFirst` + globally-unique cuid; do NOT try to inject org into unique `where` | Prisma forbids non-unique fields in unique `where`; converting to `*Many` everywhere is invasive |
| `findUnique` tenant scoping | Middleware rewrites to `findFirst` + org filter | Mandatory for guessable integer IDs (Category/ExpenseCategory); Prisma won't accept org in `findUnique` where |
| Prisma middleware API | Client Extension (`$extends`), not deprecated `$use` | `$use` is deprecated in Prisma 6; extensions cover transaction clients |
| Email uniqueness | Globally unique across all tenants | Better-Auth uses email as the login identifier; per-org uniqueness would require email+org at login which Better-Auth doesn't support without customization |
| `hasStores = false` inventory | Flat product→quantity list, not per-store | No stores = no concept of per-store tracking |
| User creation for new orgs | Via existing Better-Auth `/sign-up/email` with `organizationId` in body | Keeps password hashing and session creation consistent; no separate endpoint |
| `super_admin` route isolation | `/super-admin/*` only; blocked from all tenant routes | Clean separation; super-admin manages the platform, not individual tenants' data |

---

## 12. Implementation Phases & Checklist

Work through these in order. Do not start a phase until the previous one is complete and tested.

---

### Phase 0 — Decisions to Confirm With Client (BLOCKING)

- [ ] **Category scope: global (recommended) or per-org?** (Section 7.13) — changes whether `Category` gets `organizationId`. Do not start Phase 1 until resolved.
- [ ] Should new orgs get a seeded default set of expense categories, or start empty? (Section 7.14)

---

### Phase 1 — Database Schema

- [ ] Create `api/prisma/models/organization.prisma` with `Organization` model
- [ ] Add `super_admin` to `UserRole` enum in `auth.prisma`
- [ ] Add `organizationId` (nullable) + relation to `User`
- [ ] Add `organizationId` + relation to `Store`
- [ ] **IF Category is per-org (Phase 0):** add `organizationId` + relation to `Category` — change unique constraint to `[name, organizationId]`. **IF global:** skip Category entirely.
- [ ] Add `organizationId` + relation to `Product`
- [ ] Add `organizationId` + relation to `Inventory`
- [ ] Add `organizationId` + relation to `Sale`
- [ ] Add `organizationId` + relation to `SaleCorrection`
- [ ] Add `organizationId` + relation to `StockSupply`
- [ ] Add `organizationId` + relation to `ExpenseCategory` — change unique constraint to `[name, organizationId]`
- [ ] Add `organizationId` + relation to `Expense`
- [ ] Add `organizationId` + relation to `AuditLog`
- [ ] Add `ORGANIZATION_*` audit actions to `AuditAction` enum
- [ ] Import `organization.prisma` in root `schema.prisma`
- [ ] Generate Prisma client (`npx prisma generate`)
- [ ] Run migration step 1 (add nullable columns): `npx prisma migrate dev --name add-org-nullable`
- [ ] Write and run seed/backfill script: create first org + backfill all existing rows + create super_admin user
- [ ] Run migration step 2 (add NOT NULL constraints): `npx prisma migrate dev --name add-org-not-null`

---

### Phase 2 — Backend Auth & Tenant Infrastructure

- [ ] `auth.config.ts` — add `organizationId` to `additionalFields` (`input: true`, `required: false`)
- [ ] `auth.constants.ts` — add `super_admin` to `USER_ROLES` array
- [ ] `auth.hooks.ts` — `validateSignUp`: add `super_admin` handling; validate `organizationId` presence per role; reject `branch_manager` if org has `hasStores = false`
- [ ] `auth.hooks.ts` — `requireAdminSession`: allow `super_admin` to also create users
- [ ] `auth.hooks.ts` — `AuthUserDatabaseHook.beforeUserCreate`: handle `organizationId` for all three roles
- [ ] `auth.hooks.ts` — `auditUserCreated`: manually set `organizationId` in `auditLog.create()` — middleware won't help here (outside request context)
- [ ] `current-user.decorator.ts` — add `organizationId: string | null` to `CurrentUserPayload`
- [ ] Create `TenantContext` service using `AsyncLocalStorage`
- [ ] Create `TenantMiddleware` — reads `organizationId` from authenticated user, calls `TenantContext.set()`
- [ ] Register `TenantMiddleware` globally in `AppModule`
- [ ] Write Prisma tenant-scoping **Client Extension** (`$extends`, not deprecated `$use`) in `PrismaService`:
  - [ ] Covers all `organizationId`-bearing models (10 or 11 depending on Category decision)
  - [ ] Skips `Organization`, `Session`, `Account`, `Verification`
  - [ ] Bypasses entirely when `TenantContext.get()` returns `null` (super_admin)
  - [ ] **Rewrites `findUnique`/`findUniqueOrThrow` → `findFirst`/`findFirstOrThrow` + org filter** (cannot inject org into unique `where`)
  - [ ] Injects org filter directly into `findMany`, `findFirst`, `count`, `aggregate`, `groupBy`, `updateMany`, `deleteMany`
  - [ ] Auto-injects `organizationId` into `data` on `create` / `createMany`
  - [ ] Leaves `update`/`delete`/`upsert` unique `where` untouched (relies on preceding scoped read + cuid uniqueness — see Section 6)
- [ ] **Write a test proving the extension fires inside `$transaction`** (`tx.x.create()` gets org injected) — load-bearing assumption
- [ ] **Write a cross-tenant test** for guessable integer IDs (Category/ExpenseCategory `findUnique`→`findFirst`)
- [ ] `store-scope.util.ts` — add `super_admin` bypass to all utility functions

---

### Phase 3 — Raw SQL Fixes

- [ ] `inventory-lock.util.ts` — `findInventoryRowForUpdate`: add `AND "organizationId" = ${organizationId}` to WHERE; add `organizationId` param
- [ ] `inventory-lock.util.ts` — `acquireInventoryMutationLock`: include `organizationId` in advisory lock key; add `organizationId` param
- [ ] `inventory-lock.util.ts` — update all callers (sales create/correct, stock-supplies recordStockChange) to pass `organizationId`
- [ ] `inventory.service.ts` — `buildLowStockFilter`: add `AND "organizationId" = ${orgId}`
- [ ] `inventory.service.ts` — `findStockAlerts` count query: add `AND i."organizationId" = ${orgId}`
- [ ] `inventory.service.ts` — `findStockAlerts` id query: add `AND i."organizationId" = ${orgId}`
- [ ] `reports.service.ts` — update `buildSaleSqlFilter` to accept and inject `organizationId`
- [ ] `reports.service.ts` — `fetchMonthlyExpenses`: add `AND e."organizationId" = ${orgId}`
- [ ] `reports.service.ts` — `countLowStock`: add `AND i."organizationId" = ${orgId}`
- [ ] `reports.service.ts` — `countOutOfStock`: add `AND i."organizationId" = ${orgId}`
- [ ] `reports.service.ts` — `fetchDailyRevenue`: add `AND s."organizationId" = ${orgId}`
- [ ] `reports.service.ts` — `fetchProductDistributionTrend`: add `AND s."organizationId" = ${orgId}`
- [ ] `reports.service.ts` — `fetchStockByCategory`: add `AND i."organizationId" = ${orgId}`
- [ ] `reports.service.ts` — `computeLiveStockMetrics`: add `AND i."organizationId" = ${orgId}`
- [ ] `reports.service.ts` — `fetchStockInvestment`: add `AND ss."organizationId" = ${orgId}`
- [ ] `reports.service.ts` — update all public methods to receive `organizationId` from controller via `@CurrentUser()`

---

### Phase 4 — Organizations Module (Backend)

- [ ] Create `api/src/modules/organizations/organizations.module.ts`
- [ ] Create `api/src/modules/organizations/organizations.controller.ts` (all routes `@Roles(super_admin)`)
- [ ] Create `api/src/modules/organizations/organizations.service.ts`
  - [ ] `findAll()` — paginated list of all orgs
  - [ ] `findOne(id)` — org details
  - [ ] `create(dto)` — create org; write `ORGANIZATION_CREATED` audit log
  - [ ] `update(id, dto)` — update name/hasStores/isActive; write `ORGANIZATION_UPDATED` audit log
- [ ] Create `dto/create-organization.dto.ts`
- [ ] Create `dto/update-organization.dto.ts`
- [ ] Register `OrganizationsModule` in `AppModule`

---

### Phase 5 — Existing Backend Modules (Verify & Fix)

- [ ] `me.service.ts` — fetch and return `organization: { id, name, hasStores }` in `/api/me` response
- [ ] `expense-categories.service.ts` — rewrite `assertUniqueName` from `findUnique({ where: { name } })` to `findFirst` (**hard compile break** after constraint change)
- [ ] `expense-categories.service.ts` — confirm `findOne` (`findUnique` by integer id) is scoped via the middleware's findUnique→findFirst rewrite
- [ ] **IF Category per-org:** `products.service.ts` `assertCategoryExists` — confirm the category lookup is org-scoped (guessable integer id)
- [ ] `users.service.ts` — `resolveStoreIdForRole`: handle `super_admin` (no storeId allowed)
- [ ] `users.service.ts` — `update`: prevent changing a user's `organizationId` to a different org
- [ ] `users.service.ts` — `update`/`activate`: when assigning store to manager, verify store belongs to same org
- [ ] All audit log writes in existing services — verify Prisma middleware correctly injects `organizationId` (these are regular request-context writes, so middleware should handle them; spot-check a few)
- [ ] Sales module — verify `organizationId` is set on `SaleCorrection` (middleware should handle)
- [ ] Verify: `hasStores = false` blocks `branch_manager` user creation (in the signup hook, Phase 2)

---

### Phase 6 — Frontend: Type & Auth Updates

- [ ] `lib/types.ts` — extend `Role` type; add `organizationId`, `organizationName`, `hasStores` to `AppUser`
- [ ] `types/auth/me.ts` (or wherever `ApiUser` is defined) — add `organization: { id, name, hasStores } | null`
- [ ] `lib/auth/map-user.ts` — handle `super_admin` role; populate `organization*` and `hasStores` fields
- [ ] `lib/auth/routes.ts` — add `SUPER_ADMIN_ONLY_ROUTE_PREFIXES`; update `isRouteAllowedForRole` for three roles

---

### Phase 7 — Frontend: Tenant-Aware Shell

- [ ] `components/shell/sidebar.tsx` — accept `"super_admin"` as a `Role`; add `SUPER_ADMIN_NAV`; make `ADMIN_NAV` dynamic based on `hasStores`; add `hasStores` prop
- [ ] `components/shell/app-shell.tsx` — update `roleDenied` redirect: super_admin → `/super-admin`; add super-admin page titles; pass `hasStores` to `Sidebar`
- [ ] `lib/auth/routes.ts` — add `/super-admin` to protected prefixes
- [ ] `store/app.ts` — no changes needed (derives from `AppUser` type which is already updated)

---

### Phase 8 — Frontend: Super-Admin UI

- [ ] Create `web/app/(super-admin)/layout.tsx` — separate shell (not AppShell; super-admin sidebar only)
- [ ] `/super-admin/page.tsx` — platform dashboard (org count, total users)
- [ ] `/super-admin/organizations/page.tsx` — organizations table
- [ ] `/super-admin/organizations/new/page.tsx` — create org form
- [ ] `/super-admin/organizations/[id]/page.tsx` — org detail, user list, settings
- [ ] Add TanStack Query hooks for `/api/organizations` endpoints
- [ ] Middleware / route guard: redirect non-super_admin away from `/super-admin/*`

---

### Phase 9 — Frontend: hasStores Conditional UI

- [ ] `hasStores = false`: admin sees `/submit-sale` in sidebar (currently manager-only in sidebar)
- [ ] `hasStores = false`: users page — hide "assign to store" field when creating/editing users
- [ ] `hasStores = false`: dashboard — hide per-store breakdown widgets (if any exist)
- [ ] `lib/auth/routes.ts`: `/submit-sale` must not be forbidden for admin when `hasStores = false`

---

### Phase 10 — Testing & Validation

- [ ] Sign in as `super_admin` — confirm redirected to `/super-admin`, org management works, cannot access `/dashboard`
- [ ] Create a `hasStores = true` org — confirm full current functionality works unchanged for its admin and managers
- [ ] Create a `hasStores = false` org — confirm stores/manager features are hidden, admin can submit sales directly
- [ ] **Cross-tenant leak test**: log in as admin of Org A, attempt to query Org B's products/sales via API — confirm 0 results or empty response (not 403, since the filter just returns nothing)
- [ ] **Reports test**: run all dashboard/financial/stock-report endpoints for Org A — confirm no data from Org B appears
- [ ] **Inventory locking test**: confirm `findInventoryRowForUpdate` raw SQL correctly scopes to org; confirm advisory lock key is org-specific
- [ ] **Signup validation test**: attempt to create a `branch_manager` in a `hasStores = false` org — confirm rejection
- [ ] **Audit log in signup hook**: create a user via signup, confirm the `AuditLog` record has correct `organizationId` even though it was written outside the request context
- [ ] **Category uniqueness**: confirm two orgs can each have a category named "Electronics" without conflict
- [ ] **Migration test**: confirm all existing data is intact and accessible after the backfill

---

## 13. Things to Be Careful About — Summary

1. **`auth.config.ts` `additionalFields`** — If `organizationId` is not added here, it will never be in the session. Everything downstream breaks silently. This is the most foundational change.

2. **`auth.constants.ts` `USER_ROLES`** — The signup hook uses `isUserRole()` to validate the role field. If `super_admin` is not in this array, any attempt to create a super_admin via signup will be rejected with "role must be admin or branch_manager".

3. **Better-Auth hooks run outside the NestJS request context** — `AsyncLocalStorage` tenant context is NOT set during auth hooks. Any Prisma writes inside auth hooks (audit logs, user creation side effects) must manually pass `organizationId`. Do not rely on middleware here.

4. **Reports service has 10+ raw SQL queries** — Middleware cannot protect these. Missing even one `organizationId` filter leaks every tenant's financial data to every other tenant. Treat this as a security-critical fix, not just a correctness fix.

5. **Advisory lock key must include `organizationId`** — Two tenants with coincidentally identical `productId`+`storeId` strings would share the same Postgres advisory lock, causing unnecessary contention or, in pathological cases, deadlock.

6. **`Category` and `ExpenseCategory` unique constraint** — The migration must drop `@@unique([name])` and replace it with `@@unique([name, organizationId])`. If this is done in one step it will fail on backfill because all rows will have the same `organizationId`. The two-step migration (nullable first, backfill, then NOT NULL) handles this correctly.

7. **`super_admin` must be blocked from tenant routes** — `super_admin` has no `organizationId`, so any query they make against a tenant-scoped table with the middleware bypassed will return all rows from all orgs. They must be confined to `/super-admin/*` routes at the routing layer.

8. **`map-user.ts` role mapping** — `super_admin` currently falls through to `"admin"` silently. The sidebar, route guards, and app shell all depend on the role being correct. Fix this early.

9. **`hasStores = false` + `branch_manager` creation** — Must be blocked in the signup hook (backend), not just hidden in the UI. A malicious call to `/api/auth/sign-up/email` with `role: branch_manager` and a `hasStores = false` org must be rejected.

10. **Email is globally unique** — Two different tenants cannot have a user with the same email address. This is by design (Better-Auth uses email as the global login key) and is documented in Section 11. Do not try to change this without evaluating Better-Auth's internals deeply.

11. **Prisma `findUnique`/`update`/`delete` cannot take `organizationId` in `where`** — This is the deepest technical trap. The middleware must rewrite `findUnique`→`findFirst`; `update`/`delete` rely on a preceding scoped read. See Section 6. Getting this wrong means either runtime crashes (`Unknown argument 'organizationId'`) or silent cross-tenant leaks. This invalidates the naive "just inject the filter everywhere" mental model.

12. **`expense-categories.service.ts assertUniqueName` is a hard compile break** — Changing the unique constraint removes `name` from `findUnique`'s allowed `where`. The build will fail until it's rewritten to `findFirst`. Catch this in Phase 1/2, not at runtime.

13. **Categories have no create endpoint** — The whole "categories are per-org" assumption requires a seeding mechanism that does not exist. Resolve the Section 7.13 fork (recommend: keep categories global) BEFORE writing the schema, or you'll build a feature with no way to populate it for new tenants.

14. **15 raw SQL queries across 3 files, not 2** — `inventory.service.ts` has 3 raw queries (`buildLowStockFilter`, two in `findStockAlerts`) that the v2 doc missed entirely. A missed inventory raw query leaks stock levels and alert counts across tenants. Full list in Section 9.

15. **Transaction-scoped writes depend on the extension firing for `tx.*`** — `sales`, `stock-supplies`, `expenses`, `users` all create rows inside `$transaction`. If the middleware/extension does not auto-inject `organizationId` on `tx.create()`, those inserts will fail the NOT NULL constraint (or worse, succeed with a wrong/missing org if the column were nullable). Write a transaction test in Phase 2 to prove the extension fires inside `$transaction` before building on it.
