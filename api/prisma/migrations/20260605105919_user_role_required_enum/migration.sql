-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'branch_manager');

-- Backfill NULL roles (dev/test users created before role was required)
UPDATE "user" SET "role" = 'admin' WHERE "role" IS NULL;

-- Convert TEXT to enum in place
ALTER TABLE "user" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::"UserRole");

-- Enforce NOT NULL
ALTER TABLE "user" ALTER COLUMN "role" SET NOT NULL;
