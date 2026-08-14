import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import { assertBillingEnabled } from "../../common/utils/require-billing-enabled.util";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { PrismaService } from "../../prisma/prisma.service";
import { PaginatedResult } from "../stores/stores.service";
import { InvoiceQueryDto } from "./dto/invoice-query.dto";

const invoiceInclude = {
  customer: true,
  sale: {
    include: {
      items: {
        include: { product: { include: { category: true } } },
        orderBy: { createdAt: "asc" as const },
      },
      soldBy: { select: { id: true, name: true, email: true } },
      location: true,
    },
  },
  organization: {
    select: {
      id: true,
      name: true,
      phone: true,
      paymentNumber: true,
      address: true,
      logoKey: true,
    },
  },
} satisfies Prisma.InvoiceInclude;

export type InvoiceWithDetails = Prisma.InvoiceGetPayload<{
  include: typeof invoiceInclude;
}>;

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: InvoiceQueryDto,
    user: CurrentUserPayload,
  ): Promise<PaginatedResult<InvoiceWithDetails>> {
    const organizationId = requireOrganizationId(user);
    await assertBillingEnabled(this.prisma, organizationId);

    const { page, limit } = query;
    const skip = (page - 1) * limit;
    const search = typeof query.search === "string" ? query.search.trim() : "";

    const where: Prisma.InvoiceWhereInput = {
      ...(query.status ? { status: query.status } : undefined),
      ...(query.customerId ? { customerId: query.customerId } : undefined),
      ...(search
        ? {
            OR: [
              { numberLabel: { contains: search, mode: "insensitive" } },
              { customer: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : undefined),
    };

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { issuedAt: "desc" },
        include: invoiceInclude,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(
    id: string,
    user: CurrentUserPayload,
  ): Promise<InvoiceWithDetails> {
    const organizationId = requireOrganizationId(user);
    await assertBillingEnabled(this.prisma, organizationId);

    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: invoiceInclude,
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with id "${id}" not found`);
    }

    return invoice;
  }
}
