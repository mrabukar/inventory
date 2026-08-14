-- Add paidAtSale: the amount paid at the moment of sale (stored directly on
-- the invoice instead of as a payment row so corrections can adjust it cleanly).
ALTER TABLE "invoice" ADD COLUMN "paidAtSale" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Backfill: find existing sale-time auto-payment rows (created in the same
-- Postgres transaction as their invoice, so createdAt = invoice.issuedAt).
UPDATE "invoice" i
SET "paidAtSale" = COALESCE(
  (
    SELECT p."amount"
    FROM "payment" p
    WHERE p."invoiceId" = i."id"
      AND p."createdAt" = i."issuedAt"
    ORDER BY p."createdAt" ASC
    LIMIT 1
  ),
  0
);

-- Remove those sale-time payment rows — they are now represented by paidAtSale.
-- Standalone payments (created after the sale) are unaffected.
DELETE FROM "payment" p
USING "invoice" i
WHERE p."invoiceId" = i."id"
  AND p."createdAt" = i."issuedAt";
