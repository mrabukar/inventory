import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, Customer, Prisma } from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import { assertBillingEnabled } from "../../common/utils/require-billing-enabled.util";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { toMoneyNumber } from "../../common/utils/money.util";
import { withOrganizationId } from "../../common/utils/with-organization-id.util";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { PaginatedResult } from "../stores/stores.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { CustomerQueryDto } from "./dto/customer-query.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async findAll(query: CustomerQueryDto): Promise<PaginatedResult<Customer>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;
    const search = typeof query.search === "string" ? query.search.trim() : "";

    const where: Prisma.CustomerWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

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

  async findOne(id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer with id "${id}" not found`);
    }
    return customer;
  }

  async create(
    dto: CreateCustomerDto,
    user: CurrentUserPayload,
  ): Promise<Customer> {
    const organizationId = requireOrganizationId(user);

    const customer = await this.prisma.customer.create({
      data: withOrganizationId(
        {
          name: dto.name.trim(),
          phone: dto.phone?.trim() || null,
          email: dto.email?.trim() || null,
          address: dto.address?.trim() || null,
          note: dto.note?.trim() || null,
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
    await this.findOne(id);

    return this.paymentsService.getCustomerBalance(id);
  }

  /**
   * Chronological ledger of invoices and payments with a running balance —
   * charges add, payments subtract.
   */
  async getStatement(id: string, user: CurrentUserPayload) {
    const organizationId = requireOrganizationId(user);
    await assertBillingEnabled(this.prisma, organizationId);
    await this.findOne(id);

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
   * Customers with an outstanding balance (an unpaid invoice), sorted by
   * highest balance first.
   */
  async getReceivables(user: CurrentUserPayload) {
    const organizationId = requireOrganizationId(user);
    await assertBillingEnabled(this.prisma, organizationId);

    const groups = await this.prisma.invoice.groupBy({
      by: ["customerId"],
      where: { status: { in: ["unpaid", "partial"] } },
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
      where: { id: { in: customerIds } },
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
