-- Seed expense categories
INSERT INTO "expense_category" ("name", "description", "createdAt", "updatedAt")
VALUES
  ('Rent', 'Store or office rent', NOW(), NOW()),
  ('Utilities', 'Electricity, water, and similar utilities', NOW(), NOW()),
  ('Salaries', 'Staff wages and salaries', NOW(), NOW()),
  ('Internet & Phone', 'Internet, phone, and connectivity costs', NOW(), NOW()),
  ('Maintenance', 'Repairs and maintenance', NOW(), NOW()),
  ('Transport', 'Delivery and transport costs', NOW(), NOW()),
  ('Other', 'Miscellaneous operating expenses', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;
