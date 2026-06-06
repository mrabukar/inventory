-- Seed product categories (read-only reference data)
INSERT INTO "category" ("name", "description", "createdAt", "updatedAt")
VALUES
  ('Mobiles', 'Mobile phones and devices', NOW(), NOW()),
  ('Accessories', 'Phone accessories and peripherals', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;
