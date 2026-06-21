-- Legacy products: seed averageCost from purchasePrice when no purchase has set cost yet.
UPDATE "product"
SET "averageCost" = "purchasePrice"
WHERE "averageCost" = 0
  AND "purchasePrice" > 0;
