-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_RECORDED';

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paidAt" DATE NOT NULL,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_invoiceId_idx" ON "payment"("invoiceId");

-- CreateIndex
CREATE INDEX "payment_customerId_idx" ON "payment"("customerId");

-- CreateIndex
CREATE INDEX "payment_organizationId_idx" ON "payment"("organizationId");

-- CreateIndex
CREATE INDEX "payment_paidAt_idx" ON "payment"("paidAt");

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

