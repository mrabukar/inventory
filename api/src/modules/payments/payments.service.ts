import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, InvoiceStatus, Payment, Prisma } from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import { MUTATION_TRANSACTION_OPTIONS } from "../../common/constants/prisma-transaction.constants";
import { assertBillingEnabled } from "../../common/utils/require-billing-enabled.util";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { withOrganizationId } from "../../common/utils/with-organization-id.util";
import { toMoneyNumber } from "../../common/utils/money.util";
import { PrismaService } from "../../prisma/prisma.service";
import { PaginatedResult } from "../stores/stores.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaymentQueryDto } from "./dto/payment-query.dto";

const paymentInclude = {
  invoice: { select: { id: true, numberLabel: true, total: true } },
  customer: { select: { id: true, name: true } },
  recordedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.PaymentInclude;

export type PaymentWithDetails = Prisma.PaymentGetPayload<{
  include: typeof paymentInclude;
}>;

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: PaymentQueryDto,
    user: CurrentUserPayload,
  ): Promise<PaginatedResult<PaymentWithDetails>> {
    const organizationId = requireOrganizationId(user);
    await assertBillingEnabled(this.prisma, organizationId);

    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {
      ...(query.customerId ? { customerId: query.customerId } : undefined),
      ...(query.invoiceId ? { invoiceId: query.invoiceId } : undefined),
    };

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        include: paymentInclude,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(
    dto: CreatePaymentDto,
    user: CurrentUserPayload,
  ): Promise<PaymentWithDetails> {
    const organizationId = requireOrganizationId(user);
    await assertBillingEnabled(this.prisma, organizationId);

    const amount = toMoneyNumber(dto.amount);
    if (amount <= 0) {
      throw new BadRequestException("Amount must be positive");
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) {
      throw new NotFoundException(
        `Customer with id "${dto.customerId}" not found`,
      );
    }

    const paidAt = new Date(dto.paidAt);
    if (Number.isNaN(paidAt.getTime())) {
      throw new BadRequestException("paidAt must be a valid date");
    }

    const paymentId = await this.prisma.$transaction(async (tx) => {
      const invoice = await this.resolveTargetInvoice(
        tx,
        dto.customerId,
        dto.invoiceId,
      );

      const remaining =
        Number(invoice.total) - Number(invoice.paidAmount);
      if (amount > remaining + 0.001) {
        throw new BadRequestException(
          `Payment exceeds invoice remainder: ${remaining.toFixed(2)} left on ${invoice.numberLabel}`,
        );
      }

      return this.recordPaymentInTransaction(tx, {
        organizationId,
        userId: user.id,
        invoiceId: invoice.id,
        customerId: dto.customerId,
        invoiceNumberLabel: invoice.numberLabel,
        amount,
        paidAt,
        note: dto.note?.trim() || null,
      });
    }, MUTATION_TRANSACTION_OPTIONS);

    return this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: paymentInclude,
    });
  }

  /** Sum of (total - paidAmount) across a customer's invoices. Floors at 0. */
  async getCustomerBalance(customerId: string): Promise<{
    totalBilled: number;
    totalPaid: number;
    balance: number;
    unpaidInvoiceCount: number;
  }> {
    const invoices = await this.prisma.invoice.findMany({
      where: { customerId },
      select: {
        total: true,
        paidAmount: true,
        status: true,
      },
    });

    let totalBilled = 0;
    let totalPaid = 0;
    let unpaidInvoiceCount = 0;
    for (const inv of invoices) {
      totalBilled += Number(inv.total);
      totalPaid += Number(inv.paidAmount);
      if (inv.status !== InvoiceStatus.paid) {
        unpaidInvoiceCount += 1;
      }
    }
    const balance = Math.max(0, toMoneyNumber(totalBilled - totalPaid));

    return {
      totalBilled: toMoneyNumber(totalBilled),
      totalPaid: toMoneyNumber(totalPaid),
      balance,
      unpaidInvoiceCount,
    };
  }

  /**
   * Record a payment inside an existing transaction. Used by:
   *   - standalone POST /payments (this service's create)
   *   - "amount paid now" at sale time (sales service, same tx as the sale)
   * Caller must have already validated the amount ≤ invoice remainder.
   */
  async recordPaymentInTransaction(
    tx: Prisma.TransactionClient,
    params: {
      organizationId: string;
      userId: string;
      invoiceId: string;
      customerId: string | null;
      invoiceNumberLabel: string;
      amount: number;
      paidAt: Date;
      note?: string | null;
    },
  ): Promise<string> {
    const payment = await tx.payment.create({
      data: withOrganizationId(
        {
          invoiceId: params.invoiceId,
          customerId: params.customerId ?? null,
          amount: params.amount,
          paidAt: params.paidAt,
          note: params.note ?? null,
          recordedById: params.userId,
        },
        params.organizationId,
      ),
    });

    const invoiceAfter = await tx.invoice.findUniqueOrThrow({
      where: { id: params.invoiceId },
      select: { total: true, paidAmount: true },
    });
    const newPaid = toMoneyNumber(
      Number(invoiceAfter.paidAmount) + params.amount,
    );
    const total = Number(invoiceAfter.total);
    const status: InvoiceStatus =
      newPaid >= total
        ? InvoiceStatus.paid
        : newPaid > 0
          ? InvoiceStatus.partial
          : InvoiceStatus.unpaid;

    await tx.invoice.update({
      where: { id: params.invoiceId },
      data: { paidAmount: newPaid, status },
    });

    await tx.auditLog.create({
      data: {
        userId: params.userId,
        organizationId: params.organizationId,
        action: AuditAction.PAYMENT_RECORDED,
        entityType: "payment",
        entityId: payment.id,
        oldValue: Prisma.JsonNull,
        newValue: {
          id: payment.id,
          invoiceId: params.invoiceId,
          invoiceNumberLabel: params.invoiceNumberLabel,
          customerId: params.customerId,
          amount: params.amount,
          invoicePaidAmount: newPaid,
          invoiceStatus: status,
        },
      },
    });

    return payment.id;
  }

  private async resolveTargetInvoice(
    tx: Prisma.TransactionClient,
    customerId: string,
    invoiceId?: string,
  ) {
    if (invoiceId) {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          customerId: true,
          numberLabel: true,
          total: true,
          paidAmount: true,
          status: true,
        },
      });
      if (!invoice) {
        throw new NotFoundException(`Invoice with id "${invoiceId}" not found`);
      }
      if (invoice.customerId !== customerId) {
        throw new BadRequestException(
          "Invoice does not belong to the selected customer",
        );
      }
      if (invoice.status === InvoiceStatus.paid) {
        throw new BadRequestException(
          `Invoice ${invoice.numberLabel} is already fully paid`,
        );
      }
      return invoice;
    }

    // Default: oldest unpaid invoice for this customer.
    const oldest = await tx.invoice.findFirst({
      where: { customerId, status: { in: ["unpaid", "partial"] } },
      orderBy: [{ number: "asc" }],
      select: {
        id: true,
        customerId: true,
        numberLabel: true,
        total: true,
        paidAmount: true,
        status: true,
      },
    });
    if (!oldest) {
      throw new BadRequestException(
        "This customer has no unpaid invoice to apply the payment to",
      );
    }
    return oldest;
  }
}

export type CustomerStatementRow =
  | {
      kind: "invoice";
      date: string;
      reference: string;
      description: string;
      charge: number;
      payment: null;
      balance: number;
    }
  | {
      kind: "payment";
      date: string;
      reference: string;
      description: string;
      charge: null;
      payment: number;
      balance: number;
    };
