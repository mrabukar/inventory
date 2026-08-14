-- Multi-item sales: split Sale into a header + SaleItem line items.
-- Non-destructive: existing single-product sales are backfilled into one line
-- item each BEFORE the moved columns are dropped from "sale".

-- CreateTable
CREATE TABLE "sale_item" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "saleDate" DATE NOT NULL,
    "quantitySold" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "unitPurchasePrice" DECIMAL(10,2) NOT NULL,
    "lineTotal" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sale_item_saleId_idx" ON "sale_item"("saleId");
CREATE INDEX "sale_item_productId_idx" ON "sale_item"("productId");
CREATE INDEX "sale_item_organizationId_idx" ON "sale_item"("organizationId");
CREATE INDEX "sale_item_storeId_idx" ON "sale_item"("storeId");
CREATE INDEX "sale_item_saleDate_idx" ON "sale_item"("saleDate");

-- Backfill one line item per existing sale.
INSERT INTO "sale_item" (
  "id", "saleId", "productId", "organizationId", "storeId", "saleDate",
  "quantitySold", "unitPrice", "unitPurchasePrice", "lineTotal", "createdAt"
)
SELECT
  gen_random_uuid()::text, s."id", s."productId", s."organizationId",
  s."storeId", s."saleDate", s."quantitySold", s."unitPrice",
  s."unitPurchasePrice", s."totalAmount", s."createdAt"
FROM "sale" s;

-- sale_correction gets a per-line reference (nullable, backfill, then NOT NULL).
ALTER TABLE "sale_correction" ADD COLUMN "saleItemId" TEXT;
UPDATE "sale_correction" sc
SET "saleItemId" = si."id"
FROM "sale_item" si
WHERE si."saleId" = sc."saleId";
ALTER TABLE "sale_correction" ALTER COLUMN "saleItemId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "sale_correction_saleItemId_idx" ON "sale_correction"("saleItemId");

-- AddForeignKey
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_correction" ADD CONSTRAINT "sale_correction_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop the moved columns from "sale" (data now lives in sale_item).
ALTER TABLE "sale" DROP CONSTRAINT IF EXISTS "sale_productId_fkey";
DROP INDEX IF EXISTS "sale_productId_idx";
ALTER TABLE "sale" DROP COLUMN "productId";
ALTER TABLE "sale" DROP COLUMN "quantitySold";
ALTER TABLE "sale" DROP COLUMN "unitPrice";
ALTER TABLE "sale" DROP COLUMN "unitPurchasePrice";
