-- Product name+model uniqueness was global before multitenant; scope to organization.
DROP INDEX IF EXISTS "product_normalizedName_normalizedModel_active_key";
DROP INDEX IF EXISTS "product_normalizedName_active_key";

CREATE UNIQUE INDEX "product_org_normalizedName_normalizedModel_active_key"
ON "product" ("organizationId", "normalizedName", "normalizedModel")
WHERE "isActive" = true;
