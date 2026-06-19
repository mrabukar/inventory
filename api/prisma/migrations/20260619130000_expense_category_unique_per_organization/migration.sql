-- expense_category_name_key was a UNIQUE INDEX, not a constraint; the multitenant
-- migration used DROP CONSTRAINT and left the global index in place.
DROP INDEX IF EXISTS "expense_category_name_key";

CREATE UNIQUE INDEX IF NOT EXISTS "expense_category_name_organizationId_key"
ON "expense_category" ("name", "organizationId");

-- Same issue for product categories.
DROP INDEX IF EXISTS "category_name_key";

CREATE UNIQUE INDEX IF NOT EXISTS "category_name_organizationId_key"
ON "category" ("name", "organizationId");
