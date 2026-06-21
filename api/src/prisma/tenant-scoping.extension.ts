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
  "Purchase",
]);

const WHERE_OPERATIONS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

type QueryArgs = Record<string, unknown>;

export function shouldBypass(
  model: string,
  orgId: string | null | undefined,
): boolean {
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

export function withOrgWhere(where: unknown, orgId: string): QueryArgs {
  const base = where && typeof where === "object" ? (where as QueryArgs) : {};
  return { ...base, organizationId: orgId };
}

function pickFindArgs(args: QueryArgs): QueryArgs {
  const rest = { ...args };
  delete rest.where;
  return rest;
}

export function injectCreateData(
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
            ...pickFindArgs(args),
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
            ...pickFindArgs(args),
            where: withOrgWhere((args as QueryArgs).where, orgId as string),
          });
        },

        async $allOperations({ model, operation, args, query }) {
          const orgId = getOrgId();
          if (shouldBypass(model, orgId)) {
            return query(args);
          }

          const scopedArgs: QueryArgs = { ...args };

          if (WHERE_OPERATIONS.has(operation)) {
            scopedArgs.where = withOrgWhere(scopedArgs.where, orgId as string);
            return query(scopedArgs);
          }

          if (operation === "create") {
            scopedArgs.data = injectCreateData(
              scopedArgs.data,
              orgId as string,
            );
            return query(scopedArgs);
          }

          if (operation === "createMany") {
            scopedArgs.data = injectCreateData(
              scopedArgs.data,
              orgId as string,
            );
            return query(scopedArgs);
          }

          if (operation === "upsert") {
            scopedArgs.where = withOrgWhere(scopedArgs.where, orgId as string);
            scopedArgs.create = injectCreateData(
              scopedArgs.create,
              orgId as string,
            );
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
