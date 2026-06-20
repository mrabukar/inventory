-- CreateEnum extension for super_admin
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'super_admin';

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hasStores" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- Add nullable organizationId columns
ALTER TABLE "user" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "store" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "category" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "product" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "inventory" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "sale" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "sale_correction" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "stock_supply" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "expense_category" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "expense" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "audit_log" ADD COLUMN "organizationId" TEXT;

-- Drop global unique constraints before backfill
ALTER TABLE "category" DROP CONSTRAINT IF EXISTS "category_name_key";
ALTER TABLE "expense_category" DROP CONSTRAINT IF EXISTS "expense_category_name_key";

-- Backfill: default organization only when upgrading existing tenant data.
-- Greenfield installs (no stores/products/org users) drop pre-migration seed rows instead.
DO $$
DECLARE
  needs_backfill BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM "store"
    UNION ALL
    SELECT 1 FROM "product"
    UNION ALL
    SELECT 1 FROM "sale"
    UNION ALL
    SELECT 1 FROM "user" WHERE "role" IN ('admin', 'branch_manager')
    LIMIT 1
  ) INTO needs_backfill;

  IF needs_backfill THEN
    INSERT INTO "organization" ("id", "name", "hasStores", "isActive", "createdAt", "updatedAt")
    VALUES ('cldefault00000000000000001', 'Default Organization', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    UPDATE "user" SET "organizationId" = 'cldefault00000000000000001' WHERE "organizationId" IS NULL;
    UPDATE "store" SET "organizationId" = 'cldefault00000000000000001' WHERE "organizationId" IS NULL;
    UPDATE "category" SET "organizationId" = 'cldefault00000000000000001' WHERE "organizationId" IS NULL;
    UPDATE "product" SET "organizationId" = 'cldefault00000000000000001' WHERE "organizationId" IS NULL;
    UPDATE "inventory" SET "organizationId" = 'cldefault00000000000000001' WHERE "organizationId" IS NULL;
    UPDATE "sale" SET "organizationId" = 'cldefault00000000000000001' WHERE "organizationId" IS NULL;
    UPDATE "sale_correction" SET "organizationId" = 'cldefault00000000000000001' WHERE "organizationId" IS NULL;
    UPDATE "stock_supply" SET "organizationId" = 'cldefault00000000000000001' WHERE "organizationId" IS NULL;
    UPDATE "expense_category" SET "organizationId" = 'cldefault00000000000000001' WHERE "organizationId" IS NULL;
    UPDATE "expense" SET "organizationId" = 'cldefault00000000000000001' WHERE "organizationId" IS NULL;
    UPDATE "audit_log" SET "organizationId" = 'cldefault00000000000000001' WHERE "organizationId" IS NULL;
  ELSE
    DELETE FROM "category";
    DELETE FROM "expense_category";
  END IF;
END $$;

-- Enforce NOT NULL (user keeps nullable for super_admin)
ALTER TABLE "store" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "category" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "product" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "inventory" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "sale" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "sale_correction" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "stock_supply" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "expense_category" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "expense" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "audit_log" ALTER COLUMN "organizationId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "store" ADD CONSTRAINT "store_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "category" ADD CONSTRAINT "category_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product" ADD CONSTRAINT "product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale" ADD CONSTRAINT "sale_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_correction" ADD CONSTRAINT "sale_correction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_supply" ADD CONSTRAINT "stock_supply_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expense_category" ADD CONSTRAINT "expense_category_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expense" ADD CONSTRAINT "expense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add compound unique constraints
CREATE UNIQUE INDEX "category_name_organizationId_key" ON "category"("name", "organizationId");
CREATE UNIQUE INDEX "expense_category_name_organizationId_key" ON "expense_category"("name", "organizationId");

-- AddEnumValue for audit actions
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ORGANIZATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ORGANIZATION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ORGANIZATION_DEACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ORGANIZATION_REACTIVATED';
