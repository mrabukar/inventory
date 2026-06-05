-- Fix name: backfill nulls then make non-nullable with empty string default
UPDATE "user" SET "name" = '' WHERE "name" IS NULL;
ALTER TABLE "user" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "user" ALTER COLUMN "name" SET DEFAULT '';

-- Fix isActive: backfill nulls then make non-nullable with true default
UPDATE "user" SET "isActive" = true WHERE "isActive" IS NULL;
ALTER TABLE "user" ALTER COLUMN "isActive" SET NOT NULL;
ALTER TABLE "user" ALTER COLUMN "isActive" SET DEFAULT true;
