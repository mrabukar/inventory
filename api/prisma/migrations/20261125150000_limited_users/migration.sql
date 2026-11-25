-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'limited_user';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "allowedPages" TEXT[] DEFAULT ARRAY[]::TEXT[];
