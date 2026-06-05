# Tech Stack — Multi-Location Inventory Management System

**Version:** 1.0
**Status:** Finalized

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Backend](#3-backend)
4. [Frontend](#4-frontend)
5. [Authentication](#5-authentication)
6. [Database](#6-database)
7. [Shared Tooling](#7-shared-tooling)
8. [Development Tooling](#8-development-tooling)
9. [Project Structure](#9-project-structure)
10. [Library Version Reference](#10-library-version-reference)

---

## 1. Overview

The system is split into two separate applications — a **NestJS REST API** (backend) and a **Next.js web app** (frontend) — sharing a single **PostgreSQL** database. They communicate over HTTP using JSON. Authentication is handled by **Better-Auth** integrated into the NestJS backend, with session tokens delivered via HTTP-only cookies.

| Layer | Technology |
|---|---|
| Backend API | NestJS (TypeScript) |
| ORM | Prisma |
| Database | PostgreSQL |
| Authentication | Better-Auth |
| Frontend | Next.js 16+ (React 19, TypeScript) |
| Styling | Tailwind CSS + shadcn/ui |
| Server State | TanStack Query |
| Tables | TanStack Table |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Client State | Zustand |
| Validation (shared) | Zod |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Client Browser                    │
│                                                     │
│   Next.js 16+ App (React 19)                        │
│   ├── TanStack Query  (server state / caching)      │
│   ├── TanStack Table  (data tables)                 │
│   ├── React Hook Form + Zod  (forms / validation)   │
│   ├── Recharts  (dashboard charts)                  │
│   ├── Zustand  (client state)                       │
│   └── shadcn/ui + Tailwind CSS  (UI components)     │
└───────────────────┬─────────────────────────────────┘
                    │  HTTP (JSON) + HTTP-only Cookies
                    ▼
┌─────────────────────────────────────────────────────┐
│               NestJS REST API                       │
│                                                     │
│   ├── Better-Auth  (session / auth handler)         │
│   ├── NestJS Guards  (RBAC + store-scoped access)   │
│   ├── class-validator  (request body validation)    │
│   ├── @nestjs/throttler  (rate limiting)            │
│   └── Prisma Client  (database access)              │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
          ┌──────────────────┐
          │   PostgreSQL     │
          │   (primary DB)   │
          └──────────────────┘
```

---

## 3. Backend

### 3.1 NestJS

**Role:** Core API framework.

NestJS is a TypeScript-first Node.js framework built around modules, controllers, services, and dependency injection. Its opinionated structure keeps a multi-feature system like this (products, inventory, sales, expenses, auth) organized and maintainable as it grows.

**Why NestJS over Express:**
- Built-in dependency injection — services are testable and decoupled
- Decorator-based routing, guards, and interceptors — clean RBAC implementation
- Module boundaries enforce separation between features (e.g., `ProductsModule`, `SalesModule`, `ExpensesModule`)

**Core NestJS libraries:**

| Package | Purpose |
|---|---|
| `@nestjs/core` | Framework core |
| `@nestjs/common` | Decorators, pipes, guards, interceptors |
| `@nestjs/platform-express` | Express adapter (default HTTP layer) |
| `@nestjs/config` | Environment variable management via `.env` |
| `@nestjs/mapped-types` | DTO utilities (`PartialType`, etc.) without OpenAPI |
| `@nestjs/throttler` | Rate limiting (protects auth endpoints from brute force) |
| `class-validator` | Decorator-based request body validation |
| `class-transformer` | Transforms plain objects to class instances for validation |

---

### 3.2 Prisma

**Role:** ORM and database access layer.

Prisma provides a type-safe query API generated from your database schema. Every model in the system design (users, stores, products, inventory, sales, expenses, etc.) is defined in a `schema.prisma` file and Prisma generates the client.

**Key integration points:**

- **Prisma Client** — used in every NestJS service for querying
- **Prisma Migrate** — manages schema migrations (adding columns, new tables)
- **Better-Auth Prisma adapter** — Better-Auth writes its session/account tables through Prisma, sharing the same DB connection
- **Raw queries** — row-level locking (`SELECT FOR UPDATE`) for inventory deduction race condition prevention requires `prisma.$queryRaw`; all other operations use the generated client

```typescript
// Example: inventory deduction with row-level locking
await prisma.$transaction(async (tx) => {
  const inventory = await tx.$queryRaw`
    SELECT * FROM inventory
    WHERE product_id = ${productId} AND store_id = ${storeId}
    FOR UPDATE
  `;
  // validate quantity, then update
  await tx.inventory.update({ ... });
});
```

---

### 3.3 NestJS Guards (RBAC + Store Scope)

**Role:** Enforce role-based and store-scoped access control.

Two guards are needed on top of Better-Auth session validation:

**`AuthGuard`** — attached to all protected routes. Calls `auth.api.getSession()` and attaches the user to the request. Returns 401 if no valid session.

**`RolesGuard`** — checks `session.user.role` against the required role for the route. Returns 403 if insufficient.

**`StoreScopeGuard`** — for branch manager routes only. Checks that the `store_id` in the request matches the manager's assigned store. A branch manager cannot access another store's data even if they know the ID.

```typescript
// Route example with all three guards
@UseGuards(AuthGuard, RolesGuard, StoreScopeGuard)
@Roles('branch_manager')
@Post('sales')
createSale(@Body() dto: CreateSaleDto, @Request() req) { ... }
```

---

## 4. Frontend

### 4.1 Next.js 16+ (React 19, TypeScript)

**Role:** Full frontend application.

Next.js provides the routing, rendering, and build infrastructure. React 19 brings improved concurrent features and native form actions. TypeScript is used throughout for type safety.

**Rendering strategy per page type:**

| Page | Strategy | Reason |
|---|---|---|
| Login / public pages | Static | No auth needed, fast load |
| Dashboard | Client-side (CSR) | Real-time data via TanStack Query |
| Reports | Client-side (CSR) | Dynamic filters, date ranges |
| Product catalog | Server-side (SSR) | SEO not needed but initial data load beneficial |
| Expense pages | Client-side (CSR) | Heavy interaction, filters |

---

### 4.2 Tailwind CSS + shadcn/ui

**Role:** Styling and UI component library.

Tailwind provides utility-class CSS. shadcn/ui provides pre-built, accessible components (modals, dropdowns, tables, forms, date pickers, toasts) built on Radix UI primitives and styled with Tailwind. Components are copied into the project (not a black-box package), so they are fully customizable.

**Why shadcn/ui over other component libraries:**
- Composable and unstyled at the primitive level — no style fighting
- Tailwind-native — no CSS-in-JS overhead
- Accessible out of the box (Radix UI)
- Ships components you own, not a dependency you're locked into

**Components used in this system:** Dialog, Sheet, Table, Select, DatePicker, Form, Input, Button, Badge, Tabs, Toast, Dropdown Menu, Command (for product search in sales form).

---

### 4.3 TanStack Query

**Role:** Server state management — fetching, caching, background refetching, and mutation handling.

Every API call from the frontend goes through TanStack Query. It handles:
- Automatic caching — dashboard doesn't refetch on every tab switch
- Background refetching — data stays fresh without manual reload
- Optimistic updates — sales form feels instant
- Pagination and infinite queries — for long tables (expense list, sales history)
- Mutation state — loading/error/success states on form submissions

```typescript
// Example: fetching dashboard data for a specific store
const { data, isLoading } = useQuery({
  queryKey: ['dashboard', storeId, dateRange],
  queryFn: () => fetchDashboard(storeId, dateRange),
  staleTime: 1000 * 60 * 2, // 2 minutes
});
```

---

### 4.4 TanStack Table

**Role:** Complex data tables with filtering, sorting, and pagination.

The system has multiple heavy tables: expense list, sales history, stock supply log, product catalog. TanStack Table is headless (no built-in styles) — it gives you the logic, shadcn/ui and Tailwind provide the look. Pairs naturally with TanStack Query since query data feeds directly into table state.

**Used for:** Expenses table, Sales history, Stock supply log, Product catalog, Audit log viewer.

---

### 4.5 React Hook Form + Zod

**Role:** Form state management and validation.

React Hook Form handles form state with minimal re-renders. Zod defines validation schemas. The two are connected via the `@hookform/resolvers/zod` adapter.

**Why this matters for this system:** There are many forms — add product, record sale, add expense, create user, supply stock, correct sale. Each has different validation rules. Zod schemas are kept in sync between frontend and backend (see Section 7).

```typescript
const saleSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  unit_price: z.number().positive(),
});
```

---

### 4.6 Recharts

**Role:** Dashboard and report charts.

Recharts is a React-native charting library built on D3. It is declarative, TypeScript-friendly, and integrates cleanly with TanStack Query data.

**Charts used in this system:**

| Chart | Type | Location |
|---|---|---|
| Revenue vs COGS vs Expenses | Grouped Bar | Admin dashboard |
| Net Profit Trend | Line | Admin dashboard |
| Expense Breakdown | Pie | Admin dashboard |
| Stock Level by Store | Bar | Admin dashboard |
| Sales Trend | Line | Branch manager dashboard |
| Financial Overview | Bar + Line combo | Reports page |

---

### 4.7 Zustand

**Role:** Lightweight client state management.

TanStack Query owns all server state. Zustand handles the remaining client-side state that doesn't come from the API:

- Current authenticated user and role (read once from session, stored in Zustand)
- Active store context for branch managers
- Sidebar open/collapsed state
- Active date range filter (shared across dashboard widgets)
- Global notification/toast queue

Zustand is chosen over Redux for its minimal boilerplate and direct compatibility with React 19.

---

## 5. Authentication

### 5.1 Better-Auth Integration with NestJS

Better-Auth is integrated into NestJS as a request handler mounted at `/api/auth/*`. All authentication flows (login, logout, session refresh, password reset) pass through this handler. The rest of the NestJS API validates sessions by calling Better-Auth's `getSession` utility inside an `AuthGuard`.

**Integration architecture:**

```
Client → POST /api/auth/sign-in → Better-Auth handler in NestJS
                                 ↓
                         Better-Auth validates credentials
                         via Prisma adapter (bcrypt compare)
                                 ↓
                         Issues session token as HTTP-only cookie
                                 ↓
Client → GET /api/sales → AuthGuard calls auth.api.getSession()
                        → attaches user to request
                        → RolesGuard checks role
                        → Controller executes
```

**Better-Auth configuration:**

| Setting | Value | Reason |
|---|---|---|
| `useSecureCookies` | `true` | HTTPS-only cookie transmission |
| `session.cookieCache` | enabled | Reduces DB session lookups |
| `emailAndPassword.enabled` | `true` | Primary login method |
| `emailAndPassword.minPasswordLength` | `8` | Minimum security |
| Password hashing | bcrypt (cost 12) | Better-Auth default, matches system design |
| Session expiry | 7 days | Aligns with system design refresh window |

**Better-Auth managed tables (via Prisma adapter):**

Better-Auth creates and manages its own auth-related tables. These replace the manually designed `refresh_tokens` and `password_reset_tokens` tables from the system design:

| Better-Auth Table | Replaces |
|---|---|
| `session` | `refresh_tokens` |
| `account` | credential storage |
| `verification` | `password_reset_tokens` |
| `user` | linked to your `users` table via `userId` |

All other system tables (stores, products, inventory, sales, expenses, etc.) remain exactly as designed.

---

### 5.2 Security Measures

| Threat | Mitigation |
|---|---|
| Brute force login | `@nestjs/throttler` — rate limit `/api/auth/sign-in` to 5 attempts / 15 min |
| Session hijacking | HTTP-only + Secure + SameSite=Strict cookies |
| CSRF | Better-Auth built-in CSRF protection for cookie sessions |
| Unauthorized store access | `StoreScopeGuard` — branch manager requests validated against their assigned `store_id` |
| Privilege escalation | `RolesGuard` on all routes — admin-only endpoints explicitly protected |
| SQL injection | Prisma parameterized queries by default; raw queries use tagged template literals |
| Sensitive data exposure | Passwords never returned in API responses; `select` excludes hash fields explicitly |

---

## 6. Database

### 6.1 PostgreSQL

**Role:** Primary data store.

PostgreSQL is chosen because the system design requires:
- `CHECK` constraints (e.g., `inventory.quantity >= 0` — prevents negative stock at DB level)
- Row-level locking (`SELECT FOR UPDATE`) — prevents race conditions on concurrent inventory deductions
- ACID transactions — inventory deduction + sale record creation must be atomic
- Foreign key constraints — referential integrity across all related tables

**Connection:** Managed through Prisma. Connection pooling via **PgBouncer** is recommended for production to handle concurrent dashboard queries without exhausting the connection limit.

---

## 7. Shared Tooling

### 7.1 Zod (Validation Schemas)

Zod is used on **both** backend and frontend. Each app maintains its own schema definitions, but they are kept in sync — the same field names, types, and constraints appear on both sides.

- Frontend uses the schema for React Hook Form validation (client-side feedback before the request is sent)
- Backend uses the same schema in a custom Zod validation pipe (server-side enforcement, source of truth)

**Example schemas used in both apps:** `CreateSaleSchema`, `CreateExpenseSchema`, `CreateProductSchema`, `CreateUserSchema`.

---

### 7.2 TypeScript

TypeScript is used across the entire stack — NestJS backend, Next.js frontend, and any shared packages. Strict mode is enabled (`"strict": true` in `tsconfig.json`).

---

## 8. Development Tooling

| Tool | Purpose |
|---|---|
| **ESLint** | Linting — NestJS and Next.js both ship with ESLint configs |
| **Prettier** | Code formatting — consistent style across backend and frontend |
| **Husky + lint-staged** | Pre-commit hooks — runs ESLint and Prettier before every commit |
| **Prisma Studio** | Visual database browser — useful during development |
| **Postman** | Manual API testing — cookie-based session auth |
| **Docker Compose** | Local development environment — runs PostgreSQL locally without a cloud DB |
| **pnpm** | Package manager — fast, disk-efficient |

---

## 9. Project Structure

The backend and frontend are **fully independent applications** that live side by side in the same repository. Each has its own `package.json`, `node_modules`, dependencies, and configuration. There is no shared package layer or monorepo tooling — just two clean, self-contained projects in one repo.

```
inventory-system/
│
├── api/                          ← NestJS backend (standalone Node.js app)
│   ├── src/
│   │   ├── auth/                 ← Better-Auth handler + guards
│   │   ├── users/
│   │   ├── stores/
│   │   ├── products/
│   │   ├── inventory/
│   │   ├── sales/
│   │   ├── expenses/
│   │   ├── reports/
│   │   └── prisma/               ← Prisma service + schema.prisma
│   ├── test/
│   ├── .env
│   ├── nest-cli.json
│   ├── tsconfig.json
│   └── package.json              ← api dependencies only
│
├── web/                          ← Next.js frontend (standalone Next.js app)
│   ├── app/
│   │   ├── (auth)/               ← login page
│   │   ├── (admin)/              ← admin-only pages
│   │   └── (manager)/            ← branch manager pages
│   ├── components/
│   │   ├── ui/                   ← shadcn/ui components
│   │   ├── charts/               ← Recharts wrappers
│   │   └── tables/               ← TanStack Table wrappers
│   ├── lib/
│   │   ├── api.ts                ← API client (fetch wrapper)
│   │   └── schemas/              ← Zod validation schemas (frontend copy)
│   ├── store/                    ← Zustand stores
│   ├── .env.local
│   ├── next.config.ts
│   ├── tsconfig.json
│   └── package.json              ← web dependencies only
│
├── docker-compose.yml            ← Local PostgreSQL for development
└── README.md
```

**Running the project locally:**

```bash
# Terminal 1 — start the database
docker compose up

# Terminal 2 — start the API
cd api
pnpm install
pnpm prisma migrate dev
pnpm start:dev

# Terminal 3 — start the frontend
cd web
pnpm install
pnpm dev
```

---

## 10. Library Version Reference

| Library | Current Stable | Notes |
|---|---|---|
| NestJS | 11.x | Use `@nestjs/cli` to scaffold |
| Prisma | 6.x | Use `prisma init` after project setup |
| Better-Auth | 1.x | Install `better-auth` + `@better-auth/prisma-adapter` |
| Next.js | 16.x | Use `create-next-app` |
| React | 19.x | Installed automatically with Next.js 16 |
| TanStack Query | 5.x | `@tanstack/react-query` |
| TanStack Table | 8.x | `@tanstack/react-table` |
| React Hook Form | 7.x | `react-hook-form` |
| Zod | 3.x | `zod` |
| Recharts | 2.x | `recharts` |
| Zustand | 5.x | `zustand` |
| shadcn/ui | latest | `npx shadcn@latest init` |
| Tailwind CSS | 4.x | Configured automatically by shadcn/ui |

---

*This document should be read alongside `system-design.md` (v1.2) which defines the full data models, business rules, and feature specifications that this tech stack is built to support.*
