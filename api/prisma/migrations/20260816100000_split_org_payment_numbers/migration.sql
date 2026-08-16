-- Replace the single "paymentNumber" with three payment channels
-- (EVC, E-Dahab, and bank/account number) so admins can list all three
-- ways customers can pay them.
ALTER TABLE "organization" ADD COLUMN "evcNumber" TEXT;
ALTER TABLE "organization" ADD COLUMN "edahabNumber" TEXT;
ALTER TABLE "organization" ADD COLUMN "accountNumber" TEXT;

-- Preserve any existing "pay to" number by carrying it into the new
-- generic "accountNumber" field.
UPDATE "organization" SET "accountNumber" = "paymentNumber" WHERE "paymentNumber" IS NOT NULL;

ALTER TABLE "organization" DROP COLUMN "paymentNumber";
