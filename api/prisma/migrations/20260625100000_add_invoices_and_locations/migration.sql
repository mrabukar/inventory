-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('unpaid', 'partial', 'paid');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'SALE_LOCATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'SALE_LOCATION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_CREATED';

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "nextInvoiceNumber" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "sale" ADD COLUMN     "locationId" TEXT;

-- CreateTable
CREATE TABLE "sale_location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "numberLabel" TEXT NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'unpaid',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sale_location_organizationId_idx" ON "sale_location"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_location_name_organizationId_key" ON "sale_location"("name", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_saleId_key" ON "invoice"("saleId");

-- CreateIndex
CREATE INDEX "invoice_customerId_idx" ON "invoice"("customerId");

-- CreateIndex
CREATE INDEX "invoice_status_idx" ON "invoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_organizationId_number_key" ON "invoice"("organizationId", "number");

-- AddForeignKey
ALTER TABLE "sale" ADD CONSTRAINT "sale_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "sale_location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_location" ADD CONSTRAINT "sale_location_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

