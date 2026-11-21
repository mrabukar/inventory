-- Data fix: a credit branch's sales recorded the organization's own cost of
-- the product. Its cost of goods is what the branch paid the organization, so
-- re-cost those sale lines at the weighted average of the prices the branch was
-- credited at, with returned units taken out. New sales are costed this way
-- when they are made; this brings the existing ones in line.
UPDATE "sale_item" si
SET "unitPurchasePrice" = ROUND(x.avg_cost, 2)
FROM (
  SELECT
    ci."storeId",
    ci."productId",
    SUM((ci.quantity - COALESCE(r.returned, 0)) * ci."unitPrice")
      / NULLIF(SUM(ci.quantity - COALESCE(r.returned, 0)), 0) AS avg_cost
  FROM "branch_credit_item" ci
  LEFT JOIN (
    SELECT "branchCreditItemId", SUM(quantity) AS returned
    FROM "branch_return"
    GROUP BY "branchCreditItemId"
  ) r ON r."branchCreditItemId" = ci.id
  GROUP BY ci."storeId", ci."productId"
) x
WHERE si."storeId" = x."storeId"
  AND si."productId" = x."productId"
  AND x.avg_cost IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "store" st WHERE st.id = si."storeId" AND st.type = 'credit'
  );
