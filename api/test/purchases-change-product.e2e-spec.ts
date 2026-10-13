/**
 * Integration tests for purchase corrections against a real PostgreSQL.
 *
 * Runs only when TEST_DATABASE_URL points at a database whose name ends in
 * `_test`. Each run creates its own organization and never deletes anything.
 *
 *   TEST_DATABASE_URL=postgresql://…/inv_test pnpm test:e2e -- purchases-change-product
 */
import { AuditAction, PurchaseType, UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { TenantContextService } from "../src/common/tenant/tenant-context.service";
import type { CurrentUserPayload } from "../src/common/decorators/current-user.decorator";
import { PrismaService } from "../src/prisma/prisma.service";
import { ProductsService } from "../src/modules/products/products.service";
import { PurchasesService } from "../src/modules/purchases/purchases.service";
import { StoresService } from "../src/modules/stores/stores.service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseName = testDatabaseUrl
  ? new URL(testDatabaseUrl).pathname.replace(/^\//, "")
  : "";
const canRun = databaseName.endsWith("_test");

const describeDb = canRun ? describe : describe.skip;

describeDb("PurchasesService corrections (PostgreSQL)", () => {
  let prisma: PrismaService;
  let tenant: TenantContextService;
  let purchases: PurchasesService;
  let stores: StoresService;
  let organizationId: string;
  let user: CurrentUserPayload;
  let categoryId: string;

  const inOrg = <T>(fn: () => Promise<T>): Promise<T> =>
    tenant.run(organizationId, fn);

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    tenant = new TenantContextService();
    prisma = new PrismaService(tenant);
    await prisma.$connect();
    stores = new StoresService(prisma);
    purchases = new PurchasesService(
      prisma,
      stores,
      new ProductsService(prisma),
    );

    const suffix = randomUUID().slice(0, 8);
    const org = await prisma.organization.create({
      data: { name: `Change product test ${suffix}` },
    });
    organizationId = org.id;
    const admin = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `admin-${suffix}@example.test`,
        role: UserRole.admin,
        organizationId,
      },
    });
    user = {
      id: admin.id,
      email: admin.email,
      role: UserRole.admin,
      organizationId,
      storeId: null,
      isActive: true,
    };
    const category = await prisma.category.create({
      data: { name: "Phones", organizationId },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function makeProduct(name: string, isActive = true) {
    return prisma.product.create({
      data: {
        name,
        normalizedName: `${name.toLowerCase()}-${randomUUID()}`,
        categoryId,
        sellingPrice: 500,
        isActive,
        organizationId,
        createdById: user.id,
      },
    });
  }

  function buy(productId: string, quantity: number, unitPurchasePrice: number) {
    return inOrg(() =>
      purchases.create(
        {
          productId,
          quantity,
          unitPurchasePrice,
          purchaseDate: "2026-10-01",
          invoiceNumber: "INV-1",
        },
        user,
      ),
    );
  }

  async function warehouseQty(productId: string) {
    const warehouse = await stores.ensureOrgWarehouse(organizationId);
    const row = await prisma.inventory.findUnique({
      where: { productId_storeId: { productId, storeId: warehouse.id } },
    });
    return row?.quantity ?? 0;
  }

  async function averageCost(productId: string) {
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });
    return Number(product.averageCost);
  }

  async function purchasedTotals(productIds: string[]) {
    const agg = await prisma.purchase.aggregate({
      where: { organizationId, productId: { in: productIds } },
      _sum: { quantity: true, totalCost: true },
    });
    return {
      quantity: agg._sum.quantity ?? 0,
      totalCost: Number(agg._sum.totalCost ?? 0),
    };
  }

  it("moves a whole purchase to the correct product at the same price", async () => {
    const wrong = await makeProduct("Test");
    const right = await makeProduct("Product X");
    const original = await buy(wrong.id, 5, 120);

    const result = await inOrg(() =>
      purchases.changeProduct(
        original.id,
        {
          productId: right.id,
          quantity: 5,
          unitPurchasePrice: 120,
          reason: "Wrong product",
        },
        user,
      ),
    );

    expect(result.correction.type).toBe(PurchaseType.correction);
    expect(result.correction.productId).toBe(wrong.id);
    expect(result.correction.quantity).toBe(-5);
    expect(Number(result.correction.totalCost)).toBe(-600);
    expect(result.correction.correctsPurchaseId).toBe(original.id);
    expect(result.correction.movedTo?.id).toBe(result.purchase.id);

    expect(result.purchase.type).toBe(PurchaseType.purchase);
    expect(result.purchase.productId).toBe(right.id);
    expect(result.purchase.quantity).toBe(5);
    expect(Number(result.purchase.totalCost)).toBe(600);
    expect(result.purchase.movedFromCorrectionId).toBe(result.correction.id);
    expect(result.purchase.movedFromCorrection?.product.name).toBe("Test");
    expect(result.purchase.invoiceNumber).toBe("INV-1");
    expect(result.purchase.purchaseDate).toEqual(original.purchaseDate);

    expect(await warehouseQty(wrong.id)).toBe(0);
    expect(await warehouseQty(right.id)).toBe(5);
    expect(await averageCost(wrong.id)).toBe(0);
    expect(await averageCost(right.id)).toBe(120);

    // Stock investment for the period is unchanged.
    expect(await purchasedTotals([wrong.id, right.id])).toEqual({
      quantity: 5,
      totalCost: 600,
    });

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId,
        action: AuditAction.PURCHASE_CORRECTED,
        entityId: result.correction.id,
      },
    });
    expect(audit.newValue).toMatchObject({
      direction: "change_product",
      toProductId: right.id,
      correctedQuantity: 5,
    });
  });

  it("moves part of a purchase at a different price and keeps both sides fixable", async () => {
    const wrong = await makeProduct("Phone A");
    const right = await makeProduct("Phone B");
    const original = await buy(wrong.id, 10, 100);
    await buy(right.id, 10, 80);

    const result = await inOrg(() =>
      purchases.changeProduct(
        original.id,
        {
          productId: right.id,
          quantity: 3,
          unitPurchasePrice: 90,
          reason: "3 of these were Phone B",
        },
        user,
      ),
    );

    expect(await warehouseQty(wrong.id)).toBe(7);
    expect(await warehouseQty(right.id)).toBe(13);
    // (1000 − 3×100) / 7 = 100
    expect(await averageCost(wrong.id)).toBe(100);
    // (10×80 + 3×90) / 13 = 82.307… → 82.31
    expect(await averageCost(right.id)).toBe(82.31);
    // 1000 + 800 − 300 + 270
    expect((await purchasedTotals([wrong.id, right.id])).totalCost).toBe(1770);

    const list = await inOrg(() =>
      purchases.findAll({ page: 1, limit: 100, invoiceNumber: "INV-1" }),
    );
    const byId = new Map(list.data.map((row) => [row.id, row]));
    expect(byId.get(original.id)?.reversibleQuantity).toBe(7);
    expect(byId.get(result.purchase.id)?.reversibleQuantity).toBe(3);

    // The moved purchase is an ordinary purchase: it can be corrected itself.
    await inOrg(() =>
      purchases.correctSubtract(
        result.purchase.id,
        { quantity: 1, reason: "One fewer" },
        user,
      ),
    );
    expect(await warehouseQty(right.id)).toBe(12);
  });

  it("rejects invalid moves without changing anything", async () => {
    const wrong = await makeProduct("Reject A");
    const right = await makeProduct("Reject B");
    const inactive = await makeProduct("Reject inactive", false);
    const original = await buy(wrong.id, 4, 50);

    const before = {
      wrongQty: await warehouseQty(wrong.id),
      rightQty: await warehouseQty(right.id),
      totals: await purchasedTotals([wrong.id, right.id]),
    };

    const attempt = (productId: string, quantity: number) =>
      inOrg(() =>
        purchases.changeProduct(
          original.id,
          { productId, quantity, unitPurchasePrice: 50, reason: "x" },
          user,
        ),
      );

    await expect(attempt(wrong.id, 1)).rejects.toThrow(/different product/);
    await expect(attempt(right.id, 5)).rejects.toThrow(/only 4 remain/);
    await expect(attempt(inactive.id, 1)).rejects.toThrow(/not found/);

    // Units already left the warehouse (e.g. distributed): simulate by
    // lowering warehouse stock directly.
    const warehouse = await stores.ensureOrgWarehouse(organizationId);
    await prisma.inventory.update({
      where: {
        productId_storeId: { productId: wrong.id, storeId: warehouse.id },
      },
      data: { quantity: 1 },
    });
    await expect(attempt(right.id, 2)).rejects.toThrow(
      /only 1 are in the warehouse/,
    );
    await prisma.inventory.update({
      where: {
        productId_storeId: { productId: wrong.id, storeId: warehouse.id },
      },
      data: { quantity: before.wrongQty },
    });

    expect(await warehouseQty(wrong.id)).toBe(before.wrongQty);
    expect(await warehouseQty(right.id)).toBe(before.rightQty);
    expect(await purchasedTotals([wrong.id, right.id])).toEqual(before.totals);
  });

  it("lets only one of two concurrent moves take the same units", async () => {
    const wrong = await makeProduct("Race A");
    const right = await makeProduct("Race B");
    const original = await buy(wrong.id, 5, 10);
    // Other stock of the same product, so the warehouse check alone can't
    // stop an over-correction of this purchase.
    await buy(wrong.id, 10, 10);

    const move = () =>
      inOrg(() =>
        purchases.changeProduct(
          original.id,
          {
            productId: right.id,
            quantity: 4,
            unitPurchasePrice: 10,
            reason: "x",
          },
          user,
        ),
      );
    const results = await Promise.allSettled([move(), move()]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await warehouseQty(wrong.id)).toBe(11);
    expect(await warehouseQty(right.id)).toBe(4);
  });

  it("lets only one of two concurrent removals take the same units", async () => {
    const product = await makeProduct("Race subtract");
    const original = await buy(product.id, 5, 10);
    // Other stock of the same product, so the warehouse check alone can't
    // stop an over-correction of this purchase.
    await buy(product.id, 10, 10);

    const remove = () =>
      inOrg(() =>
        purchases.correctSubtract(
          original.id,
          { quantity: 4, reason: "x" },
          user,
        ),
      );
    const results = await Promise.allSettled([remove(), remove()]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await warehouseQty(product.id)).toBe(11);
  });

  it("runs opposite concurrent moves without deadlocking", async () => {
    const a = await makeProduct("Swap A");
    const b = await makeProduct("Swap B");
    const onA = await buy(a.id, 3, 10);
    const onB = await buy(b.id, 3, 10);

    const results = await Promise.allSettled([
      inOrg(() =>
        purchases.changeProduct(
          onA.id,
          { productId: b.id, quantity: 3, unitPurchasePrice: 10, reason: "x" },
          user,
        ),
      ),
      inOrg(() =>
        purchases.changeProduct(
          onB.id,
          { productId: a.id, quantity: 3, unitPurchasePrice: 10, reason: "x" },
          user,
        ),
      ),
    ]);

    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(await warehouseQty(a.id)).toBe(3);
    expect(await warehouseQty(b.id)).toBe(3);
  });

  it("still records single and batch purchases with blended cost", async () => {
    const a = await makeProduct("Batch A");
    const b = await makeProduct("Batch B");
    await buy(a.id, 6, 110);

    const created = await inOrg(() =>
      purchases.createBatch(
        {
          purchaseDate: "2026-10-02",
          invoiceNumber: " INV-2 ",
          items: [
            { productId: b.id, quantity: 2, unitPurchasePrice: 40 },
            {
              productId: a.id,
              quantity: 10,
              unitPurchasePrice: 120,
              newSellingPrice: 150,
            },
          ],
        },
        user,
      ),
    );

    expect(created.map((row) => row.productId)).toEqual([b.id, a.id]);
    expect(created.every((row) => row.invoiceNumber === "INV-2")).toBe(true);
    expect(await warehouseQty(a.id)).toBe(16);
    expect(await warehouseQty(b.id)).toBe(2);
    // (6×110 + 10×120) / 16 = 116.25
    expect(await averageCost(a.id)).toBe(116.25);
    expect(await averageCost(b.id)).toBe(40);
    expect(Number(created[1].product.sellingPrice)).toBe(150);
  });
});
