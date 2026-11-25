-- AlterTable
ALTER TABLE "organization" ADD COLUMN "usesCreditBranches" BOOLEAN NOT NULL DEFAULT false;

-- Organizations without stores that already have credit branches are credit
-- organizations. Their branches' invoices need billing, so switch it on.
UPDATE "organization" o
SET "usesCreditBranches" = true,
    "billingEnabled" = true
WHERE o."hasStores" = false
  AND EXISTS (
    SELECT 1 FROM "store" s
    WHERE s."organizationId" = o.id AND s."type" = 'credit'
  );
