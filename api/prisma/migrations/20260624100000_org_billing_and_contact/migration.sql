-- Organization billing gate + invoice contact fields.
ALTER TABLE "organization" ADD COLUMN "billingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organization" ADD COLUMN "phone" TEXT;
ALTER TABLE "organization" ADD COLUMN "paymentNumber" TEXT;
ALTER TABLE "organization" ADD COLUMN "address" TEXT;

-- Default billing to the no-branch orgs (matches today's "billing = no-branch").
UPDATE "organization" SET "billingEnabled" = NOT "hasStores";
