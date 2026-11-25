/**
 * Integration tests for the three organization types: stores, direct sales
 * and credit branches. Runs only when TEST_DATABASE_URL points at a database
 * whose name ends in `_test`.
 */
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { CurrentUserPayload } from "../src/common/decorators/current-user.decorator";
import { DomainPolicyService } from "../src/common/tenant/domain-policy.service";
import { TenantContextService } from "../src/common/tenant/tenant-context.service";
import { TenantStoreResolver } from "../src/common/tenant/tenant-store-resolver.service";
import { todayCalendarDate } from "../src/common/utils/app-timezone.util";
import type { OrganizationType } from "../src/common/utils/organization-type.util";
import { CreditBranchesService } from "../src/modules/credit-branches/credit-branches.service";
import { CustomersService } from "../src/modules/customers/customers.service";
import { OrganizationsService } from "../src/modules/organizations/organizations.service";
import { PaymentsService } from "../src/modules/payments/payments.service";
import { ProductsService } from "../src/modules/products/products.service";
import { ReportsService } from "../src/modules/reports/reports.service";
import { SalesService } from "../src/modules/sales/sales.service";
import { StoresService } from "../src/modules/stores/stores.service";
import { UsersService } from "../src/modules/users/users.service";
import { PrismaService } from "../src/prisma/prisma.service";

// UsersService pulls in Better-Auth's ESM-only crypto; not needed here.
jest.mock("better-auth/crypto", () => ({ hashPassword: jest.fn() }));

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseName = testDatabaseUrl
  ? new URL(testDatabaseUrl).pathname.replace(/^\//, "")
  : "";
const describeDb = databaseName.endsWith("_test") ? describe : describe.skip;

describeDb("Organization types (PostgreSQL)", () => {
  let prisma: PrismaService;
  let tenant: TenantContextService;
  let organizations: OrganizationsService;
  let creditBranches: CreditBranchesService;
  let sales: SalesService;
  let customers: CustomersService;
  let reports: ReportsService;
  let superAdmin: CurrentUserPayload;
  const today = todayCalendarDate();
  const range = { fromDate: today, toDate: today };

  interface World {
    organizationId: string;
    admin: CurrentUserPayload;
    productId: string;
    categoryId: string;
  }

  const inOrg = <T>(w: World, fn: () => Promise<T>): Promise<T> =>
    tenant.run(w.organizationId, fn);

  async function makeUser(
    organizationId: string | null,
    role: UserRole,
    storeId: string | null = null,
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

  /** An organization of the given type with an admin and a product on the warehouse shelf. */
  async function makeWorld(type: OrganizationType): Promise<World> {
    const created = await organizations.create(
      { name: `${type} ${randomUUID().slice(0, 8)}`, type },
      superAdmin,
    );
    const admin = await makeUser(created.id, UserRole.admin);
    const category = await prisma.category.create({
      data: { name: "Phones", organizationId: created.id },
    });
    const product = await prisma.product.create({
      data: {
        name: "Phone",
        normalizedName: `phone-${randomUUID()}`,
        categoryId: category.id,
        sellingPrice: 15,
        averageCost: 7,
        organizationId: created.id,
        createdById: admin.id,
      },
    });
    const warehouse = await tenant.run(created.id, () =>
      new StoresService(prisma).ensureOrgWarehouse(created.id),
    );
    await prisma.inventory.create({
      data: {
        productId: product.id,
        storeId: warehouse.id,
        organizationId: created.id,
        quantity: 500,
      },
    });
    return {
      organizationId: created.id,
      admin,
      productId: product.id,
      categoryId: category.id,
    };
  }

  const makeBranch = (w: World) =>
    inOrg(w, () =>
      creditBranches.createBranch(
        { name: `Branch ${randomUUID().slice(0, 6)}`, address: "Main St" },
        w.admin,
      ),
    );

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    tenant = new TenantContextService();
    prisma = new PrismaService(tenant);
    await prisma.$connect();
    const stores = new StoresService(prisma);
    const resolver = new TenantStoreResolver(prisma, stores);
    const products = new ProductsService(prisma);
    creditBranches = new CreditBranchesService(prisma, products, stores);
    sales = new SalesService(prisma, products, resolver);
    customers = new CustomersService(prisma, new PaymentsService(prisma));
    reports = new ReportsService(prisma, resolver);
    organizations = new OrganizationsService(
      prisma,
      new DomainPolicyService(prisma),
      stores,
      new UsersService(prisma),
    );
    superAdmin = await makeUser(null, UserRole.super_admin);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  describe("choosing the type", () => {
    it("sets the flags and billing for each type", async () => {
      const stores = await organizations.create({ name: "S1" }, superAdmin);
      expect(stores).toMatchObject({
        hasStores: true,
        usesCreditBranches: false,
        billingEnabled: false,
      });

      const direct = await organizations.create(
        { name: "D1", type: "direct" },
        superAdmin,
      );
      expect(direct).toMatchObject({
        hasStores: false,
        usesCreditBranches: false,
        billingEnabled: true,
      });

      const credit = await organizations.create(
        { name: "C1", type: "credit" },
        superAdmin,
      );
      expect(credit).toMatchObject({
        hasStores: false,
        usesCreditBranches: true,
        billingEnabled: true,
      });
    });

    it("keeps billing on for direct and credit, and lets an organization with stores choose", async () => {
      const w = await makeWorld("direct");
      await expect(
        organizations.update(
          w.organizationId,
          { billingEnabled: false },
          superAdmin,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      const stores = await organizations.create({ name: "S2" }, superAdmin);
      const on = await organizations.update(
        stores.id,
        { billingEnabled: true },
        superAdmin,
      );
      expect(on.billingEnabled).toBe(true);
    });

    it("switches between direct and credit, turning billing on", async () => {
      const w = await makeWorld("direct");
      const credit = await organizations.update(
        w.organizationId,
        { type: "credit" },
        superAdmin,
      );
      expect(credit).toMatchObject({
        hasStores: false,
        usesCreditBranches: true,
        billingEnabled: true,
      });
      const direct = await organizations.update(
        w.organizationId,
        { type: "direct" },
        superAdmin,
      );
      expect(direct.usesCreditBranches).toBe(false);
    });

    it("refuses to stop being a credit organization while a branch still holds stock, owes money or waits on approval", async () => {
      const w = await makeWorld("credit");
      const branch = await makeBranch(w);
      await inOrg(w, () =>
        creditBranches.creditStock(
          branch.id,
          { items: [{ productId: w.productId, quantity: 10, unitPrice: 10 }] },
          w.admin,
        ),
      );

      await expect(
        organizations.update(w.organizationId, { type: "direct" }, superAdmin),
      ).rejects.toThrow(/still in stock|owes/);

      // Return the stock: nothing held and nothing owed.
      const credits = await inOrg(w, () =>
        creditBranches.listCredits(branch.id, w.admin),
      );
      await inOrg(w, () =>
        creditBranches.createReturn(
          branch.id,
          {
            branchCreditItemId: credits[0].items[0].id,
            quantity: 10,
            reason: "Settled",
          },
          w.admin,
        ),
      );
      const done = await organizations.update(
        w.organizationId,
        { type: "direct" },
        superAdmin,
      );
      expect(done.usesCreditBranches).toBe(false);
    });

    it("refuses to become an organization with stores while credit branches exist", async () => {
      const w = await makeWorld("credit");
      await makeBranch(w);
      await expect(
        organizations.update(w.organizationId, { type: "stores" }, superAdmin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("credit branches belong to credit organizations", () => {
    it("refuses to create or list branches in a direct-sales organization", async () => {
      const w = await makeWorld("direct");
      await expect(makeBranch(w)).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        inOrg(w, () => creditBranches.findAll(w.admin)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("sales and customers", () => {
    it("lets a direct-sales admin sell and add customers as before", async () => {
      const w = await makeWorld("direct");
      const customer = await inOrg(w, () =>
        customers.create({ name: "Walk-in" }, w.admin),
      );
      const sale = await inOrg(w, () =>
        sales.create(
          {
            items: [{ productId: w.productId, quantitySold: 2 }],
            saleDate: today,
            customerId: customer.id,
            paidAmount: 30,
          },
          w.admin,
        ),
      );
      expect(sale.status).toBe("active");
    });

    it("refuses new sales and new customers from a credit organization's admin", async () => {
      const w = await makeWorld("credit");
      await expect(
        inOrg(w, () =>
          sales.create(
            {
              items: [{ productId: w.productId, quantitySold: 1 }],
              saleDate: today,
              paidAmount: 15,
            },
            w.admin,
          ),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        inOrg(w, () => customers.create({ name: "New" }, w.admin)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("still lets a credit organization correct an old sale and collect on its debts", async () => {
      // The organization sold directly before it became a credit organization.
      const w = await makeWorld("direct");
      const debtor = await inOrg(w, () =>
        customers.create({ name: "Old debtor" }, w.admin),
      );
      const sale = await inOrg(w, () =>
        sales.create(
          {
            items: [{ productId: w.productId, quantitySold: 4 }],
            saleDate: today,
            customerId: debtor.id,
            paidAmount: 0,
          },
          w.admin,
        ),
      );
      await organizations.update(
        w.organizationId,
        { type: "credit" },
        superAdmin,
      );

      const payments = new PaymentsService(prisma);
      await expect(
        inOrg(w, () =>
          payments.create(
            { customerId: debtor.id, amount: 20, paidAt: today },
            w.admin,
          ),
        ),
      ).resolves.toBeDefined();

      const item = sale.items[0];
      await expect(
        inOrg(w, () =>
          sales.correct(
            sale.id,
            {
              items: [{ saleItemId: item.id, correctedQuantity: 3 }],
              reason: "Counted wrong",
            },
            w.admin,
          ),
        ),
      ).resolves.toBeDefined();
    });
  });

  describe("reports", () => {
    it("counts a direct-sales organization's purchases as bought in its stock report", async () => {
      const w = await makeWorld("direct");
      await prisma.purchase.create({
        data: {
          productId: w.productId,
          organizationId: w.organizationId,
          quantity: 40,
          unitPurchasePrice: 7,
          totalCost: 280,
          purchaseDate: new Date(`${today}T00:00:00.000Z`),
          purchasedById: w.admin.id,
        },
      });
      const report = await inOrg(w, () =>
        reports.getStockReport(range, w.admin),
      );
      const row = report.products.find((p) => p.productId === w.productId);
      expect(row?.purchaseDevices).toBe(40);
    });

    it("counts stock credited to branches as the credit organization's own sales", async () => {
      const w = await makeWorld("credit");
      const branch = await makeBranch(w);
      await prisma.purchase.create({
        data: {
          productId: w.productId,
          organizationId: w.organizationId,
          quantity: 100,
          unitPurchasePrice: 7,
          totalCost: 700,
          purchaseDate: new Date(`${today}T00:00:00.000Z`),
          purchasedById: w.admin.id,
        },
      });
      await inOrg(w, () =>
        creditBranches.creditStock(
          branch.id,
          { items: [{ productId: w.productId, quantity: 10, unitPrice: 10 }] },
          w.admin,
        ),
      );
      const credits = await inOrg(w, () =>
        creditBranches.listCredits(branch.id, w.admin),
      );
      await inOrg(w, () =>
        creditBranches.createReturn(
          branch.id,
          {
            branchCreditItemId: credits[0].items[0].id,
            quantity: 3,
            reason: "Damaged",
          },
          w.admin,
        ),
      );

      // 10 credited, 3 returned: 7 units sold for $70, costing 7 × $7.
      const dash = await inOrg(w, () =>
        reports.getAdminDashboard(range, w.admin),
      );
      expect(dash.summary.totalUnitsSold).toBe(7);
      expect(dash.summary.totalRevenue).toBe(70);
      expect(dash.summary.cogs).toBe(49);

      const month = dash.charts.revenueCogsExpenses.find((m) => m.revenue > 0);
      expect(month?.revenue).toBe(70);
      expect(month?.cogs).toBe(49);
      expect(month?.netProfit).toBe(21);

      expect(dash.charts.topProducts).toEqual([
        expect.objectContaining({ productId: w.productId, unitsSold: 7 }),
      ]);

      const stock = await inOrg(w, () =>
        reports.getStockReport(range, w.admin),
      );
      const row = stock.products.find((p) => p.productId === w.productId);
      expect(row?.purchaseDevices).toBe(100);
      expect(row?.salesDevices).toBe(7);

      // The financial summary's monthly chart agrees with the dashboard.
      const fin = await inOrg(w, () =>
        reports.getFinancialSummary(range, w.admin),
      );
      const finMonth = fin.charts.revenueCogsExpenses.find(
        (m) => m.revenue > 0,
      );
      expect(finMonth?.revenue).toBe(70);
    });

    it("does not change a direct-sales organization's own figures", async () => {
      const w = await makeWorld("direct");
      await inOrg(w, () =>
        sales.create(
          {
            items: [{ productId: w.productId, quantitySold: 2 }],
            saleDate: today,
            paidAmount: 30,
          },
          w.admin,
        ),
      );
      const dash = await inOrg(w, () =>
        reports.getAdminDashboard(range, w.admin),
      );
      expect(dash.summary.totalUnitsSold).toBe(2);
      expect(dash.summary.totalRevenue).toBe(30);
      expect(dash.charts.topProducts[0]?.unitsSold).toBe(2);
    });
  });
});
