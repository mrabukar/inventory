-- DropForeignKey
ALTER TABLE "invoice" DROP CONSTRAINT "invoice_customerId_fkey";

-- DropForeignKey
ALTER TABLE "payment" DROP CONSTRAINT "payment_customerId_fkey";

-- AlterTable
ALTER TABLE "invoice" ALTER COLUMN "customerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "payment" ALTER COLUMN "customerId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

