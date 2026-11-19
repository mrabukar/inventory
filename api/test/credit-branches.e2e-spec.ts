/**
 * Integration tests for credit branches against a real PostgreSQL.
 * Runs only when TEST_DATABASE_URL points at a database whose name ends in
 * `_test`. Each run creates its own organizations.
 *
 *   TEST_DATABASE_URL=postgresql://…/inv_test pnpm test:e2e -- credit-branches
 */
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { CurrentUserPayload } from "../src/common/decorators/current-user.decorator";
import { TenantContextService } from "../src/common/tenant/tenant-context.service";
import { TenantStoreResolver } from "../src/common/tenant/tenant-store-resolver.service";
import { todayCalendarDate } from "../src/common/utils/app-timezone.util";
import { BranchPaymentsService } from "../src/modules/branch-payments/branch-payments.service";
import { CreditBranchesService } from "../src/modules/credit-branches/credit-branches.service";
import { CustomersService } from "../src/modules/customers/customers.service";
import { InvoicesService } from "../src/modules/invoices/invoices.service";
import { ProductsService } from "../src/modules/products/products.service";
import { ReportsService } from "../src/modules/reports/reports.service";
import { SalesService } from "../src/modules/sales/sales.service";
import { StoresService } from "../src/modules/stores/stores.service";
import { PrismaService } from "../src/prisma/prisma.service";

// UsersService (and therefore PaymentsService's module graph) pulls in
// Better-Auth's ESM-only crypto; not needed here, so stub it.
jest.mock("better-auth/crypto", () => ({ hashPassword: jest.fn() }));

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseName = testDatabaseUrl
  ? new URL(testDatabaseUrl).pathname.replace(/^\//, "")
  : "";
const describeDb = databaseName.endsWith("_test") ? describe : describe.skip;

describeDb("Credit branches (PostgreSQL)", () => {
  let prisma: PrismaService;
  let tenant: TenantContextService;
  let stores: StoresService;
  let creditBranches: CreditBranchesService;
  let branchPayments: BranchPaymentsService;
  let sales: SalesService;
  let customers: CustomersService;
  let invoices: InvoicesService;
  let reports: ReportsService;

  let organizationId: string;
  let productId: string;
  let admin: CurrentUserPayload;
  const today = todayCalendarDate();

  const inOrg = <T>(fn: () => Promise<T>): Promise<T> =>
    tenant.run(organizationId, fn);

  async function makeUser(
    role: UserRole,
    storeId: string | null,
  ): Promise<CurrentUserPayload> {
    const row = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `${role}-${randomUUID().slice(0, 8)}@example.test`,
        role,
        organizationId,
        storeId,
      },
    });
    return {
      id: row.id,
      email: row.email,
      role,
      organizationId,
      storeId,
      isActive: true,
    };
  }

  async function makeBranch() {
    const store = await inOrg(() =>
      creditBranches.createBranch(
        { name: `Branch ${randomUUID().slice(0, 8)}`, address: "Main St" },
        admin,
      ),
    );
    const manager = await makeUser(UserRole.branch_manager, store.id);
    return { store, manager };
  }

  async function qty(storeId: string, product = productId) {
    const row = await prisma.inventory.findUnique({
      where: { productId_storeId: { productId: product, storeId } },
    });
    return row?.quantity ?? 0;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    tenant = new TenantContextService();
    prisma = new PrismaService(tenant);
    await prisma.$connect();
    stores = new StoresService(prisma);
    const resolver = new TenantStoreResolver(prisma, stores);
    const products = new ProductsService(prisma);
    creditBranches = new CreditBranchesService(prisma, products, stores);
    branchPayments = new BranchPaymentsService(prisma);
    sales = new SalesService(prisma, products, resolver);
    reports = new ReportsService(prisma, resolver);
    invoices = new InvoicesService(prisma);
    // CustomersService needs PaymentsService, which isn't exercised by
    // these tests (no billing). A minimal stand-in keeps the constructor happy.
    customers = new CustomersService(prisma, {
      getCustomerBalance: async () => ({
        totalBilled: 0,
        totalPaid: 0,
        balance: 0,
        unpaidInvoiceCount: 0,
      }),
    } as unknown as ConstructorParameters<typeof CustomersService>[1]);

    const org = await prisma.organization.create({
      data: {
        name: `Credit test ${randomUUID().slice(0, 8)}`,
        hasStores: false,
      },
    });
    organizationId = org.id;
    admin = await makeUser(UserRole.admin, null);

    const category = await prisma.category.create({
      data: { name: "Phones", organizationId },
    });
    const product = await prisma.product.create({
      data: {
        name: "Phone",
        normalizedName: `phone-${randomUUID()}`,
        categoryId: category.id,
        sellingPrice: 15,
        averageCost: 7,
        organizationId,
        createdById: admin.id,
      },
    });
    productId = product.id;

    const warehouse = await inOrg(() =>
      stores.ensureOrgWarehouse(organizationId),
    );
    await prisma.inventory.create({
      data: {
        productId,
        storeId: warehouse.id,
        organizationId,
        quantity: 1000,
      },
    });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("moves stock from the warehouse to the branch and sets the balance from what's unpaid", async () => {
    const { store } = await makeBranch();
    const warehouse = await inOrg(() =>
      stores.ensureOrgWarehouse(organizationId),
    );
    const warehouseBefore = await qty(warehouse.id);

    const credit = await inOrg(() =>
      creditBranches.creditStock(
        store.id,
        {
          items: [{ productId, quantity: 20, unitPrice: 10 }],
          paidAmount: 50,
          paidMethod: "cash",
        },
        admin,
      ),
    );

    expect(Number(credit.total)).toBe(200);
    expect(await qty(store.id)).toBe(20);
    expect(await qty(warehouse.id)).toBe(warehouseBefore - 20);

    const branch = await inOrg(() => creditBranches.findOne(store.id, admin));
    expect(branch.balance).toBe(150);
    expect(branch.totalPaid).toBe(50);
  });

  it("refuses to credit more than the warehouse has", async () => {
    const { store } = await makeBranch();
    await expect(
      inOrg(() =>
        creditBranches.creditStock(
          store.id,
          { items: [{ productId, quantity: 100_000, unitPrice: 10 }] },
          admin,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("branch sales go through immediately and never reach the org's own reports", async () => {
    const { store, manager } = await makeBranch();
    await inOrg(() =>
      creditBranches.creditStock(
        store.id,
        { items: [{ productId, quantity: 10, unitPrice: 10 }] },
        admin,
      ),
    );

    const before = await inOrg(() => reports.getAllTimeCompanyNetProfit(admin));

    const sale = await inOrg(() =>
      sales.create(
        { items: [{ productId, quantitySold: 3 }], saleDate: today },
        manager,
      ),
    );
    expect(sale.status).toBe("active"); // no approval wait, unlike a standard branch

    const after = await inOrg(() => reports.getAllTimeCompanyNetProfit(admin));
    // The branch's own sale adds no revenue to the org — only crediting does.
    expect(after.totalRevenue).toBe(before.totalRevenue);
    expect(await qty(store.id)).toBe(7);
  });

  it("counts the credit itself as the org's revenue and profit", async () => {
    const { store } = await makeBranch();
    const before = await inOrg(() => reports.getAllTimeCompanyNetProfit(admin));

    await inOrg(() =>
      creditBranches.creditStock(
        store.id,
        { items: [{ productId, quantity: 5, unitPrice: 10 }] }, // cost 7/unit
        admin,
      ),
    );

    const after = await inOrg(() => reports.getAllTimeCompanyNetProfit(admin));
    expect(after.totalRevenue).toBe(before.totalRevenue + 50);
    expect(after.cogs).toBe(before.cogs + 35);
  });

  it("submitting, approving and rejecting a payment moves the balance correctly", async () => {
    const { store, manager } = await makeBranch();
    await inOrg(() =>
      creditBranches.creditStock(
        store.id,
        { items: [{ productId, quantity: 10, unitPrice: 10 }] }, // owes 100
        admin,
      ),
    );

    const payment = await inOrg(() =>
      branchPayments.submit(
        { amount: 40, paidAt: today, method: "evc", reference: "EVC-1" },
        manager,
      ),
    );
    expect(payment.status).toBe("pending");
    expect(
      (await inOrg(() => creditBranches.findOne(store.id, admin))).balance,
    ).toBe(100);

    await inOrg(() => branchPayments.approve(payment.id, admin));
    expect(
      (await inOrg(() => creditBranches.findOne(store.id, admin))).balance,
    ).toBe(60);

    const rejected = await inOrg(() =>
      branchPayments.submit(
        { amount: 20, paidAt: today, method: "cash" },
        manager,
      ),
    );
    await inOrg(() =>
      branchPayments.reject(rejected.id, { reason: "Not found" }, admin),
    );
    expect(
      (await inOrg(() => creditBranches.findOne(store.id, admin))).balance,
    ).toBe(60);
  });

  it("refuses a payment bigger than what's owed, counting pending payments", async () => {
    const { store, manager } = await makeBranch();
    await inOrg(() =>
      creditBranches.creditStock(
        store.id,
        { items: [{ productId, quantity: 10, unitPrice: 10 }] }, // owes 100
        admin,
      ),
    );

    await inOrg(() =>
      branchPayments.submit(
        { amount: 70, paidAt: today, method: "cash" },
        manager,
      ),
    );

    await expect(
      inOrg(() =>
        branchPayments.submit(
          { amount: 40, paidAt: today, method: "cash" },
          manager,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns restore warehouse stock and lower the balance at the credited price", async () => {
    const { store } = await makeBranch();
    const warehouse = await inOrg(() =>
      stores.ensureOrgWarehouse(organizationId),
    );
    const warehouseBefore = await qty(warehouse.id);

    const credit = await inOrg(() =>
      creditBranches.creditStock(
        store.id,
        { items: [{ productId, quantity: 10, unitPrice: 10 }] }, // owes 100
        admin,
      ),
    );

    await inOrg(() =>
      creditBranches.createReturn(
        store.id,
        {
          branchCreditItemId: credit.items[0].id,
          quantity: 4,
          reason: "Damaged",
        },
        admin,
      ),
    );

    expect(await qty(store.id)).toBe(6);
    expect(await qty(warehouse.id)).toBe(warehouseBefore - 6);
    expect(
      (await inOrg(() => creditBranches.findOne(store.id, admin))).balance,
    ).toBe(60);

    await expect(
      inOrg(() =>
        creditBranches.createReturn(
          store.id,
          {
            branchCreditItemId: credit.items[0].id,
            quantity: 100,
            reason: "too many",
          },
          admin,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // CREDIT_BRANCH_BILLING is off: a credit branch sells like a standard
  // branch, with no customers, invoices or customer payments.
  describe("with customer billing switched off for credit branches", () => {
    beforeAll(async () => {
      await prisma.organization.update({
        where: { id: organizationId },
        data: { billingEnabled: true },
      });
    });

    afterAll(async () => {
      await prisma.organization.update({
        where: { id: organizationId },
        data: { billingEnabled: false },
      });
    });

    it("blocks customers and invoices for a credit branch manager, not for the admin", async () => {
      const { manager } = await makeBranch();

      await expect(
        inOrg(() => customers.findAll({ page: 1, limit: 20 }, manager)),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        inOrg(() => customers.create({ name: "Amina" }, manager)),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        inOrg(() => invoices.findAll({ page: 1, limit: 20 }, manager)),
      ).rejects.toBeInstanceOf(ForbiddenException);

      await expect(
        inOrg(() => invoices.findAll({ page: 1, limit: 20 }, admin)),
      ).resolves.toBeDefined();
    });

    it("records a credit branch's sale with no customer and no invoice", async () => {
      const { store, manager } = await makeBranch();
      await inOrg(() =>
        creditBranches.creditStock(
          store.id,
          { items: [{ productId, quantity: 5, unitPrice: 10 }] },
          admin,
        ),
      );
      const customer = await inOrg(() =>
        customers.create({ name: "Org's own customer" }, admin),
      );

      const sale = await inOrg(() =>
        sales.create(
          {
            items: [{ productId, quantitySold: 2 }],
            saleDate: today,
            customerId: customer.id,
            paidAmount: 5,
          },
          manager,
        ),
      );

      expect(sale.status).toBe("active");
      expect(sale.customerId).toBeNull();
      expect(sale.invoice).toBeNull();
      expect(await qty(store.id)).toBe(3);
    });
  });

  describe("paging and sorting", () => {
    it("pages the statement either way round with correct running balances", async () => {
      const { store, manager } = await makeBranch();
      await inOrg(() =>
        creditBranches.creditStock(
          store.id,
          { items: [{ productId, quantity: 10, unitPrice: 10 }] }, // owes 100
          admin,
        ),
      );
      for (const amount of [10, 20, 30]) {
        const p = await inOrg(() =>
          branchPayments.submit(
            { amount, paidAt: today, method: "cash" },
            manager,
          ),
        );
        await inOrg(() => branchPayments.approve(p.id, admin));
      }
      // 4 entries: credit 100, then payments 10, 20, 30 → balances 100, 90, 70, 40.

      const newestPage1 = await inOrg(() =>
        creditBranches.getStatement(
          store.id,
          { page: 1, limit: 3, order: "newest" },
          admin,
        ),
      );
      expect(newestPage1.meta).toEqual({
        total: 4,
        page: 1,
        limit: 3,
        totalPages: 2,
      });
      expect(newestPage1.rows.map((r) => r.balance)).toEqual([40, 70, 90]);

      const newestPage2 = await inOrg(() =>
        creditBranches.getStatement(
          store.id,
          { page: 2, limit: 3, order: "newest" },
          admin,
        ),
      );
      expect(newestPage2.rows.map((r) => r.balance)).toEqual([100]);
      expect(newestPage2.rows[0].kind).toBe("credit");

      const oldest = await inOrg(() =>
        creditBranches.getStatement(
          store.id,
          { page: 1, limit: 20, order: "oldest" },
          admin,
        ),
      );
      expect(oldest.rows.map((r) => r.balance)).toEqual([100, 90, 70, 40]);
      expect(oldest.balance.balance).toBe(40);
    });

    it("keeps a credit before the payment taken with it, even at the same instant", async () => {
      const { store } = await makeBranch();
      await inOrg(() =>
        creditBranches.creditStock(
          store.id,
          {
            items: [{ productId, quantity: 10, unitPrice: 10 }],
            paidAmount: 40,
            paidMethod: "cash",
          },
          admin,
        ),
      );

      const oldest = await inOrg(() =>
        creditBranches.getStatement(
          store.id,
          { page: 1, limit: 20, order: "oldest" },
          admin,
        ),
      );
      expect(oldest.rows.map((r) => r.kind)).toEqual(["credit", "payment"]);
      expect(oldest.rows.map((r) => r.balance)).toEqual([100, 60]);
    });

    it("pages and sorts a branch's own payments", async () => {
      const { store, manager } = await makeBranch();
      await inOrg(() =>
        creditBranches.creditStock(
          store.id,
          { items: [{ productId, quantity: 10, unitPrice: 10 }] },
          admin,
        ),
      );
      for (const amount of [5, 15, 10]) {
        await inOrg(() =>
          branchPayments.submit(
            { amount, paidAt: today, method: "evc" },
            manager,
          ),
        );
      }

      const page1 = await inOrg(() =>
        branchPayments.findAll(
          { page: 1, limit: 2, sortBy: "amount", order: "desc" },
          manager,
        ),
      );
      expect(page1.data.map((p) => Number(p.amount))).toEqual([15, 10]);
      expect(page1.meta).toEqual({
        total: 3,
        page: 1,
        limit: 2,
        totalPages: 2,
      });

      const page2 = await inOrg(() =>
        branchPayments.findAll(
          { page: 2, limit: 2, sortBy: "amount", order: "desc" },
          manager,
        ),
      );
      expect(page2.data.map((p) => Number(p.amount))).toEqual([5]);

      const smallest = await inOrg(() =>
        branchPayments.findAll(
          { page: 1, limit: 10, sortBy: "amount", order: "asc" },
          manager,
        ),
      );
      expect(smallest.data.map((p) => Number(p.amount))).toEqual([5, 10, 15]);
    });

    it("reports how much is waiting for review, independent of paging", async () => {
      const { store, manager } = await makeBranch();
      await inOrg(() =>
        creditBranches.creditStock(
          store.id,
          { items: [{ productId, quantity: 10, unitPrice: 10 }] },
          admin,
        ),
      );
      const before = await inOrg(() => branchPayments.countPending(admin));

      for (const amount of [12, 8]) {
        await inOrg(() =>
          branchPayments.submit(
            { amount, paidAt: today, method: "bank" },
            manager,
          ),
        );
      }

      const after = await inOrg(() => branchPayments.countPending(admin));
      expect(after.count).toBe(before.count + 2);
      expect(after.amount).toBe(before.amount + 20);
    });
  });

  it("does not affect an organization with branches", async () => {
    const org = await prisma.organization.create({
      data: { name: `Standard org ${randomUUID().slice(0, 8)}` },
    });
    const branchAdmin = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `std-admin-${randomUUID().slice(0, 8)}@example.test`,
        role: UserRole.admin,
        organizationId: org.id,
      },
    });
    const adminPayload: CurrentUserPayload = {
      id: branchAdmin.id,
      email: branchAdmin.email,
      role: UserRole.admin,
      organizationId: org.id,
      storeId: null,
      isActive: true,
    };

    await expect(
      tenant.run(org.id, () =>
        creditBranches.createBranch(
          { name: "Should fail", address: "x" },
          adminPayload,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
