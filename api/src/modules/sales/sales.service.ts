import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import {
  parseDateColumnRangeEnd,
  parseDateColumnRangeStart,
} from "../../common/utils/app-timezone.util";
import { MUTATION_TRANSACTION_OPTIONS } from "../../common/constants/prisma-transaction.constants";
import { lockInventoryForMutation } from "../../common/utils/inventory-lock.util";
import { orderByUpdatedAtDesc } from "../../common/utils/list-order.util";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { withOrganizationId } from "../../common/utils/with-organization-id.util";
import { TenantStoreResolver } from "../../common/tenant/tenant-store-resolver.service";
import { assertStoreAccess } from "../../common/utils/store-scope.util";
import { PrismaService } from "../../prisma/prisma.service";
import { ProductsService } from "../products/products.service";
import { PaginatedResult } from "../stores/stores.service";
import { CorrectSaleDto } from "./dto/correct-sale.dto";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { SaleQueryDto } from "./dto/sale-query.dto";
import { parseAndValidateSaleDate } from "./sale-date.util";
import { toMoneyNumber } from "../../common/utils/money.util";

/** Sales may only be corrected within this many hours of recording (`createdAt`). */
const SALE_CORRECTION_WINDOW_HOURS = 12;

const saleInclude = {
  items: {
    include: { product: { include: { category: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  store: true,
  customer: true,
  location: true,
  invoice: true,
  soldBy: { select: { id: true, name: true, email: true } },
  corrections: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.SaleInclude;

export type SaleWithDetails = Prisma.SaleGetPayload<{
  include: typeof saleInclude;
}>;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly tenantStoreResolver: TenantStoreResolver,
  ) {}

  async findAll(
    query: SaleQueryDto,
    user: CurrentUserPayload,
  ): Promise<PaginatedResult<SaleWithDetails>> {
    const skip = (query.page - 1) * query.limit;
    const queryStoreId =
      typeof query.storeId === "string" ? query.storeId.trim() : undefined;
    if (queryStoreId) {
      assertStoreAccess(queryStoreId, user);
    }
    const storeId = await this.tenantStoreResolver.resolveStoreFilter(
      user,
      query.storeId,
    );
    const searchTerm =
      typeof query.search === "string" ? query.search.trim() : "";
    const fromDate =
      typeof query.fromDate === "string" ? query.fromDate.trim() : "";
    const toDate = typeof query.toDate === "string" ? query.toDate.trim() : "";

    // Product / category / search filters now match against the sale's line items.
    const itemFilter: Prisma.SaleItemWhereInput = {
      ...(query.productId ? { productId: query.productId } : undefined),
      ...(query.categoryId || searchTerm
        ? {
            product: {
              ...(query.categoryId
                ? { categoryId: query.categoryId }
                : undefined),
              ...(searchTerm
                ? { name: { contains: searchTerm, mode: "insensitive" } }
                : undefined),
            },
          }
        : undefined),
    };

    const where: Prisma.SaleWhereInput = {
      ...(storeId ? { storeId } : undefined),
      ...(query.status ? { status: query.status } : undefined),
      ...(Object.keys(itemFilter).length > 0
        ? { items: { some: itemFilter } }
        : undefined),
      ...(fromDate || toDate
        ? {
            saleDate: {
              ...(fromDate
                ? { gte: parseDateColumnRangeStart(fromDate) }
                : undefined),
              ...(toDate
                ? { lte: parseDateColumnRangeEnd(toDate) }
                : undefined),
            },
          }
        : undefined),
    };

    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: orderByUpdatedAtDesc,
        include: saleInclude,
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      data: data.map((sale) => this.sanitizeSaleForUser(sale, user)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(
    id: string,
    user: CurrentUserPayload,
  ): Promise<SaleWithDetails> {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: saleInclude,
    });

    if (!sale) {
      throw new NotFoundException(`Sale with id "${id}" not found`);
    }

    assertStoreAccess(sale.storeId, user);

    return this.sanitizeSaleForUser(sale, user);
  }

  /** Branch managers must not see cost — strip it from every line item. */
  private sanitizeSaleForUser(
    sale: SaleWithDetails,
    user: CurrentUserPayload,
  ): SaleWithDetails {
    if (user.role !== UserRole.branch_manager) {
      return sale;
    }

    return {
      ...sale,
      items: sale.items.map((item) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { unitPurchasePrice: _cost, ...rest } = item;
        return rest;
      }),
    } as SaleWithDetails;
  }

  async create(
    dto: CreateSaleDto,
    user: CurrentUserPayload,
  ): Promise<SaleWithDetails> {
    const storeId = await this.tenantStoreResolver.resolveSaleStoreId(
      user,
      (id: string) => this.findManagerStore(id),
    );
    const saleDate = parseAndValidateSaleDate(dto.saleDate);
    const organizationId = requireOrganizationId(user);

    const productIds = dto.items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException(
        "Each product can appear only once in a sale",
      );
    }

    // Billing orgs generate an invoice per sale and require a named customer.
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { billingEnabled: true },
    });
    const billingEnabled = org?.billingEnabled ?? false;

    //! optional for customer in any sale.
    // if (billingEnabled && !dto.customerId) {
    //   throw new BadRequestException(
    //     "A customer is required for sales in a billing organization",
    //   );
    // }
    if (dto.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: dto.customerId },
      });
      if (!customer) {
        throw new NotFoundException(
          `Customer with id "${dto.customerId}" not found`,
        );
      }
    }
    if (dto.locationId) {
      const location = await this.prisma.saleLocation.findUnique({
        where: { id: dto.locationId },
      });
      if (!location) {
        throw new NotFoundException(
          `Location with id "${dto.locationId}" not found`,
        );
      }
    }

    // "Amount paid now" — only meaningful for billing orgs.
    const paidNow = billingEnabled ? toMoneyNumber(dto.paidAmount ?? 0) : 0;
    if (paidNow < 0) {
      throw new BadRequestException("paidAmount cannot be negative");
    }

    // Snapshot price + cost for every line before opening the transaction.
    const lines = await Promise.all(
      dto.items.map(async (item) => {
        const product = await this.productsService.findOne(item.productId);
        const unitPrice = Number(product.sellingPrice);
        const unitPurchasePrice = Number(product.averageCost);
        return {
          product,
          quantitySold: item.quantitySold,
          unitPrice,
          unitPurchasePrice,
          lineTotal: unitPrice * item.quantitySold,
        };
      }),
    );
    const totalAmount = lines.reduce((sum, line) => sum + line.lineTotal, 0);

    if (paidNow > totalAmount + 0.001) {
      throw new BadRequestException(
        `Amount paid now cannot exceed sale total (${totalAmount.toFixed(2)})`,
      );
    }

    // Billing rule: a customer is required only when the sale is NOT fully paid
    // (someone must carry the outstanding balance). Fully-paid walk-in cash sales
    // may omit the customer.
    if (billingEnabled && paidNow < totalAmount - 0.001 && !dto.customerId) {
      throw new BadRequestException(
        "A customer is required when the sale is not fully paid",
      );
    }

    const saleId = await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: withOrganizationId(
          {
            storeId,
            soldById: user.id,
            customerId: dto.customerId ?? null,
            locationId: dto.locationId ?? null,
            totalAmount,
            saleDate,
            note: dto.note,
            status: "active",
          },
          organizationId,
        ),
      });

      for (const line of lines) {
        const inventory = await lockInventoryForMutation(
          tx,
          organizationId,
          line.product.id,
          storeId,
        );

        if (!inventory) {
          throw new BadRequestException(
            `Product "${line.product.name}" is not stocked at your store`,
          );
        }

        if (inventory.quantity < line.quantitySold) {
          throw new BadRequestException(
            `Insufficient stock for "${line.product.name}": ${inventory.quantity} available, ${line.quantitySold} requested`,
          );
        }

        await tx.saleItem.create({
          data: withOrganizationId(
            {
              saleId: sale.id,
              productId: line.product.id,
              storeId,
              saleDate,
              quantitySold: line.quantitySold,
              unitPrice: line.unitPrice,
              unitPurchasePrice: line.unitPurchasePrice,
              lineTotal: line.lineTotal,
            },
            organizationId,
          ),
        });

        const previousQty = inventory.quantity;
        const newQty = previousQty - line.quantitySold;
        const updatedInventory = await tx.inventory.update({
          where: {
            productId_storeId: { productId: line.product.id, storeId },
          },
          data: { quantity: newQty },
        });

        await tx.auditLog.create({
          data: {
            userId: user.id,
            organizationId,
            action: "INVENTORY_UPDATED",
            entityType: "inventory",
            entityId: updatedInventory.id,
            oldValue: {
              quantity: previousQty,
              productId: line.product.id,
              storeId,
            },
            newValue: {
              quantity: newQty,
              productId: line.product.id,
              storeId,
            },
          },
        });
      }

      if (billingEnabled) {
        // Atomically allocate the next per-org invoice number (row-locked).
        const { nextInvoiceNumber } = await tx.organization.update({
          where: { id: organizationId },
          data: { nextInvoiceNumber: { increment: 1 } },
          select: { nextInvoiceNumber: true },
        });
        const number = nextInvoiceNumber - 1;
        const numberLabel = `INV-${String(number).padStart(4, "0")}`;

        const invoiceStatus =
          paidNow >= totalAmount ? "paid" : paidNow > 0 ? "partial" : "unpaid";

        const invoice = await tx.invoice.create({
          data: withOrganizationId(
            {
              saleId: sale.id,
              customerId: dto.customerId ?? null,
              number,
              numberLabel,
              total: totalAmount,
              // Sale-time payment stored directly on the invoice — no payment
              // row created so corrections can adjust this cleanly.
              paidAtSale: paidNow,
              paidAmount: paidNow,
              status: invoiceStatus,
            },
            organizationId,
          ),
        });

        await tx.auditLog.create({
          data: {
            userId: user.id,
            organizationId,
            action: "INVOICE_CREATED",
            entityType: "invoice",
            entityId: invoice.id,
            oldValue: Prisma.JsonNull,
            newValue: {
              id: invoice.id,
              numberLabel,
              saleId: sale.id,
              customerId: dto.customerId,
              total: totalAmount,
              paidAtSale: paidNow,
              status: invoiceStatus,
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          organizationId,
          action: "SALE_CREATED",
          entityType: "sale",
          entityId: sale.id,
          oldValue: Prisma.JsonNull,
          newValue: {
            id: sale.id,
            storeId,
            customerId: dto.customerId ?? null,
            totalAmount,
            saleDate,
            items: lines.map((line) => ({
              productId: line.product.id,
              productName: line.product.name,
              quantitySold: line.quantitySold,
              unitPrice: line.unitPrice,
              unitPurchasePrice: line.unitPurchasePrice,
              lineTotal: line.lineTotal,
            })),
          },
        },
      });

      return sale.id;
    }, MUTATION_TRANSACTION_OPTIONS);

    return this.sanitizeSaleForUser(
      await this.prisma.sale.findUniqueOrThrow({
        where: { id: saleId },
        include: saleInclude,
      }),
      user,
    );
  }

  async correct(
    saleId: string,
    dto: CorrectSaleDto,
    user: CurrentUserPayload,
  ): Promise<SaleWithDetails> {
    const storeId = await this.tenantStoreResolver.resolveSaleStoreId(
      user,
      (id: string) => this.findManagerStore(id),
    );

    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, storeId },
      include: { items: true },
    });

    if (!sale) {
      throw new NotFoundException(`Sale with id "${saleId}" not found`);
    }

    const ageMs = Date.now() - sale.createdAt.getTime();
    if (ageMs > SALE_CORRECTION_WINDOW_HOURS * 60 * 60 * 1000) {
      throw new BadRequestException(
        `Corrections are only allowed within ${SALE_CORRECTION_WINDOW_HOURS} hours of recording`,
      );
    }

    const seenIds = new Set<string>();
    for (const entry of dto.items) {
      if (seenIds.has(entry.saleItemId)) {
        throw new BadRequestException(
          `Duplicate sale item "${entry.saleItemId}" in correction payload`,
        );
      }
      seenIds.add(entry.saleItemId);
    }

    const changes = dto.items.map((entry) => {
      const line = sale.items.find((item) => item.id === entry.saleItemId);
      if (!line) {
        throw new NotFoundException(
          `Sale item "${entry.saleItemId}" not found on this sale`,
        );
      }
      if (entry.correctedQuantity === line.quantitySold) {
        throw new BadRequestException(
          "Each corrected quantity must differ from the current quantity",
        );
      }
      const delta = entry.correctedQuantity - line.quantitySold;
      const unitPrice = Number(line.unitPrice);
      const newLineTotal = unitPrice * entry.correctedQuantity;
      return {
        line,
        correctedQuantity: entry.correctedQuantity,
        delta,
        newLineTotal,
      };
    });

    const organizationId = requireOrganizationId(user);

    await this.prisma.$transaction(async (tx) => {
      for (const change of changes) {
        const { line, correctedQuantity, delta, newLineTotal } = change;

        const inventory = await lockInventoryForMutation(
          tx,
          organizationId,
          line.productId,
          line.storeId,
        );

        if (!inventory) {
          throw new BadRequestException(
            "Inventory record not found for this sale item",
          );
        }

        if (delta > 0 && inventory.quantity < delta) {
          throw new BadRequestException(
            `Insufficient stock to increase sale: ${inventory.quantity} available, ${delta} additional units required`,
          );
        }

        const previousQty = inventory.quantity;
        const newQty = previousQty - delta;
        if (newQty < 0) {
          throw new BadRequestException(
            "Correction would result in negative stock",
          );
        }

        await tx.saleItem.update({
          where: { id: line.id },
          data: { quantitySold: correctedQuantity, lineTotal: newLineTotal },
        });

        await tx.saleCorrection.create({
          data: withOrganizationId(
            {
              saleId,
              saleItemId: line.id,
              originalQuantity: line.quantitySold,
              correctedQuantity,
              reason: dto.reason,
              correctedById: user.id,
            },
            organizationId,
          ),
        });

        const updatedInventory = await tx.inventory.update({
          where: {
            productId_storeId: {
              productId: line.productId,
              storeId: line.storeId,
            },
          },
          data: { quantity: newQty },
        });

        await tx.auditLog.create({
          data: {
            userId: user.id,
            organizationId,
            action: "SALE_CORRECTED",
            entityType: "sale",
            entityId: saleId,
            oldValue: {
              saleItemId: line.id,
              productId: line.productId,
              quantitySold: line.quantitySold,
              lineTotal: Number(line.lineTotal),
            },
            newValue: {
              saleItemId: line.id,
              quantitySold: correctedQuantity,
              lineTotal: newLineTotal,
              reason: dto.reason,
            },
          },
        });

        await tx.auditLog.create({
          data: {
            userId: user.id,
            organizationId,
            action: "INVENTORY_UPDATED",
            entityType: "inventory",
            entityId: updatedInventory.id,
            oldValue: {
              quantity: previousQty,
              productId: line.productId,
              storeId: line.storeId,
            },
            newValue: {
              quantity: newQty,
              productId: line.productId,
              storeId: line.storeId,
            },
          },
        });
      }

      // Recompute the sale total from the current line totals (fresh read).
      const items = await tx.saleItem.findMany({
        where: { saleId },
        select: { lineTotal: true },
      });
      const newTotal = items.reduce(
        (sum, item) => sum + Number(item.lineTotal),
        0,
      );

      await tx.sale.update({
        where: { id: saleId },
        data: { totalAmount: newTotal, status: "corrected" },
      });

      // Keep the invoice in sync with the corrected sale total.
      // paidAtSale was auto-generated from the (wrong) original total, so we
      // cap it to the new total. standalonePaid (from real payment rows added
      // after the sale) is preserved as-is; paidAmount = capped paidAtSale +
      // standalone paid, also capped to the new total.
      const invoiceRow = await tx.invoice.findUnique({
        where: { saleId },
        select: { id: true, paidAtSale: true, paidAmount: true },
      });
      if (invoiceRow) {
        const prevPaidAtSale = toMoneyNumber(invoiceRow.paidAtSale);
        const prevPaidAmount = toMoneyNumber(invoiceRow.paidAmount);
        const standalonePaid = toMoneyNumber(prevPaidAmount - prevPaidAtSale);

        const newPaidAtSale = toMoneyNumber(
          Math.min(prevPaidAtSale, Math.max(0, newTotal - standalonePaid)),
        );
        const newPaidAmount = toMoneyNumber(
          Math.min(newTotal, newPaidAtSale + standalonePaid),
        );
        const nextStatus =
          newPaidAmount >= newTotal
            ? "paid"
            : newPaidAmount > 0
              ? "partial"
              : "unpaid";

        await tx.invoice.update({
          where: { id: invoiceRow.id },
          data: {
            total: newTotal,
            paidAtSale: newPaidAtSale,
            paidAmount: newPaidAmount,
            status: nextStatus,
          },
        });
      }
    }, MUTATION_TRANSACTION_OPTIONS);

    return this.sanitizeSaleForUser(
      await this.prisma.sale.findUniqueOrThrow({
        where: { id: saleId },
        include: saleInclude,
      }),
      user,
    );
  }

  private findManagerStore(storeId: string) {
    return this.prisma.store.findUnique({
      where: { id: storeId },
      select: { isActive: true },
    });
  }
}
