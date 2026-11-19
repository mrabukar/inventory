import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, Prisma, StoreType, UserRole } from "@prisma/client";
import { MUTATION_TRANSACTION_OPTIONS } from "../../common/constants/prisma-transaction.constants";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import { getBranchBalance } from "../../common/utils/branch-balance.util";
import { toMoneyNumber } from "../../common/utils/money.util";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { assertBranchManagerHasStore } from "../../common/utils/store-scope.util";
import { withOrganizationId } from "../../common/utils/with-organization-id.util";
import { PrismaService } from "../../prisma/prisma.service";
import { BranchPaymentQueryDto } from "./dto/branch-payment-query.dto";
import { RejectBranchPaymentDto } from "./dto/reject-branch-payment.dto";
import { SubmitBranchPaymentDto } from "./dto/submit-branch-payment.dto";

const paymentInclude = {
  store: { select: { id: true, name: true } },
  submittedBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
} satisfies Prisma.BranchPaymentInclude;

@Injectable()
export class BranchPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: BranchPaymentQueryDto, user: CurrentUserPayload) {
    const organizationId = requireOrganizationId(user);
    const { page, limit, status } = query;

    let storeId: string | undefined;
    if (user.role === UserRole.branch_manager) {
      storeId = assertBranchManagerHasStore(user);
    } else {
      storeId = query.storeId?.trim() || undefined;
    }

    const where: Prisma.BranchPaymentWhereInput = {
      organizationId,
      ...(storeId ? { storeId } : undefined),
      ...(status ? { status } : undefined),
    };

    const [data, total] = await Promise.all([
      this.prisma.branchPayment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        // `id` as the last key keeps paging stable when values tie.
        orderBy: [{ [query.sortBy]: query.order }, { id: "asc" }],
        include: paymentInclude,
      }),
      this.prisma.branchPayment.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** How many payments wait for review, and what they add up to. */
  async countPending(
    user: CurrentUserPayload,
  ): Promise<{ count: number; amount: number }> {
    const organizationId = requireOrganizationId(user);
    const agg = await this.prisma.branchPayment.aggregate({
      where: { organizationId, status: "pending" },
      _count: { _all: true },
      _sum: { amount: true },
    });
    return {
      count: agg._count._all,
      amount: toMoneyNumber(agg._sum.amount),
    };
  }

  async submit(dto: SubmitBranchPaymentDto, user: CurrentUserPayload) {
    const organizationId = requireOrganizationId(user);
    const storeId = assertBranchManagerHasStore(user);

    const store = await this.prisma.store.findFirst({
      where: { id: storeId, organizationId, type: StoreType.credit },
    });
    if (!store) {
      throw new ForbiddenException(
        "Your account is not assigned to a credit branch",
      );
    }

    const amount = toMoneyNumber(dto.amount);
    const { balance, totalPending } = await getBranchBalance(
      this.prisma,
      storeId,
    );
    if (amount > toMoneyNumber(balance - totalPending) + 0.001) {
      throw new BadRequestException(
        `This payment would exceed what the branch owes (${toMoneyNumber(balance - totalPending).toFixed(2)} remaining)`,
      );
    }

    const payment = await this.prisma.branchPayment.create({
      data: withOrganizationId(
        {
          storeId,
          amount,
          paidAt: new Date(dto.paidAt),
          method: dto.method,
          reference: dto.reference,
          status: "pending",
          submittedById: user.id,
        },
        organizationId,
      ),
      include: paymentInclude,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId,
        action: AuditAction.BRANCH_PAYMENT_SUBMITTED,
        entityType: "branch_payment",
        entityId: payment.id,
        oldValue: Prisma.JsonNull,
        newValue: {
          storeId,
          amount,
          method: dto.method,
          reference: dto.reference,
        },
      },
    });

    return payment;
  }

  async approve(id: string, user: CurrentUserPayload) {
    const organizationId = requireOrganizationId(user);

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.branchPayment.findFirst({
        where: { id, organizationId },
        select: { id: true, status: true, storeId: true, amount: true },
      });
      if (!existing) {
        throw new NotFoundException(`Payment with id "${id}" not found`);
      }

      const { count } = await tx.branchPayment.updateMany({
        where: { id, organizationId, status: "pending" },
        data: {
          status: "approved",
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
      });
      if (count !== 1) {
        throw new ConflictException(
          existing.status === "rejected"
            ? "This payment has already been rejected"
            : "This payment has already been approved",
        );
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          organizationId,
          action: AuditAction.BRANCH_PAYMENT_APPROVED,
          entityType: "branch_payment",
          entityId: id,
          oldValue: { status: "pending" },
          newValue: {
            status: "approved",
            amount: toMoneyNumber(existing.amount),
          },
        },
      });
    }, MUTATION_TRANSACTION_OPTIONS);

    return this.prisma.branchPayment.findUniqueOrThrow({
      where: { id },
      include: paymentInclude,
    });
  }

  async reject(
    id: string,
    dto: RejectBranchPaymentDto,
    user: CurrentUserPayload,
  ) {
    const organizationId = requireOrganizationId(user);
    const reason = dto.reason.trim();

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.branchPayment.findFirst({
        where: { id, organizationId },
        select: { id: true, status: true },
      });
      if (!existing) {
        throw new NotFoundException(`Payment with id "${id}" not found`);
      }

      const { count } = await tx.branchPayment.updateMany({
        where: { id, organizationId, status: "pending" },
        data: {
          status: "rejected",
          reviewedById: user.id,
          reviewedAt: new Date(),
          rejectionReason: reason,
        },
      });
      if (count !== 1) {
        throw new ConflictException(
          existing.status === "approved"
            ? "This payment has already been approved"
            : "This payment has already been rejected",
        );
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          organizationId,
          action: AuditAction.BRANCH_PAYMENT_REJECTED,
          entityType: "branch_payment",
          entityId: id,
          oldValue: { status: "pending" },
          newValue: { status: "rejected", reason },
        },
      });
    }, MUTATION_TRANSACTION_OPTIONS);

    return this.prisma.branchPayment.findUniqueOrThrow({
      where: { id },
      include: paymentInclude,
    });
  }
}
