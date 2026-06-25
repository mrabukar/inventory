import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { orderByCreatedAtDesc } from "../../common/utils/list-order.util";
import { PrismaService } from "../../prisma/prisma.service";
import { PaginatedResult } from "../stores/stores.service";
import { AuditLogQueryDto } from "./dto/audit-log-query.dto";
import {
  parseAuditRangeEnd,
  parseAuditRangeStart,
} from "./audit-log-date.util";

const auditLogInclude = {
  user: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.AuditLogInclude;

export type AuditLogWithUser = Prisma.AuditLogGetPayload<{
  include: typeof auditLogInclude;
}>;

function userSearchFilter(search: string): Prisma.UserWhereInput {
  return {
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ],
  };
}

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: AuditLogQueryDto,
  ): Promise<PaginatedResult<AuditLogWithUser>> {
    const skip = (query.page - 1) * query.limit;
    const searchTerm =
      typeof query.search === "string" ? query.search.trim() : "";

    const fromDate =
      typeof query.fromDate === "string" ? query.fromDate.trim() : "";
    const toDate = typeof query.toDate === "string" ? query.toDate.trim() : "";

    const where: Prisma.AuditLogWhereInput = {
      ...(query.userId ? { userId: query.userId } : undefined),
      ...(query.action ? { action: query.action } : undefined),
      ...(query.entityType ? { entityType: query.entityType } : undefined),
      ...(query.entityId ? { entityId: query.entityId } : undefined),
      ...(searchTerm ? { user: userSearchFilter(searchTerm) } : undefined),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate
                ? { gte: parseAuditRangeStart(fromDate) }
                : undefined),
              ...(toDate ? { lte: parseAuditRangeEnd(toDate) } : undefined),
            },
          }
        : undefined),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: orderByCreatedAtDesc,
        include: auditLogInclude,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}
