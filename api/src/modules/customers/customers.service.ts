import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AuditAction,
  Customer,
  Prisma,
  StoreType,
  UserRole,
} from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import { CREDIT_BRANCH_BILLING } from "../../common/constants/credit-branch.constants";
import { creditBranchViewIdOf } from "../../common/utils/credit-branch.util";
import { assertBillingEnabled } from "../../common/utils/require-billing-enabled.util";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { assertBranchManagerHasStore } from "../../common/utils/store-scope.util";
import { toMoneyNumber } from "../../common/utils/money.util";
import { withOrganizationId } from "../../common/utils/with-organization-id.util";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { PaginatedResult } from "../stores/stores.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { CustomerQueryDto } from "./dto/customer-query.dto";
import { ReceivablesQueryDto } from "./dto/receivables-query.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async findAll(
    query: CustomerQueryDto,
    user: CurrentUserPayload,
  ): Promise<PaginatedResult<Customer>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;
    const search = typeof query.search === "string" ? query.search.trim() : "";

    // A credit branch manager only ever sees their own branch's customers —
    // never the organization's own, or another branch's. A standard branch
    // manager keeps today's behaviour: every customer, org-wide (unchanged
    // for organizations with branches). An admin sees the organization's own
    // customers, or one credit branch's when they pick it.
    let storeId: string | null | undefined;
    if (user.role === UserRole.branch_manager) {
      storeId = await this.creditBranchStoreIdFor(user, { optional: true });
    } else {
      storeId = await creditBranchViewIdOf(this.prisma, user, query.storeId);
      if (!storeId) {
        storeId = null;
      }
    }

    const where: Prisma.CustomerWhereInput = {
      ...(storeId !== undefined ? { storeId } : undefined),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined),
    };

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Plain lookup by id — unrestricted for every role, exactly as before this
   * feature. Use {@link assertOwnCreditBranchCustomer} wherever a branch
   * manager is about to change a customer or see what it owes.
   */
  async findOne(id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer with id "${id}" not found`);
    }
    return customer;
  }

  /**
   * The customer as the caller may see it: a credit branch manager only gets
   * their own branch's customers (anything else looks like it doesn't exist).
   * Admins and standard branch managers get today's unrestricted lookup.
   */
  async findOneFor(id: string, user: CurrentUserPayload): Promise<Customer> {
    const customer = await this.findOne(id);
    if (user.role === UserRole.branch_manager) {
      const branchStoreId = await this.creditBranchStoreIdFor(user, {
        optional: true,
      });
      if (branchStoreId && customer.storeId !== branchStoreId) {
        throw new NotFoundException(`Customer with id "${id}" not found`);
      }
    }
    return customer;
  }

  /**
   * Resolves the calling branch manager's own credit branch. A standard
   * branch manager either gets `undefined` (when `optional`) or a 403 —
   * only credit branches manage their own customers.
   */
  private async creditBranchStoreIdFor(
    user: CurrentUserPayload,
    options: { optional?: boolean } = {},
  ): Promise<string | undefined> {
    const storeId = assertBranchManagerHasStore(user);
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { type: true },
    });
    if (store?.type !== StoreType.credit) {
      if (options.optional) {
        return undefined;
      }
      throw new ForbiddenException(
        "Only a credit branch manager can manage customers",
      );
    }
    // Customer billing for credit branches is switched off for now.
    if (!CREDIT_BRANCH_BILLING) {
      throw new ForbiddenException(
        "Customer billing isn't available for credit branches",
      );
    }
    return storeId;
  }

  /** Admins reach any customer; a credit branch manager only their own. */
  private async assertOwnCreditBranchCustomer(
    customer: Customer,
    user: CurrentUserPayload,
  ): Promise<void> {
    if (user.role === UserRole.admin || user.role === UserRole.super_admin) {
      return;
    }
    const storeId = await this.creditBranchStoreIdFor(user);
    if (customer.storeId !== storeId) {
      throw new ForbiddenException("You cannot access this customer");
    }
  }

  async create(
    dto: CreateCustomerDto,
    user: CurrentUserPayload,
  ): Promise<Customer> {
    const organizationId = requireOrganizationId(user);

    // A credit branch manager may only add customers under their own
    // branch; a standard branch manager can't create customers at all
    // (unchanged). Admins may optionally assign one via dto.storeId.
    const storeId =
      user.role === UserRole.branch_manager
        ? ((await this.creditBranchStoreIdFor(user)) as string)
        : null;
    if (user.role === UserRole.admin && dto.storeId?.trim()) {
      throw new ForbiddenException(
        "A credit branch's customers are added by the branch",
      );
    }

    const customer = await this.prisma.customer.create({
      data: withOrganizationId(
        {
          name: dto.name.trim(),
          phone: dto.phone?.trim() || null,
          email: dto.email?.trim() || null,
          address: dto.address?.trim() || null,
          note: dto.note?.trim() || null,
          storeId,
          createdById: user.id,
        },
        organizationId,
      ),
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId,
        action: AuditAction.CUSTOMER_CREATED,
        entityType: "customer",
        entityId: customer.id,
        oldValue: Prisma.JsonNull,
        newValue: this.toAuditSnapshot(customer),
      },
    });

    return customer;
  }

  async update(
    id: string,
    dto: UpdateCustomerDto,
    user: CurrentUserPayload,
  ): Promise<Customer> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("At least one field must be provided");
    }

    const existing = await this.findOne(id);
    // The organization can look at a credit branch's customers but not change
    // them: the branch's own manager does that.
    if (user.role === UserRole.admin && existing.storeId) {
      throw new ForbiddenException(
        "A credit branch's customers are changed by the branch",
      );
    }
    await this.assertOwnCreditBranchCustomer(existing, user);
    const organizationId = requireOrganizationId(user);

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : undefined),
        ...(dto.phone !== undefined
          ? { phone: dto.phone.trim() || null }
          : undefined),
        ...(dto.email !== undefined
          ? { email: dto.email.trim() || null }
          : undefined),
        ...(dto.address !== undefined
          ? { address: dto.address.trim() || null }
          : undefined),
        ...(dto.note !== undefined
          ? { note: dto.note.trim() || null }
          : undefined),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId,
        action: AuditAction.CUSTOMER_UPDATED,
        entityType: "customer",
        entityId: customer.id,
        oldValue: this.toAuditSnapshot(existing),
        newValue: this.toAuditSnapshot(customer),
      },
    });

    return customer;
  }

  async getBalance(id: string, user: CurrentUserPayload) {
    const organizationId = requireOrganizationId(user);
    await assertBillingEnabled(this.prisma, organizationId);
    const customer = await this.findOne(id);
    await this.assertOwnCreditBranchCustomer(customer, user);

    return this.paymentsService.getCustomerBalance(id);
  }

  /**
   * Chronological ledger of invoices and payments with a running balance —
   * charges add, payments subtract.
   */
  async getStatement(id: string, user: CurrentUserPayload) {
    const organizationId = requireOrganizationId(user);
    await assertBillingEnabled(this.prisma, organizationId);
    const customer = await this.findOne(id);
    await this.assertOwnCreditBranchCustomer(customer, user);

    const [invoices, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { customerId: id },
        select: {
          id: true,
          number: true,
          numberLabel: true,
          total: true,
          paidAtSale: true,
          issuedAt: true,
          sale: { select: { saleDate: true } },
        },
        orderBy: [{ number: "asc" }],
      }),
      this.prisma.payment.findMany({
        where: { customerId: id },
        select: {
          id: true,
          amount: true,
          paidAt: true,
          note: true,
          createdAt: true,
          invoice: { select: { numberLabel: true } },
        },
        orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
      }),
    ]);

    type LedgerEvent =
      | {
          kind: "invoice";
          date: string;
          sort: number;
          reference: string;
          description: string;
          charge: number;
          payment: null;
        }
      | {
          kind: "payment";
          date: string;
          sort: number;
          reference: string;
          description: string;
          charge: null;
          payment: number;
        };

    const events: LedgerEvent[] = [
      // Each invoice emits a charge row, then a same-day payment row if
      // something was paid at the time of the sale (paidAtSale > 0).
      ...invoices.flatMap((inv): LedgerEvent[] => {
        const date = inv.sale.saleDate.toISOString().slice(0, 10);
        const ts = new Date(date).getTime();
        const rows: LedgerEvent[] = [
          {
            kind: "invoice",
            date,
            sort: ts,
            reference: inv.numberLabel,
            description: `Invoice ${inv.numberLabel}`,
            charge: toMoneyNumber(inv.total),
            payment: null,
          },
        ];
        const paidAtSale = toMoneyNumber(inv.paidAtSale);
        if (paidAtSale > 0) {
          rows.push({
            kind: "payment",
            date,
            // Slightly later sort so this appears after the invoice charge on
            // the same day but before any standalone payments on the same day.
            sort: ts + 1,
            reference: inv.numberLabel,
            description: `Paid at sale — ${inv.numberLabel}`,
            charge: null,
            payment: paidAtSale,
          });
        }
        return rows;
      }),
      // Standalone payments recorded after the sale.
      ...payments.map((p): LedgerEvent => {
        const date = p.paidAt.toISOString().slice(0, 10);
        return {
          kind: "payment",
          date,
          sort: new Date(date).getTime() + 2,
          reference: p.invoice.numberLabel,
          description: `Payment on ${p.invoice.numberLabel}${p.note ? ` — ${p.note}` : ""}`,
          charge: null,
          payment: toMoneyNumber(p.amount),
        };
      }),
    ];

    // Sort chronologically; within the same millisecond the sort value already
    // encodes the order (invoice → paidAtSale → standalone payment).
    events.sort((a, b) => a.sort - b.sort);

    let running = 0;
    const rows = events.map((event) => {
      running = toMoneyNumber(
        running + (event.charge ?? 0) - (event.payment ?? 0),
      );
      return {
        kind: event.kind,
        date: event.date,
        reference: event.reference,
        description: event.description,
        charge: event.charge,
        payment: event.payment,
        balance: running,
      };
    });

    return {
      rows,
      summary: await this.paymentsService.getCustomerBalance(id),
    };
  }

  /**
   * Customers with an outstanding balance (an unpaid invoice), highest first.
   * An admin sees the organization's own customers (storeId null): a credit
   * branch's customers owe the branch, not the organization. A credit branch
   * manager sees only their own branch's customers.
   */
  async getReceivables(user: CurrentUserPayload, query?: ReceivablesQueryDto) {
    const organizationId = requireOrganizationId(user);
    await assertBillingEnabled(this.prisma, organizationId);

    // Throws for a standard branch manager, who never had this page. An admin
    // sees the organization's own customers, or one credit branch's.
    const branchStoreId =
      user.role === UserRole.branch_manager
        ? ((await this.creditBranchStoreIdFor(user)) as string)
        : await creditBranchViewIdOf(this.prisma, user, query?.storeId);

    const groups = await this.prisma.invoice.groupBy({
      by: ["customerId"],
      where: {
        status: { in: ["unpaid", "partial"] },
        customer: { storeId: branchStoreId },
      },
      _sum: { total: true, paidAmount: true },
      _count: { _all: true },
    });

    // Only named customers can carry receivables (customerId null = anonymous
    // walk-in cash sale, which is fully paid by definition, so it won't appear
    // in unpaid/partial groups anyway — but guard for TypeScript's sake).
    const customerIds = groups
      .map((g) => g.customerId)
      .filter((id): id is string => id !== null);
    if (customerIds.length === 0) return [];

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds }, storeId: branchStoreId },
      select: { id: true, name: true, phone: true },
    });
    const byId = new Map(customers.map((c) => [c.id, c]));

    return groups
      .flatMap((g) => {
        if (g.customerId === null) return [];
        const balance = Math.max(
          0,
          toMoneyNumber(
            Number(g._sum.total ?? 0) - Number(g._sum.paidAmount ?? 0),
          ),
        );
        return [
          {
            customer: byId.get(g.customerId) ?? null,
            unpaidInvoiceCount: g._count._all,
            balance,
          },
        ];
      })
      .filter((row) => row.customer !== null && row.balance > 0)
      .sort((a, b) => b.balance - a.balance);
  }

  private toAuditSnapshot(customer: Customer): Prisma.InputJsonObject {
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      note: customer.note,
    };
  }
}
