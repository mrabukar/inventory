import { Prisma } from "@prisma/client";

export type LockedInventoryRow = {
  id: string;
  productId: string;
  storeId: string;
  quantity: number;
};

/**
 * Serializes all inventory mutations for a product–store pair within the current
 * transaction (including concurrent first-time row creation).
 */
export async function acquireInventoryMutationLock(
  tx: Prisma.TransactionClient,
  organizationId: string,
  productId: string,
  storeId: string,
): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${organizationId} || ':' || ${productId}),
      hashtext(${storeId})
    )
  `;
}

/**
 * Loads an inventory row with a PostgreSQL row-level lock (`FOR UPDATE`).
 * Prefer {@link lockInventoryForMutation} at the start of quantity mutations.
 */
export async function findInventoryRowForUpdate(
  tx: Prisma.TransactionClient,
  organizationId: string,
  productId: string,
  storeId: string,
): Promise<LockedInventoryRow | null> {
  const rows = await tx.$queryRaw<LockedInventoryRow[]>`
    SELECT id, "productId", "storeId", quantity
    FROM inventory
    WHERE "productId" = ${productId}
      AND "storeId" = ${storeId}
      AND "organizationId" = ${organizationId}
    FOR UPDATE
  `;

  return rows[0] ?? null;
}

/**
 * Acquires an advisory transaction lock, then loads the inventory row with
 * `FOR UPDATE` when it exists. Use before any read–modify–write on quantity.
 */
export async function lockInventoryForMutation(
  tx: Prisma.TransactionClient,
  organizationId: string,
  productId: string,
  storeId: string,
): Promise<LockedInventoryRow | null> {
  await acquireInventoryMutationLock(tx, organizationId, productId, storeId);
  return findInventoryRowForUpdate(tx, organizationId, productId, storeId);
}
