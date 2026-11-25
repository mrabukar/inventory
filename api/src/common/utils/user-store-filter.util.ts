import { Prisma, StoreType } from "@prisma/client";

/** The `storeId` value that means the organization itself, not a credit branch. */
export const OWN_STORE_FILTER = "own";

/**
 * Narrows a user filter to the organization itself (`own`: not a credit
 * branch's people), every credit branch's people (`all`), or one branch's.
 * Anything else is no filter.
 */
export function userStoreFilter(
  value: string | undefined,
): Prisma.UserWhereInput | undefined {
  const wanted = typeof value === "string" ? value.trim() : "";
  if (!wanted) return undefined;
  if (wanted === OWN_STORE_FILTER) {
    return {
      OR: [{ storeId: null }, { store: { type: { not: StoreType.credit } } }],
    };
  }
  if (wanted === "all") {
    return { store: { type: StoreType.credit } };
  }
  return { storeId: wanted };
}
