-- AlterTable
ALTER TABLE "purchase" ADD COLUMN     "movedFromCorrectionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "purchase_movedFromCorrectionId_key" ON "purchase"("movedFromCorrectionId");

-- AddForeignKey
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_movedFromCorrectionId_fkey" FOREIGN KEY ("movedFromCorrectionId") REFERENCES "purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
