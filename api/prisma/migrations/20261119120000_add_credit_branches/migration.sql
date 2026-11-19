-- CreateEnum
CREATE TYPE "BranchPaymentMethod" AS ENUM ('cash', 'evc', 'edahab', 'bank');

-- CreateEnum
CREATE TYPE "BranchPaymentStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "StoreType" AS ENUM ('standard', 'credit');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'BRANCH_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'BRANCH_CREDIT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'BRANCH_RETURN_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'BRANCH_PAYMENT_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'BRANCH_PAYMENT_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'BRANCH_PAYMENT_REJECTED';

-- AlterTable
ALTER TABLE "customer" ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "store" ADD COLUMN     "type" "StoreType" NOT NULL DEFAULT 'standard';

-- CreateTable
CREATE TABLE "branch_credit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_credit_item" (
    "id" TEXT NOT NULL,
    "branchCreditId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_credit_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_return" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "branchCreditItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_return_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "branchCreditId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" DATE NOT NULL,
    "method" "BranchPaymentMethod" NOT NULL,
    "reference" TEXT,
    "status" "BranchPaymentStatus" NOT NULL DEFAULT 'pending',
    "submittedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branch_credit_organizationId_idx" ON "branch_credit"("organizationId");

-- CreateIndex
CREATE INDEX "branch_credit_storeId_idx" ON "branch_credit"("storeId");

-- CreateIndex
CREATE INDEX "branch_credit_item_branchCreditId_idx" ON "branch_credit_item"("branchCreditId");

-- CreateIndex
CREATE INDEX "branch_credit_item_productId_idx" ON "branch_credit_item"("productId");

-- CreateIndex
CREATE INDEX "branch_return_organizationId_idx" ON "branch_return"("organizationId");

-- CreateIndex
CREATE INDEX "branch_return_storeId_idx" ON "branch_return"("storeId");

-- CreateIndex
CREATE INDEX "branch_return_branchCreditItemId_idx" ON "branch_return"("branchCreditItemId");

-- CreateIndex
CREATE INDEX "branch_payment_organizationId_idx" ON "branch_payment"("organizationId");

-- CreateIndex
CREATE INDEX "branch_payment_storeId_idx" ON "branch_payment"("storeId");

-- CreateIndex
CREATE INDEX "branch_payment_status_idx" ON "branch_payment"("status");

-- CreateIndex
CREATE INDEX "customer_storeId_idx" ON "customer"("storeId");

-- AddForeignKey
ALTER TABLE "branch_credit" ADD CONSTRAINT "branch_credit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_credit" ADD CONSTRAINT "branch_credit_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_credit" ADD CONSTRAINT "branch_credit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_credit_item" ADD CONSTRAINT "branch_credit_item_branchCreditId_fkey" FOREIGN KEY ("branchCreditId") REFERENCES "branch_credit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_credit_item" ADD CONSTRAINT "branch_credit_item_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_credit_item" ADD CONSTRAINT "branch_credit_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_return" ADD CONSTRAINT "branch_return_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_return" ADD CONSTRAINT "branch_return_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_return" ADD CONSTRAINT "branch_return_branchCreditItemId_fkey" FOREIGN KEY ("branchCreditItemId") REFERENCES "branch_credit_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_return" ADD CONSTRAINT "branch_return_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_payment" ADD CONSTRAINT "branch_payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_payment" ADD CONSTRAINT "branch_payment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_payment" ADD CONSTRAINT "branch_payment_branchCreditId_fkey" FOREIGN KEY ("branchCreditId") REFERENCES "branch_credit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_payment" ADD CONSTRAINT "branch_payment_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_payment" ADD CONSTRAINT "branch_payment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
