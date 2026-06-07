-- Enforce non-negative inventory at the database layer (system-design §5.1).
ALTER TABLE "inventory"
ADD CONSTRAINT "inventory_quantity_non_negative" CHECK ("quantity" >= 0);
