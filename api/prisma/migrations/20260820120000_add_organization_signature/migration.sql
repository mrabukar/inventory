-- AlterTable
ALTER TABLE "organization" ADD COLUMN "signatureKey" TEXT;
ALTER TABLE "organization" ADD COLUMN "signatureUpdatedAt" TIMESTAMP(3);
