-- CreateEnum
CREATE TYPE "StockSupplyType" AS ENUM ('supply', 'correction_add', 'correction_subtract');

-- AlterTable
ALTER TABLE "stock_supply" ADD COLUMN "type" "StockSupplyType" NOT NULL DEFAULT 'supply';
ALTER TABLE "stock_supply" ADD COLUMN "correctsSupplyId" TEXT;

-- CreateIndex
CREATE INDEX "stock_supply_correctsSupplyId_idx" ON "stock_supply"("correctsSupplyId");
CREATE INDEX "stock_supply_type_idx" ON "stock_supply"("type");

-- AddForeignKey
ALTER TABLE "stock_supply" ADD CONSTRAINT "stock_supply_correctsSupplyId_fkey" FOREIGN KEY ("correctsSupplyId") REFERENCES "stock_supply"("id") ON DELETE SET NULL ON UPDATE CASCADE;
