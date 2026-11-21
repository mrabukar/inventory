-- DropIndex
DROP INDEX "invoice_organizationId_number_key";

-- AlterTable
ALTER TABLE "invoice" ADD COLUMN     "series" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "store" ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "edahabNumber" TEXT,
ADD COLUMN     "evcNumber" TEXT,
ADD COLUMN     "invoicePrefix" TEXT,
ADD COLUMN     "nextInvoiceNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "invoice_organizationId_series_number_key" ON "invoice"("organizationId", "series", "number");

-- CreateIndex
CREATE UNIQUE INDEX "store_organizationId_invoicePrefix_key" ON "store"("organizationId", "invoicePrefix");
