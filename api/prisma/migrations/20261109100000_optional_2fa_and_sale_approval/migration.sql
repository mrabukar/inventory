-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'USER_2FA_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_2FA_REQUIRED';
ALTER TYPE "AuditAction" ADD VALUE 'SALE_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'SALE_REJECTED';

-- AlterEnum
ALTER TYPE "SaleStatus" ADD VALUE 'pending';
ALTER TYPE "SaleStatus" ADD VALUE 'rejected';

-- AlterTable
ALTER TABLE "user" ADD COLUMN "twoFactorRequired" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "sale" ADD COLUMN "paidAtSubmission" DECIMAL(10,2),
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "rejectionReason" TEXT;

-- CreateIndex
CREATE INDEX "sale_status_idx" ON "sale"("status");

-- AddForeignKey
ALTER TABLE "sale" ADD CONSTRAINT "sale_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
