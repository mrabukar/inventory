-- CreateTable
CREATE TABLE "purchase" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPurchasePrice" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(10,2) NOT NULL,
    "invoiceNumber" TEXT,
    "purchaseDate" DATE NOT NULL,
    "note" TEXT,
    "purchasedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "product" ADD COLUMN "averageCost" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PURCHASE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'PRODUCT_COST_RECALCULATED';

-- Backfill averageCost from purchasePrice
UPDATE "product" SET "averageCost" = "purchasePrice";

-- Backfill warehouse stores for has-stores orgs missing one
INSERT INTO "store" ("id", "name", "address", "isActive", "isOrgWarehouse", "organizationId", "createdAt", "updatedAt")
SELECT
    'c' || encode(gen_random_bytes(12), 'hex'),
    'Organization Stock',
    '—',
    true,
    true,
    o.id,
    NOW(),
    NOW()
FROM "organization" o
WHERE o."hasStores" = true
  AND NOT EXISTS (
    SELECT 1 FROM "store" s
    WHERE s."organizationId" = o.id AND s."isOrgWarehouse" = true
  );

-- CreateIndex
CREATE INDEX "purchase_productId_idx" ON "purchase"("productId");

-- CreateIndex
CREATE INDEX "purchase_organizationId_idx" ON "purchase"("organizationId");

-- CreateIndex
CREATE INDEX "purchase_purchaseDate_idx" ON "purchase"("purchaseDate");

-- AddForeignKey
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_purchasedById_fkey" FOREIGN KEY ("purchasedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
