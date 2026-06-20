-- Remove legacy default organization created by multitenant backfill on greenfield installs.
DELETE FROM "category" WHERE "organizationId" = 'cldefault00000000000000001';
DELETE FROM "expense_category" WHERE "organizationId" = 'cldefault00000000000000001';
DELETE FROM "organization" WHERE "id" = 'cldefault00000000000000001';
