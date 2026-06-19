import { Prisma } from "@prisma/client";
import type { TenantContextService } from "../common/tenant/tenant-context.service";

const TENANT_MODELS = new Set([
  "User",
  "Store",
  "Category",
  "Product",
  "Inventory",
  "Sale",
  "SaleCorrection",
  "StockSupply",
  "ExpenseCategory",
  "Expense",
  "AuditLog",
]);

const WHERE_OPERATIONS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

type QueryArgs = Record<string, unknown>;

function shouldBypass(model: string, orgId: string | null | undefined): boolean {
  if (!TENANT_MODELS.has(model)) {
    return true;
  }
  if (orgId === undefined) {
    return true;
  }
  if (orgId === null) {
    return true;
  }
  return false;
}

function withOrgWhere(where: unknown, orgId: string): QueryArgs {
  const base =
    where && typeof where === "object" ? (where as QueryArgs) : {};
  return { ...base, organizationId: orgId };
}

function pickFindArgs(args: QueryArgs): QueryArgs {
  const { where: _where, ...rest } = args;
  return rest;
}

function injectCreateData(
  data: unknown,
  orgId: string,
): Record<string, unknown> | Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.map((row) => ({
      ...(row as Record<string, unknown>),
      organizationId: orgId,
    }));
  }
  return {
    ...(data as Record<string, unknown>),
    organizationId: orgId,
  };
}

export function createTenantExtension(tenantContext: TenantContextService) {
  const getOrgId = (): string | null | undefined => tenantContext.get();

  return Prisma.defineExtension({
    name: "tenant-scoping",
    query: {
      $allModels: {
        async findUnique({ model, args, query }) {
          const orgId = getOrgId();
          if (shouldBypass(model, orgId)) {
            return query(args);
          }

          const context = Prisma.getExtensionContext(this) as Record<
            string,
            { findFirst: (a: QueryArgs) => Promise<unknown> }
          >;
          const key = modelDelegateKey(model);
          const delegate = context[key];
          if (!delegate?.findFirst) {
            return query(args);
          }

          return delegate.findFirst({
            ...pickFindArgs(args as QueryArgs),
            where: withOrgWhere((args as QueryArgs).where, orgId as string),
          });
        },

        async findUniqueOrThrow({ model, args, query }) {
          const orgId = getOrgId();
          if (shouldBypass(model, orgId)) {
            return query(args);
          }

          const context = Prisma.getExtensionContext(this) as Record<
            string,
            { findFirstOrThrow: (a: QueryArgs) => Promise<unknown> }
          >;
          const key = modelDelegateKey(model);
          const delegate = context[key];
          if (!delegate?.findFirstOrThrow) {
            return query(args);
          }

          return delegate.findFirstOrThrow({
            ...pickFindArgs(args as QueryArgs),
            where: withOrgWhere((args as QueryArgs).where, orgId as string),
          });
        },

        async $allOperations({ model, operation, args, query }) {
          const orgId = getOrgId();
          if (shouldBypass(model, orgId)) {
            return query(args);
          }

          const scopedArgs = { ...(args as QueryArgs) };

          if (WHERE_OPERATIONS.has(operation)) {
            scopedArgs.where = withOrgWhere(scopedArgs.where, orgId as string);
            return query(scopedArgs);
          }

          if (operation === "create") {
            scopedArgs.data = injectCreateData(scopedArgs.data, orgId as string);
            return query(scopedArgs);
          }

          if (operation === "createMany") {
            scopedArgs.data = injectCreateData(scopedArgs.data, orgId as string);
            return query(scopedArgs);
          }

          return query(args);
        },
      },
    },
  });
}

function modelDelegateKey(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}
