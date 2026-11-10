/**
 * Integration tests for sale approval and admin 2FA management against a real
 * PostgreSQL. Runs only when TEST_DATABASE_URL points at a database whose
 * name ends in `_test`. Each run creates its own organizations.
 *
 *   TEST_DATABASE_URL=postgresql://…/inv_test pnpm test:e2e -- sales-approval
 */
import { BadRequestException, ConflictException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { CurrentUserPayload } from "../src/common/decorators/current-user.decorator";
import { TenantContextService } from "../src/common/tenant/tenant-context.service";
import { TenantStoreResolver } from "../src/common/tenant/tenant-store-resolver.service";
import { todayCalendarDate } from "../src/common/utils/app-timezone.util";
import { ProductsService } from "../src/modules/products/products.service";
import { ReportsService } from "../src/modules/reports/reports.service";
import { SalesService } from "../src/modules/sales/sales.service";
import { StoresService } from "../src/modules/stores/stores.service";
import { UsersService } from "../src/modules/users/users.service";
import { PrismaService } from "../src/prisma/prisma.service";

// UsersService imports Better-Auth's ESM-only crypto (unused here).
jest.mock("better-auth/crypto", () => ({ hashPassword: jest.fn() }));

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseName = testDatabaseUrl
  ? new URL(testDatabaseUrl).pathname.replace(/^\//, "")
  : "";
const describeDb = databaseName.endsWith("_test") ? describe : describe.skip;

describeDb("Sale approval and 2FA management (PostgreSQL)", () => {
  let prisma: PrismaService;
  let tenant: TenantContextService;
  let sales: SalesService;
  let reports: ReportsService;
  let users: UsersService;

  let organizationId: string;
  let storeId: string;
  let productId: string;
  let admin: CurrentUserPayload;
  let manager: CurrentUserPayload;

  const inOrg = <T>(orgId: string, fn: () => Promise<T>): Promise<T> =>
    tenant.run(orgId, fn);
  const today = todayCalendarDate();

  async function makeUser(
    orgId: string,
    role: UserRole,
    store: string | null,
  ): Promise<CurrentUserPayload> {
    const row = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `${role}-${randomUUID().slice(0, 8)}@example.test`,
        role,
        organizationId: orgId,
        storeId: store,
      },
    });
    return {
      id: row.id,
      email: row.email,
      role,
      organizationId: orgId,
      storeId: store,
      isActive: true,
    };
  }

  async function shelfQty(store: string, product: string) {
    const row = await prisma.inventory.findUnique({
      where: { productId_storeId: { productId: product, storeId: store } },
    });
    return row?.quantity ?? 0;
  }

  function sell(user: CurrentUserPayload, quantitySold: number, paid = 0) {
    return inOrg(user.organizationId!, () =>
      sales.create(
        {
          items: [{ productId, quantitySold }],
          saleDate: today,
          paidAmount: paid,
        },
        user,
      ),
    );
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    tenant = new TenantContextService();
    prisma = new PrismaService(tenant);
    await prisma.$connect();
    const stores = new StoresService(prisma);
    const resolver = new TenantStoreResolver(prisma, stores);
    sales = new SalesService(prisma, new ProductsService(prisma), resolver);
    reports = new ReportsService(prisma, resolver);
    users = new UsersService(prisma);

    const org = await prisma.organization.create({
      data: {
        name: `Approval test ${randomUUID().slice(0, 8)}`,
        billingEnabled: true,
      },
    });
    organizationId = org.id;
    const store = await prisma.store.create({
      data: { name: "Branch A", address: "Main St", organizationId },
    });
    storeId = store.id;
    admin = await makeUser(organizationId, UserRole.admin, null);
    manager = await makeUser(organizationId, UserRole.branch_manager, storeId);

    const category = await prisma.category.create({
      data: { name: "Phones", organizationId },
    });
    const product = await prisma.product.create({
      data: {
        name: "Phone",
        normalizedName: `phone-${randomUUID()}`,
        categoryId: category.id,
        sellingPrice: 500,
        averageCost: 300,
        organizationId,
        createdById: admin.id,
      },
    });
    productId = product.id;
    await prisma.inventory.create({
      data: { productId, storeId, organizationId, quantity: 10 },
    });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("holds a branch manager's sale as pending, takes stock, and makes no invoice", async () => {
    const sale = await sell(manager, 2, 1000);

    expect(sale.status).toBe("pending");
    expect(Number(sale.paidAtSubmission)).toBe(1000);
    expect(sale.invoice).toBeNull();
    expect(await shelfQty(storeId, productId)).toBe(8);

    const { count } = await inOrg(organizationId, () =>
      sales.countPending(admin),
    );
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("excludes pending sales from revenue until approved, then creates the invoice", async () => {
    const before = await inOrg(organizationId, () =>
      reports.getAllTimeCompanyNetProfit(admin),
    );
    const sale = await sell(manager, 1, 500);
    const whilePending = await inOrg(organizationId, () =>
      reports.getAllTimeCompanyNetProfit(admin),
    );
    expect(whilePending.totalRevenue).toBe(before.totalRevenue);

    const approved = await inOrg(organizationId, () =>
      sales.approve(sale.id, admin),
    );
    expect(approved.status).toBe("active");
    expect(approved.reviewedBy?.id).toBe(admin.id);
    expect(approved.invoice?.status).toBe("paid");
    expect(Number(approved.invoice?.paidAtSale)).toBe(500);

    const after = await inOrg(organizationId, () =>
      reports.getAllTimeCompanyNetProfit(admin),
    );
    expect(after.totalRevenue).toBe(before.totalRevenue + 500);
    expect(after.cogs).toBe(before.cogs + 300);
  });

  it("restores exact stock on rejection and refuses a second decision", async () => {
    const start = await shelfQty(storeId, productId);
    const sale = await sell(manager, 3, 1500);
    expect(await shelfQty(storeId, productId)).toBe(start - 3);

    const rejected = await inOrg(organizationId, () =>
      sales.reject(sale.id, { reason: "Wrong product" }, admin),
    );
    expect(rejected.status).toBe("rejected");
    expect(rejected.rejectionReason).toBe("Wrong product");
    expect(rejected.invoice).toBeNull();
    expect(await shelfQty(storeId, productId)).toBe(start);

    await expect(
      inOrg(organizationId, () =>
        sales.reject(sale.id, { reason: "again" }, admin),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      inOrg(organizationId, () => sales.approve(sale.id, admin)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await shelfQty(storeId, productId)).toBe(start);
  });

  it("lets only one of two simultaneous decisions win", async () => {
    const start = await shelfQty(storeId, productId);
    const sale = await sell(manager, 1, 500);

    const results = await Promise.allSettled([
      inOrg(organizationId, () => sales.approve(sale.id, admin)),
      inOrg(organizationId, () =>
        sales.reject(sale.id, { reason: "race" }, admin),
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    const final = await prisma.sale.findUniqueOrThrow({
      where: { id: sale.id },
      include: { invoice: true },
    });
    const qty = await shelfQty(storeId, productId);
    if (final.status === "active") {
      expect(final.invoice).not.toBeNull();
      expect(qty).toBe(start - 1);
    } else {
      expect(final.invoice).toBeNull();
      expect(qty).toBe(start);
    }
  });

  it("refuses corrections on pending and rejected sales", async () => {
    const pending = await sell(manager, 1, 500);
    await expect(
      inOrg(organizationId, () =>
        sales.correct(
          pending.id,
          {
            items: [{ saleItemId: pending.items[0].id, correctedQuantity: 2 }],
            reason: "typo",
          },
          manager,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("auto-approves sales an admin records in an organization without stores", async () => {
    const org = await prisma.organization.create({
      data: { name: `No stores ${randomUUID().slice(0, 8)}`, hasStores: false },
    });
    const soloAdmin = await makeUser(org.id, UserRole.admin, null);
    const warehouse = await new StoresService(prisma).ensureOrgWarehouse(
      org.id,
    );
    const category = await prisma.category.create({
      data: { name: "Misc", organizationId: org.id },
    });
    const product = await prisma.product.create({
      data: {
        name: "Cable",
        normalizedName: `cable-${randomUUID()}`,
        categoryId: category.id,
        sellingPrice: 10,
        organizationId: org.id,
        createdById: soloAdmin.id,
      },
    });
    await prisma.inventory.create({
      data: {
        productId: product.id,
        storeId: warehouse.id,
        organizationId: org.id,
        quantity: 5,
      },
    });

    const sale = await inOrg(org.id, () =>
      sales.create(
        {
          items: [{ productId: product.id, quantitySold: 1 }],
          saleDate: today,
        },
        soloAdmin,
      ),
    );
    expect(sale.status).toBe("active");
  });

  describe("admin 2FA management", () => {
    it("turns off a pending requirement, requires it again, and blocks self-changes", async () => {
      const target = await makeUser(
        organizationId,
        UserRole.branch_manager,
        storeId,
      );

      await inOrg(organizationId, () =>
        users.manageTwoFactor(target.id, "disable", admin),
      );
      let row = await prisma.user.findUniqueOrThrow({
        where: { id: target.id },
      });
      expect(row.twoFactorRequired).toBe(false);
      expect(row.twoFactorEnabled).toBe(false);

      await expect(
        inOrg(organizationId, () =>
          users.manageTwoFactor(target.id, "disable", admin),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      await inOrg(organizationId, () =>
        users.manageTwoFactor(target.id, "require", admin),
      );
      row = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
      expect(row.twoFactorRequired).toBe(true);

      await expect(
        inOrg(organizationId, () =>
          users.manageTwoFactor(admin.id, "disable", admin),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("turning off clears an existing authenticator and trusted devices", async () => {
      const target = await makeUser(
        organizationId,
        UserRole.branch_manager,
        storeId,
      );
      await prisma.user.update({
        where: { id: target.id },
        data: { twoFactorEnabled: true },
      });
      await prisma.twoFactor.create({
        data: { userId: target.id, secret: "s", backupCodes: "[]" },
      });

      await inOrg(organizationId, () =>
        users.manageTwoFactor(target.id, "disable", admin),
      );

      const row = await prisma.user.findUniqueOrThrow({
        where: { id: target.id },
        include: { twoFactor: true },
      });
      expect(row.twoFactorEnabled).toBe(false);
      expect(row.twoFactorRequired).toBe(false);
      expect(row.twoFactor).toBeNull();
    });
  });
});
