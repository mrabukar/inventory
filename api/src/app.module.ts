import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { IncomingMessage, ServerResponse } from "http";
import { LoggerModule } from "nestjs-pino";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { envValidationSchema } from "./config/env.validation";
import { BetterAuthNestModule } from "./modules/auth/auth.module";
import { AuditLogsModule } from "./modules/audit-logs/audit-logs.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { HealthModule } from "./modules/health/health.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { ProductsModule } from "./modules/products/products.module";
import { ExpenseCategoriesModule } from "./modules/expense-categories/expense-categories.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { SalesModule } from "./modules/sales/sales.module";
import { StockSuppliesModule } from "./modules/stock-supplies/stock-supplies.module";
import { StoresModule } from "./modules/stores/stores.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { OrganizationBrandingModule } from "./modules/organization-branding/organization-branding.module";
import { UsersModule } from "./modules/users/users.module";
import { PrismaModule } from "./prisma/prisma.module";
import { TenantModule } from "./common/tenant/tenant.module";
import { StorageModule } from "./common/storage/storage.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== "production"
            ? {
                target: "pino-pretty",
                options: { colorize: true, singleLine: true },
              }
            : undefined,
        level: "info",
        redact: ["req.headers.cookie", "req.headers.authorization"],
        serializers: {
          req: () => undefined,
          res: () => undefined,
        },
        customSuccessMessage: (
          req: IncomingMessage,
          res: ServerResponse,
          responseTime: number,
        ) =>
          `${req.method ?? "?"} ${req.url ?? "?"} ${res.statusCode} ${responseTime}ms`,
        customErrorMessage: (
          req: IncomingMessage,
          res: ServerResponse,
          error: Error,
        ) =>
          `${req.method ?? "?"} ${req.url ?? "?"} ${res.statusCode} ${error.message}`,
      },
    }),
    PrismaModule,
    TenantModule,
    StorageModule,
    HealthModule,
    BetterAuthNestModule,
    StoresModule,
    CategoriesModule,
    ProductsModule,
    InventoryModule,
    StockSuppliesModule,
    AuditLogsModule,
    SalesModule,
    ExpenseCategoriesModule,
    ExpensesModule,
    ReportsModule,
    OrganizationsModule,
    OrganizationBrandingModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
