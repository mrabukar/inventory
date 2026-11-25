/**
 * Integration tests for credit branches against a real PostgreSQL.
 * Runs only when TEST_DATABASE_URL points at a database whose name ends in
 * `_test`. Each run creates its own organizations.
 *
 *   TEST_DATABASE_URL=postgresql://…/inv_test pnpm test:e2e -- credit-branches
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { CurrentUserPayload } from "../src/common/decorators/current-user.decorator";
import { TenantContextService } from "../src/common/tenant/tenant-context.service";
import { TenantStoreResolver } from "../src/common/tenant/tenant-store-resolver.service";
import { todayCalendarDate } from "../src/common/utils/app-timezone.util";
import { BranchPaymentsService } from "../src/modules/branch-payments/branch-payments.service";
import { CreditBranchesService } from "../src/modules/credit-branches/credit-branches.service";
import { CustomersService } from "../src/modules/customers/customers.service";
import { InventoryService } from "../src/modules/inventory/inventory.service";
import { InvoicesService } from "../src/modules/invoices/invoices.service";
import { PaymentsService } from "../src/modules/payments/payments.service";
import { ProductsService } from "../src/modules/products/products.service";
import { ReportsService } from "../src/modules/reports/reports.service";
import { SalesService } from "../src/modules/sales/sales.service";
import { AuditLogsService } from "../src/modules/audit-logs/audit-logs.service";
import { StoresService } from "../src/modules/stores/stores.service";
import { UsersService } from "../src/modules/users/users.service";
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
  let payments: PaymentsService;
  let reports: ReportsService;

  let organizationId: string;
  let productId: string;
  let admin: CurrentUserPayload;
  const today = todayCalendarDate();

  const inOrg = <T>(fn: () => Promise<T>): Promise<T> =>
    tenant.run(organizationId, fn);

  /**
   * A credit organization makes no sales of its own any more, but it can still
   * hold old ones. Seed those by acting as a direct seller for one call.
   */
  const asDirectSeller = async <T>(fn: () => Promise<T>): Promise<T> => {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { usesCreditBranches: false },
    });
    try {
      return await inOrg(fn);
    } finally {
      await prisma.organization.update({
        where: { id: organizationId },
        data: { usesCreditBranches: true },
      });
    }
  };

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
    payments = new PaymentsService(prisma);
    customers = new CustomersService(prisma, payments);

    const org = await prisma.organization.create({
      data: {
        name: `Credit test ${randomUUID().slice(0, 8)}`,
        hasStores: false,
        usesCreditBranches: true,
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
        quantity: 5000,
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

  it("holds a branch's sale for the admin and keeps it out of the org's own reports, before and after approval", async () => {
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
    expect(sale.status).toBe("pending"); // waits for the admin, like any branch
    expect(await qty(store.id)).toBe(7); // stock comes off straight away

    await inOrg(() => sales.approve(sale.id, admin));

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

  // A credit branch is its own business: own customers, invoices, payments
  // and invoice numbers, all confined to the branch.
  describe("customer billing for credit branches", () => {
    let prefixCount = 0;
    const nextPrefix = () => `P${String(++prefixCount).padStart(2, "0")}`;

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

    /** A branch with its own prefix and details, stock, a manager and one customer. */
    async function makeBilledBranch(prefix = nextPrefix()) {
      const store = await inOrg(() =>
        creditBranches.createBranch(
          {
            name: `Shop ${prefix} ${randomUUID().slice(0, 6)}`,
            address: "Main St",
            invoicePrefix: prefix,
            phone: "061111",
            evcNumber: `EVC-${prefix}`,
            edahabNumber: `EDH-${prefix}`,
            accountNumber: `ACC-${prefix}`,
          },
          admin,
        ),
      );
      const manager = await makeUser(UserRole.branch_manager, store.id);
      await inOrg(() =>
        creditBranches.creditStock(
          store.id,
          { items: [{ productId, quantity: 50, unitPrice: 10 }] },
          admin,
        ),
      );
      const customer = await inOrg(() =>
        customers.create({ name: `Customer ${prefix}` }, manager),
      );
      return { store, manager, customer, prefix };
    }

    /** What the branch manager does: the sale then waits for the admin. */
    const submitSale = (
      manager: CurrentUserPayload,
      customerId: string | undefined,
      quantitySold: number,
      paidAmount = 0,
    ) =>
      inOrg(() =>
        sales.create(
          {
            items: [{ productId, quantitySold }],
            saleDate: today,
            customerId,
            paidAmount,
          },
          manager,
        ),
      );

    /** Submit, then have the admin approve: the sale (with its invoice) as it ends up. */
    const sellTo = async (
      manager: CurrentUserPayload,
      customerId: string | undefined,
      quantitySold: number,
      paidAmount = 0,
    ) => {
      const pending = await submitSale(
        manager,
        customerId,
        quantitySold,
        paidAmount,
      );
      return inOrg(() => sales.approve(pending.id, admin));
    };

    it("holds a branch's sale until the admin approves it, then bills it from the branch's own numbers", async () => {
      const a = await makeBilledBranch();

      const pending = await submitSale(a.manager, a.customer.id, 4, 25); // $60, $25 now

      expect(pending.status).toBe("pending");
      expect(pending.invoice).toBeNull();
      expect(await qty(a.store.id)).toBe(46);

      // It shows up in the admin's approval queue, even though the admin's own
      // lists are limited to the organization's stock.
      const queue = await inOrg(() =>
        sales.findAll({ page: 1, limit: 100, status: "pending" }, admin),
      );
      expect(queue.data.map((x) => x.id)).toContain(pending.id);
      const waiting = await inOrg(() => sales.countPending(admin));
      expect(waiting.count).toBeGreaterThanOrEqual(1);

      const approved = await inOrg(() => sales.approve(pending.id, admin));

      expect(approved.status).toBe("active");
      expect(approved.invoice?.numberLabel).toBe(`${a.prefix}-0001`);
      expect(approved.invoice?.status).toBe("partial");
      expect(Number(approved.invoice?.paidAtSale)).toBe(25);
      const balance = await inOrg(() =>
        customers.getBalance(a.customer.id, a.manager),
      );
      expect(balance.balance).toBe(35);
    });

    it("doesn't charge the customer until the sale is approved", async () => {
      const a = await makeBilledBranch();

      const pending = await submitSale(a.manager, a.customer.id, 3); // $45

      const whilePending = await inOrg(() =>
        customers.getBalance(a.customer.id, a.manager),
      );
      expect(whilePending.balance).toBe(0);
      const owedWhilePending = await inOrg(() =>
        customers.getReceivables(a.manager),
      );
      expect(owedWhilePending).toHaveLength(0);

      await inOrg(() => sales.approve(pending.id, admin));

      const afterApproval = await inOrg(() =>
        customers.getBalance(a.customer.id, a.manager),
      );
      expect(afterApproval.balance).toBe(45);
    });

    it("puts the stock back and makes no invoice when the admin rejects a branch's sale", async () => {
      const a = await makeBilledBranch();

      const pending = await submitSale(a.manager, a.customer.id, 3);
      expect(await qty(a.store.id)).toBe(47);

      const rejected = await inOrg(() =>
        sales.reject(pending.id, { reason: "Wrong customer" }, admin),
      );

      expect(rejected.status).toBe("rejected");
      expect(await qty(a.store.id)).toBe(50);
      expect(
        await prisma.invoice.count({ where: { saleId: pending.id } }),
      ).toBe(0);
      const balance = await inOrg(() =>
        customers.getBalance(a.customer.id, a.manager),
      );
      expect(balance.balance).toBe(0);
    });

    it("numbers a branch's invoices from its own list, leaving the organization's alone", async () => {
      const a = await makeBilledBranch();
      const b = await makeBilledBranch();

      const a1 = await sellTo(a.manager, a.customer.id, 2);
      const a2 = await sellTo(a.manager, a.customer.id, 1);
      const b1 = await sellTo(b.manager, b.customer.id, 1);
      const orgSale = await asDirectSeller(() =>
        sales.create(
          {
            items: [{ productId, quantitySold: 1 }],
            saleDate: today,
            paidAmount: 15,
          },
          admin,
        ),
      );

      expect(a1.invoice?.numberLabel).toBe(`${a.prefix}-0001`);
      expect(a2.invoice?.numberLabel).toBe(`${a.prefix}-0002`);
      expect(b1.invoice?.numberLabel).toBe(`${b.prefix}-0001`);
      expect(orgSale.invoice?.numberLabel).toMatch(/^INV-\d{4}$/);

      const rows = await prisma.invoice.findMany({
        where: {
          id: { in: [a1.invoice!.id, b1.invoice!.id, orgSale.invoice!.id] },
        },
        select: { id: true, series: true },
      });
      const seriesOf = (id: string) => rows.find((r) => r.id === id)?.series;
      expect(seriesOf(a1.invoice!.id)).toBe(a.store.id);
      expect(seriesOf(b1.invoice!.id)).toBe(b.store.id);
      expect(seriesOf(orgSale.invoice!.id)).toBe("");
    });

    it("sends the branch's own details with its invoice, for printing", async () => {
      const a = await makeBilledBranch();
      const sale = await sellTo(a.manager, a.customer.id, 1);

      const invoice = await inOrg(() =>
        invoices.findOne(sale.invoice!.id, a.manager),
      );

      expect(invoice.sale.store.type).toBe("credit");
      expect(invoice.sale.store.evcNumber).toBe(`EVC-${a.prefix}`);
      expect(invoice.sale.store.edahabNumber).toBe(`EDH-${a.prefix}`);
      expect(invoice.sale.store.accountNumber).toBe(`ACC-${a.prefix}`);
      expect(invoice.sale.store.phone).toBe("061111");
    });

    it("keeps a branch manager to their own branch's invoices", async () => {
      const a = await makeBilledBranch();
      const b = await makeBilledBranch();
      const aSale = await sellTo(a.manager, a.customer.id, 1);
      const bSale = await sellTo(b.manager, b.customer.id, 1);

      const aList = await inOrg(() =>
        invoices.findAll({ page: 1, limit: 100 }, a.manager),
      );
      const ids = aList.data.map((i) => i.id);
      expect(ids).toContain(aSale.invoice!.id);
      expect(ids).not.toContain(bSale.invoice!.id);
      expect(aList.data.every((i) => i.sale.storeId === a.store.id)).toBe(true);

      await expect(
        inOrg(() => invoices.findOne(bSale.invoice!.id, a.manager)),
      ).rejects.toBeInstanceOf(NotFoundException);

      // The admin's own list is the organization's, not a branch's; picking a
      // branch shows that branch's only.
      const own = await inOrg(() =>
        invoices.findAll({ page: 1, limit: 100 }, admin),
      );
      const ownIds = own.data.map((i) => i.id);
      expect(ownIds).not.toContain(aSale.invoice!.id);
      expect(ownIds).not.toContain(bSale.invoice!.id);

      const browsingA = await inOrg(() =>
        invoices.findAll({ page: 1, limit: 100, storeId: a.store.id }, admin),
      );
      const aIds = browsingA.data.map((i) => i.id);
      expect(aIds).toContain(aSale.invoice!.id);
      expect(aIds).not.toContain(bSale.invoice!.id);
    });

    describe("an admin browsing a credit branch", () => {
      it("accepts the organization's own credit branches and nothing else", async () => {
        const a = await makeBilledBranch();
        const resolver = new TenantStoreResolver(prisma, stores);
        const otherOrg = await prisma.organization.create({
          data: { name: `Other ${randomUUID().slice(0, 6)}`, hasStores: false },
        });
        const foreign = await prisma.store.create({
          data: {
            organizationId: otherOrg.id,
            name: "Foreign branch",
            address: "x",
            type: "credit",
          },
        });
        const standard = await prisma.store.create({
          data: {
            organizationId,
            name: `Standard ${randomUUID().slice(0, 6)}`,
            address: "x",
            type: "standard",
          },
        });

        const warehouse = await inOrg(() => resolver.resolveStoreFilter(admin));
        expect(
          await inOrg(() => resolver.resolveStoreFilter(admin, a.store.id)),
        ).toBe(a.store.id);
        for (const id of [foreign.id, standard.id, "nope"]) {
          expect(
            await inOrg(() => resolver.resolveStoreFilter(admin, id)),
          ).toBe(warehouse);
        }
      });

      it("shows the organization's own invoices, payments, customers and receivables by default, and a branch's when picked", async () => {
        const a = await makeBilledBranch();
        const orgCustomer = await asDirectSeller(() =>
          customers.create(
            { name: `Org customer ${randomUUID().slice(0, 6)}` },
            admin,
          ),
        );
        const aSale = await sellTo(a.manager, a.customer.id, 3); // $45 owed
        await inOrg(() =>
          payments.create(
            { customerId: a.customer.id, amount: 10, paidAt: today },
            a.manager,
          ),
        );
        const ownSale = await asDirectSeller(() =>
          sales.create(
            {
              items: [{ productId, quantitySold: 1 }],
              saleDate: today,
              customerId: orgCustomer.id,
              paidAmount: 0,
            },
            admin,
          ),
        );

        const page = { page: 1, limit: 100 };

        // Invoices
        const ownInvoices = await inOrg(() =>
          invoices.findAll({ ...page, customerId: orgCustomer.id }, admin),
        );
        expect(ownInvoices.data.map((i) => i.id)).toContain(
          ownSale.invoice!.id,
        );
        expect(
          (
            await inOrg(() =>
              invoices.findAll({ ...page, customerId: a.customer.id }, admin),
            )
          ).data,
        ).toHaveLength(0);
        const branchInvoices = await inOrg(() =>
          invoices.findAll(
            { ...page, customerId: a.customer.id, storeId: a.store.id },
            admin,
          ),
        );
        expect(branchInvoices.data.map((i) => i.id)).toEqual([
          aSale.invoice!.id,
        ]);

        // Payments
        expect(
          (
            await inOrg(() =>
              payments.findAll({ ...page, customerId: a.customer.id }, admin),
            )
          ).data,
        ).toHaveLength(0);
        const branchPaymentsList = await inOrg(() =>
          payments.findAll(
            { ...page, customerId: a.customer.id, storeId: a.store.id },
            admin,
          ),
        );
        expect(branchPaymentsList.data).toHaveLength(1);

        // Customers
        const findCustomer = (name: string, storeId?: string) =>
          inOrg(() =>
            customers.findAll({ ...page, search: name, storeId }, admin),
          );
        expect((await findCustomer(orgCustomer.name)).data).toHaveLength(1);
        expect((await findCustomer(a.customer.name)).data).toHaveLength(0);
        expect(
          (await findCustomer(a.customer.name, a.store.id)).data,
        ).toHaveLength(1);
        expect(
          (await findCustomer(orgCustomer.name, a.store.id)).data,
        ).toHaveLength(0);

        // Receivables
        const ownOwing = await inOrg(() => customers.getReceivables(admin));
        const ownOwingIds = ownOwing.map((r) => r.customer?.id);
        expect(ownOwingIds).toContain(orgCustomer.id);
        expect(ownOwingIds).not.toContain(a.customer.id);
        const branchOwing = await inOrg(() =>
          customers.getReceivables(admin, { storeId: a.store.id }),
        );
        expect(branchOwing.map((r) => r.customer?.id)).toEqual([a.customer.id]);
        expect(branchOwing[0].balance).toBe(35);
      });

      it("lets the organization look at a branch's records but not change them", async () => {
        const a = await makeBilledBranch();
        const orgCustomer = await asDirectSeller(() =>
          customers.create(
            { name: `Org customer ${randomUUID().slice(0, 6)}` },
            admin,
          ),
        );
        await sellTo(a.manager, a.customer.id, 2);

        await expect(
          inOrg(() =>
            payments.create(
              { customerId: a.customer.id, amount: 5, paidAt: today },
              admin,
            ),
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
        await expect(
          inOrg(() =>
            customers.update(a.customer.id, { phone: "061000" }, admin),
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
        await expect(
          inOrg(() =>
            customers.create({ name: "Pushed", storeId: a.store.id }, admin),
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);

        // Looking is fine.
        await expect(
          inOrg(() => customers.getBalance(a.customer.id, admin)),
        ).resolves.toBeDefined();
        await expect(
          inOrg(() => customers.getStatement(a.customer.id, admin)),
        ).resolves.toBeDefined();

        // The organization's own customers are untouched by all this.
        await expect(
          inOrg(() =>
            customers.update(orgCustomer.id, { phone: "062000" }, admin),
          ),
        ).resolves.toBeDefined();
      });
    });

    describe("all branches together", () => {
      const page = { page: 1, limit: 100 };
      const range = { fromDate: today, toDate: today };

      /** Two billed branches that each sold something, with a debtor and a part payment. */
      async function twoBranchesWithSales() {
        const a = await makeBilledBranch();
        const b = await makeBilledBranch();
        const aSale = await sellTo(a.manager, a.customer.id, 3); // $45 owed
        const bSale = await sellTo(b.manager, b.customer.id, 2); // $30 owed
        await inOrg(() =>
          payments.create(
            { customerId: a.customer.id, amount: 10, paidAt: today },
            a.manager,
          ),
        );
        return { a, b, aSale, bSale };
      }

      it("lists every branch's sales, customers, invoices, payments and debts, each with its branch", async () => {
        const { a, b, aSale, bSale } = await twoBranchesWithSales();

        // Sales
        const salesAll = await inOrg(() =>
          sales.findAll({ ...page, storeId: "all" }, admin),
        );
        const saleIds = salesAll.data.map((x) => x.id);
        expect(saleIds).toEqual(expect.arrayContaining([aSale.id, bSale.id]));
        expect(salesAll.data.every((x) => x.store.type === "credit")).toBe(
          true,
        );

        // Customers carry their branch.
        const customersAll = await inOrg(() =>
          customers.findAll({ ...page, storeId: "all" }, admin),
        );
        const byName = new Map(customersAll.data.map((c) => [c.name, c]));
        expect(byName.get(a.customer.name)?.store?.id).toBe(a.store.id);
        expect(byName.get(b.customer.name)?.store?.id).toBe(b.store.id);
        expect(customersAll.data.every((c) => c.store !== null)).toBe(true);

        // Invoices and payments carry their branch.
        const invoicesAll = await inOrg(() =>
          invoices.findAll({ ...page, storeId: "all" }, admin),
        );
        const invoiceBranches = new Map(
          invoicesAll.data.map((i) => [i.id, i.sale.store?.id]),
        );
        expect(invoiceBranches.get(aSale.invoice!.id)).toBe(a.store.id);
        expect(invoiceBranches.get(bSale.invoice!.id)).toBe(b.store.id);

        const paymentsAll = await inOrg(() =>
          payments.findAll({ ...page, storeId: "all" }, admin),
        );
        const aPayment = paymentsAll.data.find(
          (p) => p.customerId === a.customer.id,
        );
        expect(aPayment?.invoice.sale.store.id).toBe(a.store.id);

        // Debts, with each customer's branch.
        const owing = await inOrg(() =>
          customers.getReceivables(admin, { storeId: "all" }),
        );
        const aRow = owing.find((r) => r.customer?.id === a.customer.id);
        const bRow = owing.find((r) => r.customer?.id === b.customer.id);
        expect(aRow?.balance).toBe(35);
        expect(aRow?.customer?.store?.id).toBe(a.store.id);
        expect(bRow?.balance).toBe(30);

        // The organization's own view still holds none of it.
        const own = await inOrg(() => sales.findAll(page, admin));
        expect(own.data.map((x) => x.id)).not.toContain(aSale.id);
      });

      it("makes the dashboard and financial summary the sum of the branches", async () => {
        await twoBranchesWithSales();

        const branches = await inOrg(() => creditBranches.findAll(admin));
        const parts = await Promise.all(
          branches.map(async (branch) => ({
            dash: await inOrg(() =>
              reports.getAdminDashboard(
                { ...range, storeId: branch.id },
                admin,
              ),
            ),
            fin: await inOrg(() =>
              reports.getFinancialSummary(
                { ...range, storeId: branch.id },
                admin,
              ),
            ),
          })),
        );
        const sum = (pick: (p: (typeof parts)[number]) => number) =>
          Math.round(parts.reduce((total, p) => total + pick(p), 0) * 100) /
          100;

        const dash = await inOrg(() =>
          reports.getAdminDashboard({ ...range, storeId: "all" }, admin),
        );
        expect(dash.summary.totalRevenue).toBe(
          sum((p) => p.dash.summary.totalRevenue),
        );
        expect(dash.summary.cogs).toBe(sum((p) => p.dash.summary.cogs));
        expect(dash.summary.grossProfit).toBe(
          sum((p) => p.dash.summary.grossProfit),
        );
        expect(dash.summary.currentStockValue).toBe(
          sum((p) => p.dash.summary.currentStockValue),
        );
        expect(dash.summary.inStockBalance).toBe(
          sum((p) => p.dash.summary.inStockBalance),
        );
        expect(dash.summary.totalUnitsSold).toBe(
          sum((p) => p.dash.summary.totalUnitsSold),
        );
        expect(dash.summary.totalExpenses).toBe(0);

        // Branches are ranked by what they sold.
        const ranked = dash.charts.topStores.map((s) => s.storeId);
        expect(ranked.length).toBeGreaterThanOrEqual(2);
        for (const id of ranked) {
          expect(branches.map((b) => b.id)).toContain(id);
        }

        const fin = await inOrg(() =>
          reports.getFinancialSummary({ ...range, storeId: "all" }, admin),
        );
        expect(fin.summary.totalRevenue).toBe(
          sum((p) => p.fin.summary.totalRevenue),
        );
        expect(fin.summary.stockInvestment).toBe(
          sum((p) => p.fin.summary.stockInvestment),
        );
        expect(fin.summary.currentStockValue).toBe(
          sum((p) => p.fin.summary.currentStockValue),
        );
        expect(fin.summary.netProfit).toBe(sum((p) => p.fin.summary.netProfit));
      });

      it("lists inventory for the organization, one branch, or every branch", async () => {
        const { a, b } = await twoBranchesWithSales();
        const inventory = new InventoryService(
          prisma,
          new StoresService(prisma),
          new ProductsService(prisma),
          new TenantStoreResolver(prisma, new StoresService(prisma)),
        );
        const stores = (storeId?: string) =>
          inOrg(() => inventory.findAll({ ...page, storeId }, admin)).then(
            (r) => new Set(r.data.map((row) => row.storeId)),
          );

        // The organization's own list holds its warehouse, not the branches' stock.
        const own = await stores();
        expect(own.has(a.store.id)).toBe(false);
        expect(own.has(b.store.id)).toBe(false);

        const forA = await stores(a.store.id);
        expect([...forA]).toEqual([a.store.id]);

        const all = await stores("all");
        expect(all.has(a.store.id)).toBe(true);
        expect(all.has(b.store.id)).toBe(true);
        expect([...all].every((id) => !own.has(id))).toBe(true);

        // The low-stock and out-of-stock lists follow the same scope.
        await prisma.inventory.updateMany({
          where: { storeId: a.store.id, productId },
          data: { quantity: 0 },
        });
        const outOfStock = await inOrg(() =>
          inventory.findOutOfStock({ ...page, storeId: "all" }, admin),
        );
        const outStores = outOfStock.data.map((row) => row.storeId);
        expect(outStores).toContain(a.store.id);
        expect(outStores).not.toContain(b.store.id);
        const outForOwn = await inOrg(() =>
          inventory.findOutOfStock(page, admin),
        );
        expect(outForOwn.data.map((row) => row.storeId)).not.toContain(
          a.store.id,
        );

        await prisma.inventory.updateMany({
          where: { storeId: b.store.id, productId },
          data: { quantity: 1, lowStockThreshold: 5 },
        });
        const low = await inOrg(() =>
          inventory.findLowStock({ ...page, storeId: "all" }, admin),
        );
        expect(low.data.map((row) => row.storeId)).toContain(b.store.id);
      });

      it("keeps the stock report on one store, ignoring all branches", async () => {
        const own = await inOrg(() => reports.getStockReport(range, admin));
        const all = await inOrg(() =>
          reports.getStockReport({ ...range, storeId: "all" }, admin),
        );
        expect(all.filters.storeId).toBe(own.filters.storeId);
      });

      it("lists the stock credited to one branch or to all of them", async () => {
        const { a, b } = await twoBranchesWithSales();

        const forA = await inOrg(() =>
          creditBranches.listCreditedStock(
            { ...page, storeId: a.store.id },
            admin,
          ),
        );
        expect(forA.data.length).toBe(1);
        expect(forA.data[0]).toMatchObject({ quantity: 50 });
        expect(Number(forA.data[0].unitPrice)).toBe(10);
        expect(forA.data[0].branch.id).toBe(a.store.id);
        expect(forA.summary).toEqual({ units: 50, value: 500 });

        const everyone = await inOrg(() =>
          creditBranches.listCreditedStock(page, admin),
        );
        const branchIds = everyone.data.map((row) => row.branch.id);
        expect(branchIds).toEqual(
          expect.arrayContaining([a.store.id, b.store.id]),
        );

        // A branch returns some, and the line shows it.
        const credits = await inOrg(() =>
          creditBranches.listCredits(a.store.id, admin),
        );
        await inOrg(() =>
          creditBranches.createReturn(
            a.store.id,
            {
              branchCreditItemId: credits[0].items[0].id,
              quantity: 4,
              reason: "Damaged",
            },
            admin,
          ),
        );
        const after = await inOrg(() =>
          creditBranches.listCreditedStock(
            { ...page, storeId: a.store.id },
            admin,
          ),
        );
        expect(after.data[0].returnedQuantity).toBe(4);
      });

      it("filters the audit log and the user list by branch", async () => {
        const { a, b } = await twoBranchesWithSales();
        const audit = new AuditLogsService(prisma);
        const usersService = new UsersService(prisma);

        for (const who of [a, b]) {
          await prisma.auditLog.create({
            data: {
              userId: who.manager.id,
              organizationId,
              action: "USER_UPDATED",
              entityType: "user",
              entityId: who.manager.id,
            },
          });
        }

        const forA = await inOrg(() =>
          audit.findAll({ ...page, storeId: a.store.id }),
        );
        expect(forA.data.length).toBeGreaterThan(0);
        expect(forA.data.every((row) => row.userId === a.manager.id)).toBe(
          true,
        );

        const allBranches = await inOrg(() =>
          audit.findAll({ ...page, storeId: "all" }),
        );
        const authors = new Set(allBranches.data.map((row) => row.userId));
        expect(authors.has(a.manager.id)).toBe(true);
        expect(authors.has(b.manager.id)).toBe(true);
        expect(authors.has(admin.id)).toBe(false);

        const own = await inOrg(() =>
          audit.findAll({ ...page, storeId: "own" }),
        );
        const ownAuthors = new Set(own.data.map((row) => row.userId));
        expect(ownAuthors.has(a.manager.id)).toBe(false);
        expect(ownAuthors.has(admin.id)).toBe(true);

        // Users
        const usersA = await inOrg(() =>
          usersService.findAll({ ...page, storeId: a.store.id }),
        );
        expect(usersA.data.map((u) => u.id)).toEqual([a.manager.id]);
        const usersAll = await inOrg(() =>
          usersService.findAll({ ...page, storeId: "all" }),
        );
        expect(usersAll.data.map((u) => u.id)).toEqual(
          expect.arrayContaining([a.manager.id, b.manager.id]),
        );
        expect(usersAll.data.map((u) => u.id)).not.toContain(admin.id);
        const usersOwn = await inOrg(() =>
          usersService.findAll({ ...page, storeId: "own", search: "admin" }),
        );
        expect(usersOwn.data.map((u) => u.id)).toContain(admin.id);
        expect(usersOwn.data.map((u) => u.id)).not.toContain(a.manager.id);
      });

      it("narrows the approval queues to one branch, or all", async () => {
        const a = await makeBilledBranch();
        const b = await makeBilledBranch();
        const pendingA = await submitSale(a.manager, a.customer.id, 1);
        const pendingB = await submitSale(b.manager, b.customer.id, 1);

        const queue = (storeId?: string) =>
          inOrg(() =>
            sales.findAll({ ...page, status: "pending", storeId }, admin),
          ).then((r) => r.data.map((x) => x.id));

        expect(await queue("all")).toEqual(
          expect.arrayContaining([pendingA.id, pendingB.id]),
        );
        expect(await queue(a.store.id)).toEqual([pendingA.id]);

        // Branch payments, too.
        await inOrg(() =>
          branchPayments.submit(
            { amount: 10, method: "cash", paidAt: today },
            a.manager,
          ),
        );
        const paymentsFor = (storeId?: string) =>
          inOrg(() =>
            branchPayments.findAll(
              { ...page, sortBy: "createdAt", order: "desc", storeId },
              admin,
            ),
          ).then((r) => r.data.map((p) => p.store.id));
        expect(await paymentsFor("all")).toContain(a.store.id);
        expect(await paymentsFor(b.store.id)).not.toContain(a.store.id);
      });
    });

    it("lets a branch take payments from its own customers only", async () => {
      const a = await makeBilledBranch();
      const b = await makeBilledBranch();
      const aSale = await sellTo(a.manager, a.customer.id, 2); // $30 owed
      await sellTo(b.manager, b.customer.id, 2);

      await inOrg(() =>
        payments.create(
          { customerId: a.customer.id, amount: 10, paidAt: today },
          a.manager,
        ),
      );
      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { id: aSale.invoice!.id },
      });
      expect(Number(invoice.paidAmount)).toBe(10);
      expect(invoice.status).toBe("partial");

      await expect(
        inOrg(() =>
          payments.create(
            { customerId: b.customer.id, amount: 5, paidAt: today },
            a.manager,
          ),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      const list = await inOrg(() =>
        payments.findAll({ page: 1, limit: 100 }, a.manager),
      );
      expect(list.data.length).toBeGreaterThan(0);
      expect(list.data.every((p) => p.customerId === a.customer.id)).toBe(true);
    });

    it("limits customers, balances and receivables to the branch", async () => {
      const a = await makeBilledBranch();
      const b = await makeBilledBranch();
      await sellTo(a.manager, a.customer.id, 3); // $45 owed
      await sellTo(b.manager, b.customer.id, 2);

      // Customers
      const aCustomers = await inOrg(() =>
        customers.findAll({ page: 1, limit: 50 }, a.manager),
      );
      expect(aCustomers.data.map((c) => c.id)).toEqual([a.customer.id]);
      await expect(
        inOrg(() => customers.findOneFor(b.customer.id, a.manager)),
      ).rejects.toBeInstanceOf(NotFoundException);

      // Balances
      const balance = await inOrg(() =>
        customers.getBalance(a.customer.id, a.manager),
      );
      expect(balance.balance).toBe(45);
      await expect(
        inOrg(() => customers.getBalance(b.customer.id, a.manager)),
      ).rejects.toBeInstanceOf(ForbiddenException);

      // Receivables: the branch's own debtors only.
      const aOwed = await inOrg(() => customers.getReceivables(a.manager));
      expect(aOwed.map((r) => r.customer?.id)).toEqual([a.customer.id]);
      expect(aOwed[0].balance).toBe(45);

      // The admin's receivables are the organization's own customers, not
      // either branch's.
      const orgDebtor = await asDirectSeller(() =>
        customers.create({ name: "Org debtor" }, admin),
      );
      await asDirectSeller(() =>
        sales.create(
          {
            items: [{ productId, quantitySold: 1 }],
            saleDate: today,
            customerId: orgDebtor.id,
            paidAmount: 0,
          },
          admin,
        ),
      );
      const adminOwed = await inOrg(() => customers.getReceivables(admin));
      const adminIds = adminOwed.map((r) => r.customer?.id);
      expect(adminIds).toContain(orgDebtor.id);
      expect(adminIds).not.toContain(a.customer.id);
      expect(adminIds).not.toContain(b.customer.id);
    });

    it("records a partial payment at the sale and leaves the rest owing", async () => {
      const a = await makeBilledBranch();

      const sale = await sellTo(a.manager, a.customer.id, 4, 25); // $60, $25 now

      expect(sale.invoice?.status).toBe("partial");
      expect(Number(sale.invoice?.paidAtSale)).toBe(25);
      const balance = await inOrg(() =>
        customers.getBalance(a.customer.id, a.manager),
      );
      expect(balance.balance).toBe(35);
    });

    it("lets a branch sell only to its own customers, and keeps the organization off them", async () => {
      const a = await makeBilledBranch();
      const b = await makeBilledBranch();
      const orgCustomer = await asDirectSeller(() =>
        customers.create({ name: "Org customer" }, admin),
      );

      await expect(sellTo(a.manager, b.customer.id, 1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(sellTo(a.manager, orgCustomer.id, 1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        asDirectSeller(() =>
          sales.create(
            {
              items: [{ productId, quantitySold: 1 }],
              saleDate: today,
              customerId: a.customer.id,
              paidAmount: 0,
            },
            admin,
          ),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("makes a prefix from the branch name, nudging it when another branch has it", async () => {
      const first = await inOrg(() =>
        creditBranches.createBranch(
          { name: "Qalbi Main", address: "Main St" },
          admin,
        ),
      );
      const second = await inOrg(() =>
        creditBranches.createBranch(
          { name: "Qalbi Two", address: "Main St" },
          admin,
        ),
      );

      expect(first.invoicePrefix).toBe("QALB");
      expect(second.invoicePrefix).toBe("QALB2");
    });

    it("gives a branch made before prefixes existed one when it first bills", async () => {
      const store = await prisma.store.create({
        data: {
          name: "Legacy shop",
          address: "Old Rd",
          type: "credit",
          organizationId,
        },
      });
      const manager = await makeUser(UserRole.branch_manager, store.id);
      await inOrg(() =>
        creditBranches.creditStock(
          store.id,
          { items: [{ productId, quantity: 5, unitPrice: 10 }] },
          admin,
        ),
      );
      const customer = await inOrg(() =>
        customers.create({ name: "Legacy customer" }, manager),
      );

      const sale = await sellTo(manager, customer.id, 1);

      expect(sale.invoice?.numberLabel).toBe("LEGA-0001");
      const saved = await prisma.store.findUniqueOrThrow({
        where: { id: store.id },
      });
      expect(saved.invoicePrefix).toBe("LEGA");
    });

    it("edits a branch's details, refuses a taken prefix, and locks the prefix after the first invoice", async () => {
      const a = await makeBilledBranch();
      const c = await makeBilledBranch();

      const edited = await inOrg(() =>
        creditBranches.updateBranch(
          c.store.id,
          { phone: "061999", invoicePrefix: "NEWC" },
          admin,
        ),
      );
      expect(edited.phone).toBe("061999");
      expect(edited.invoicePrefix).toBe("NEWC");

      await expect(
        inOrg(() =>
          creditBranches.updateBranch(
            c.store.id,
            { invoicePrefix: a.prefix },
            admin,
          ),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        inOrg(() =>
          creditBranches.updateBranch(
            c.store.id,
            { invoicePrefix: "INV" },
            admin,
          ),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      await sellTo(c.manager, c.customer.id, 1);

      await expect(
        inOrg(() =>
          creditBranches.updateBranch(
            c.store.id,
            { invoicePrefix: "OTHR" },
            admin,
          ),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      // Everything else can still change.
      await expect(
        inOrg(() =>
          creditBranches.updateBranch(c.store.id, { phone: "061888" }, admin),
        ),
      ).resolves.toBeDefined();
    });
  });

  describe("a branch manager editing their own invoice details", () => {
    it("lets them set the contact and payment details, but not the name, address or prefix", async () => {
      const mine = await makeBranch();
      const other = await makeBranch();

      const saved = await inOrg(() =>
        creditBranches.updateBranch(
          mine.store.id,
          { phone: "061555", evcNumber: "252611", edahabNumber: "252622" },
          mine.manager,
        ),
      );
      expect(saved.phone).toBe("061555");
      expect(saved.evcNumber).toBe("252611");
      expect(saved.edahabNumber).toBe("252622");

      for (const dto of [
        { name: "Renamed" },
        { address: "Somewhere else" },
        { invoicePrefix: "HACK" },
      ]) {
        await expect(
          inOrg(() =>
            creditBranches.updateBranch(mine.store.id, dto, mine.manager),
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
      }

      // Not another branch's details.
      await expect(
        inOrg(() =>
          creditBranches.updateBranch(
            other.store.id,
            { phone: "061000" },
            mine.manager,
          ),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
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

  describe("a credit branch's own financial summary", () => {
    const range = { fromDate: today, toDate: today };

    async function soldAndApproved(
      manager: CurrentUserPayload,
      quantitySold: number,
    ) {
      const pending = await inOrg(() =>
        sales.create(
          { items: [{ productId, quantitySold }], saleDate: today },
          manager,
        ),
      );
      return inOrg(() => sales.approve(pending.id, admin));
    }

    it("records what the branch paid as the cost of what it sells, not the organization's cost", async () => {
      const { store, manager } = await makeBranch();
      await inOrg(() =>
        creditBranches.creditStock(
          store.id,
          { items: [{ productId, quantity: 10, unitPrice: 10 }] },
          admin,
        ),
      );
      const second = await inOrg(() =>
        creditBranches.creditStock(
          store.id,
          { items: [{ productId, quantity: 10, unitPrice: 20 }] },
          admin,
        ),
      );
      await inOrg(() =>
        creditBranches.createReturn(
          store.id,
          {
            branchCreditItemId: second.items[0].id,
            quantity: 5,
            reason: "Wrong colour",
          },
          admin,
        ),
      );

      // 10 @ $10 and 5 left @ $20 → $200 over 15 units ≈ $13.33 (the
      // organization's own cost of the product is $7).
      const sale = await soldAndApproved(manager, 2);

      const line = await prisma.saleItem.findFirstOrThrow({
        where: { saleId: sale.id },
      });
      expect(Number(line.unitPurchasePrice)).toBe(13.33);
      const product = await prisma.product.findUniqueOrThrow({
        where: { id: productId },
      });
      expect(Number(product.averageCost)).toBe(7);
    });

    it("gives the branch its own revenue, cost, profit, stock bought and stock value", async () => {
      const { store, manager } = await makeBranch();
      const other = await makeBranch();
      await inOrg(() =>
        creditBranches.creditStock(
          store.id,
          { items: [{ productId, quantity: 10, unitPrice: 10 }] }, // $100 bought
          admin,
        ),
      );
      const orgBefore = await inOrg(() =>
        reports.getFinancialSummary(range, admin),
      );

      await soldAndApproved(manager, 4); // sells at $15 → $60; cost 4 × $10

      const summary = await inOrg(() =>
        reports.getFinancialSummary(range, manager),
      );
      expect(summary.summary.totalRevenue).toBe(60);
      expect(summary.summary.cogs).toBe(40);
      expect(summary.summary.grossProfit).toBe(20);
      expect(summary.summary.totalExpenses).toBe(0);
      expect(summary.summary.netProfit).toBe(20);
      expect(summary.summary.stockInvestment).toBe(100);
      expect(summary.summary.inStockBalance).toBe(6);
      expect(summary.summary.currentStockValue).toBe(60); // 6 units at what it paid

      // Returning stock lowers what it has bought and what it holds.
      const credits = await inOrg(() =>
        creditBranches.listCredits(store.id, admin),
      );
      await inOrg(() =>
        creditBranches.createReturn(
          store.id,
          {
            branchCreditItemId: credits[0].items[0].id,
            quantity: 2,
            reason: "Damaged",
          },
          admin,
        ),
      );
      const afterReturn = await inOrg(() =>
        reports.getFinancialSummary(range, manager),
      );
      expect(afterReturn.summary.stockInvestment).toBe(80);
      expect(afterReturn.summary.currentStockValue).toBe(40);

      // The admin can open the branch's own figures by its store id...
      const adminView = await inOrg(() =>
        reports.getFinancialSummary({ ...range, storeId: store.id }, admin),
      );
      expect(adminView.summary.totalRevenue).toBe(60);
      expect(adminView.summary.cogs).toBe(40);
      expect(adminView.summary.stockInvestment).toBe(80);

      // ...but the organization's own view is unchanged by the branch's sale.
      const orgAfter = await inOrg(() =>
        reports.getFinancialSummary(range, admin),
      );
      expect(orgAfter.summary.totalRevenue).toBe(
        orgBefore.summary.totalRevenue - 20, // only the returned $20 of credit moved
      );
      expect(orgAfter.summary.cogs).toBe(orgBefore.summary.cogs - 14); // 2 × $7 cost returned

      // A branch manager can't read another branch by passing its id.
      const peek = await inOrg(() =>
        reports.getFinancialSummary(
          { ...range, storeId: store.id },
          other.manager,
        ),
      );
      expect(peek.summary.totalRevenue).toBe(0);
    });

    it("lets the admin open a branch's dashboard, stock report and product mix, with the branch's own figures", async () => {
      const { store, manager } = await makeBranch();
      await inOrg(() =>
        creditBranches.creditStock(
          store.id,
          { items: [{ productId, quantity: 10, unitPrice: 10 }] }, // $100 bought
          admin,
        ),
      );
      const product = await prisma.product.findUniqueOrThrow({
        where: { id: productId },
        select: { categoryId: true },
      });
      const orgBefore = await inOrg(() =>
        reports.getAdminDashboard(range, admin),
      );

      await soldAndApproved(manager, 4); // sells at $15 → $60; cost 4 × $10

      // Dashboard: the branch's own sales, cost and stock, no expenses.
      const dash = await inOrg(() =>
        reports.getAdminDashboard({ ...range, storeId: store.id }, admin),
      );
      expect(dash.summary.totalRevenue).toBe(60);
      expect(dash.summary.cogs).toBe(40);
      expect(dash.summary.grossProfit).toBe(20);
      expect(dash.summary.totalExpenses).toBe(0);
      expect(dash.summary.netProfit).toBe(20);
      expect(dash.summary.inStockBalance).toBe(6);
      expect(dash.summary.currentStockValue).toBe(60); // at what it paid

      // The organization's own dashboard does not move when a branch sells.
      const orgAfter = await inOrg(() =>
        reports.getAdminDashboard(range, admin),
      );
      expect(orgAfter.summary.totalRevenue).toBe(
        orgBefore.summary.totalRevenue,
      );
      expect(orgAfter.summary.cogs).toBe(orgBefore.summary.cogs);

      // Stock report: what it bought, holds, sold, and its own unit cost.
      const stock = await inOrg(() =>
        reports.getStockReport({ ...range, storeId: store.id }, admin),
      );
      const row = stock.products.find((p) => p.productId === productId);
      expect(row?.purchaseDevices).toBe(10);
      expect(row?.inStock).toBe(6);
      expect(row?.salesDevices).toBe(4);
      expect(row?.averageCost).toBe(10);

      // Product mix: only what this branch sold.
      const mix = await inOrg(() =>
        reports.getProductDistribution(
          { ...range, categoryId: product.categoryId, storeId: store.id },
          admin,
        ),
      );
      expect(mix.totalUnitsSold).toBe(4);

      // A return lowers what it bought in the stock report.
      const credits = await inOrg(() =>
        creditBranches.listCredits(store.id, admin),
      );
      await inOrg(() =>
        creditBranches.createReturn(
          store.id,
          {
            branchCreditItemId: credits[0].items[0].id,
            quantity: 2,
            reason: "Damaged",
          },
          admin,
        ),
      );
      const afterReturn = await inOrg(() =>
        reports.getStockReport({ ...range, storeId: store.id }, admin),
      );
      expect(
        afterReturn.products.find((p) => p.productId === productId)
          ?.purchaseDevices,
      ).toBe(8);
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
