-- AlterTable
ALTER TABLE "organization" ADD COLUMN "domain" TEXT;

-- CreateIndex
CREATE INDEX "organization_domain_idx" ON "organization"("domain");
