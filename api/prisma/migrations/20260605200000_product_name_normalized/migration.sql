-- AlterTable
ALTER TABLE "product" ADD COLUMN "normalizedName" TEXT;

-- Backfill existing rows
UPDATE "product"
SET "normalizedName" = lower(regexp_replace(trim("name"), '\s+', '', 'g'))
WHERE "normalizedName" IS NULL;

ALTER TABLE "product" ALTER COLUMN "normalizedName" SET NOT NULL;

-- Active products only: one normalized name at a time
CREATE UNIQUE INDEX "product_normalizedName_active_key"
ON "product" ("normalizedName")
WHERE "isActive" = true;

CREATE INDEX "product_normalizedName_idx" ON "product"("normalizedName");
