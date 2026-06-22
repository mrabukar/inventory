-- CreateEnum
CREATE TYPE "PurchaseType" AS ENUM ('purchase', 'correction');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PURCHASE_CORRECTED';

-- AlterTable
ALTER TABLE "purchase" ADD COLUMN     "correctsPurchaseId" TEXT,
ADD COLUMN     "type" "PurchaseType" NOT NULL DEFAULT 'purchase';

-- CreateIndex
CREATE INDEX "purchase_type_idx" ON "purchase"("type");

-- CreateIndex
CREATE INDEX "purchase_correctsPurchaseId_idx" ON "purchase"("correctsPurchaseId");

-- AddForeignKey
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_correctsPurchaseId_fkey" FOREIGN KEY ("correctsPurchaseId") REFERENCES "purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
