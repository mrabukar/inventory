-- Convert product category ids from autoincrement integers to cuid-style strings.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "category" ADD COLUMN "new_id" TEXT;
UPDATE "category" SET "new_id" = 'c' || encode(gen_random_bytes(12), 'hex');

ALTER TABLE "product" ADD COLUMN "new_category_id" TEXT;
UPDATE "product" p
SET "new_category_id" = c."new_id"
FROM "category" c
WHERE p."categoryId" = c."id";

ALTER TABLE "product" DROP CONSTRAINT "product_categoryId_fkey";

ALTER TABLE "category" DROP CONSTRAINT "category_pkey";
ALTER TABLE "category" DROP COLUMN "id";
ALTER TABLE "category" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "category" ADD CONSTRAINT "category_pkey" PRIMARY KEY ("id");

DROP SEQUENCE IF EXISTS "category_id_seq";

ALTER TABLE "product" DROP COLUMN "categoryId";
ALTER TABLE "product" RENAME COLUMN "new_category_id" TO "categoryId";
ALTER TABLE "product" ALTER COLUMN "categoryId" SET NOT NULL;

ALTER TABLE "product" ADD CONSTRAINT "product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
