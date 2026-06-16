-- AlterTable
ALTER TABLE "product" ADD COLUMN "model" TEXT;
ALTER TABLE "product" ADD COLUMN "normalizedModel" TEXT;

-- Active products: unique by normalized name + model (null model = name-only products)
DROP INDEX IF EXISTS "product_normalizedName_active_key";

CREATE UNIQUE INDEX "product_normalizedName_normalizedModel_active_key"
ON "product" ("normalizedName", "normalizedModel")
WHERE "isActive" = true;
