-- Drop the legacy `purchasePrice` column from `product`.
-- Cost is now tracked via `averageCost` (moving weighted average from purchases).
-- The column was unused (always 0 for new products) and existing cost was
-- already migrated into `averageCost`, so no data of value is lost.
ALTER TABLE "product" DROP COLUMN IF EXISTS "purchasePrice";
