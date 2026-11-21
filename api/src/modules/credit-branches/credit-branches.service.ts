import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, Prisma, StoreType, UserRole } from "@prisma/client";
import { MUTATION_TRANSACTION_OPTIONS } from "../../common/constants/prisma-transaction.constants";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import { getBranchBalance } from "../../common/utils/branch-balance.util";
import {
  allocateUniquePrefix,
  assertPrefixAvailable,
  derivePrefixFromName,
  normalizeInvoicePrefix,
} from "../../common/utils/branch-invoice-prefix.util";
import { lockInventoryForMutation } from "../../common/utils/inventory-lock.util";
import { orderByUpdatedAtDesc } from "../../common/utils/list-order.util";
import { toMoneyNumber } from "../../common/utils/money.util";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { withOrganizationId } from "../../common/utils/with-organization-id.util";
import { PrismaService } from "../../prisma/prisma.service";
import { ProductsService } from "../products/products.service";
import { StoresService } from "../stores/stores.service";
import { BranchStatementQueryDto } from "./dto/branch-statement-query.dto";
import { CreateBranchReturnDto } from "./dto/create-branch-return.dto";
import {
  BranchDetailsDto,
  CreateCreditBranchDto,
} from "./dto/create-credit-branch.dto";
import { UpdateCreditBranchDto } from "./dto/update-credit-branch.dto";
import { CreditStockDto } from "./dto/credit-stock.dto";

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "cash",
  evc: "EVC Plus",
  edahab: "eDahab",
  bank: "bank transfer",
};

const branchCreditInclude = {
  items: {
    include: {
      product: true,
      returns: { select: { quantity: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.BranchCreditInclude;

@Injectable()
export class CreditBranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly storesService: StoresService,
  ) {}

  /** Credit branches only exist in organizations without standard branches. */
  private async assertOrgHasNoStores(organizationId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { hasStores: true },
    });
    if (!org) {
      throw new ForbiddenException("Organization not found");
    }
    if (org.hasStores) {
      throw new BadRequestException(
        "Credit branches are only available for organizations without branches",
      );
    }
  }

  private async findCreditStore(id: string, organizationId: string) {
    const store = await this.prisma.store.findFirst({
      where: { id, organizationId, type: StoreType.credit },
    });
    if (!store) {
      throw new NotFoundException(`Credit branch with id "${id}" not found`);
    }
    return store;
  }

  /** Branch managers may only reach their own branch; admins reach any. */
  private assertBranchAccess(storeId: string, user: CurrentUserPayload): void {
    if (user.role === UserRole.admin || user.role === UserRole.super_admin) {
      return;
    }
    if (user.role === UserRole.branch_manager && user.storeId === storeId) {
      return;
    }
    throw new ForbiddenException("You cannot access this branch");
  }

  async findAll(user: CurrentUserPayload) {
    const organizationId = requireOrganizationId(user);
    await this.assertOrgHasNoStores(organizationId);

    const stores = await this.prisma.store.findMany({
      where: { organizationId, type: StoreType.credit },
      orderBy: orderByUpdatedAtDesc,
    });

    const balances = await Promise.all(
      stores.map((store) => getBranchBalance(this.prisma, store.id)),
    );

    return stores.map((store, i) => ({ ...store, ...balances[i] }));
  }

  async findOne(id: string, user: CurrentUserPayload) {
    const organizationId = requireOrganizationId(user);
    const store = await this.findCreditStore(id, organizationId);
    this.assertBranchAccess(store.id, user);
    const balance = await getBranchBalance(this.prisma, store.id);
    return { ...store, ...balance };
  }

  /** Every credit this branch has ever received, each line with what's left to return. */
  async listCredits(id: string, user: CurrentUserPayload) {
    const organizationId = requireOrganizationId(user);
    const store = await this.findCreditStore(id, organizationId);
    this.assertBranchAccess(store.id, user);

    return this.prisma.branchCredit.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      include: branchCreditInclude,
    });
  }

  /** Create the branch (a Store). A branch manager login is added separately via Users. */
  async createBranch(dto: CreateCreditBranchDto, user: CurrentUserPayload) {
    const organizationId = requireOrganizationId(user);
    await this.assertOrgHasNoStores(organizationId);

    const existing = await this.prisma.store.findFirst({
      where: { organizationId, name: dto.name, isActive: true },
    });
    if (existing) {
      throw new BadRequestException(
        `A branch named "${dto.name}" already exists`,
      );
    }

    // The branch numbers its own invoices ("HARG-0001"): use the prefix the
    // admin gave, or make one from the name.
    const invoicePrefix = dto.invoicePrefix
      ? normalizeInvoicePrefix(dto.invoicePrefix)
      : await allocateUniquePrefix(
          this.prisma,
          organizationId,
          derivePrefixFromName(dto.name),
        );
    if (dto.invoicePrefix) {
      await assertPrefixAvailable(this.prisma, organizationId, invoicePrefix);
    }

    const store = await this.prisma.store.create({
      data: withOrganizationId(
        {
          name: dto.name,
          address: dto.address,
          type: StoreType.credit,
          invoicePrefix,
          ...this.detailsData(dto),
        },
        organizationId,
      ),
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId,
        action: AuditAction.BRANCH_CREATED,
        entityType: "store",
        entityId: store.id,
        oldValue: Prisma.JsonNull,
        newValue: store,
      },
    });

    return store;
  }

  /** Empty strings from a form mean "clear it". */
  private detailsData(dto: BranchDetailsDto) {
    const clean = (value?: string) =>
      value === undefined ? undefined : value.trim() || null;
    return {
      phone: clean(dto.phone),
      evcNumber: clean(dto.evcNumber),
      edahabNumber: clean(dto.edahabNumber),
      accountNumber: clean(dto.accountNumber),
    };
  }

  /** Edit a branch's details. Admins edit everything; the branch manager only the invoice details. */
  async updateBranch(
    id: string,
    dto: UpdateCreditBranchDto,
    user: CurrentUserPayload,
  ) {
    const organizationId = requireOrganizationId(user);
    const existing = await this.findCreditStore(id, organizationId);
    this.assertBranchAccess(existing.id, user);

    // A branch manager keeps their own contact and payment details up to date.
    // The name, address and invoice prefix stay with the admin.
    if (
      user.role === UserRole.branch_manager &&
      (dto.name !== undefined ||
        dto.address !== undefined ||
        dto.invoicePrefix !== undefined)
    ) {
      throw new ForbiddenException(
        "Only an admin can change the branch name, address or invoice prefix",
      );
    }

    if (dto.name && dto.name !== existing.name) {
      const clash = await this.prisma.store.findFirst({
        where: {
          organizationId,
          name: dto.name,
          isActive: true,
          id: { not: id },
        },
      });
      if (clash) {
        throw new BadRequestException(
          `A branch named "${dto.name}" already exists`,
        );
      }
    }

    // Changing the prefix after invoices went out would leave the branch with
    // two styles of invoice number, so it's only allowed before the first one.
    let invoicePrefix: string | undefined;
    if (dto.invoicePrefix !== undefined) {
      const wanted = normalizeInvoicePrefix(dto.invoicePrefix);
      if (wanted !== existing.invoicePrefix) {
        const issued = await this.prisma.invoice.count({
          where: { series: id },
        });
        if (issued > 0) {
          throw new BadRequestException(
            "The invoice prefix can't change once the branch has issued invoices",
          );
        }
        await assertPrefixAvailable(this.prisma, organizationId, wanted, id);
        invoicePrefix = wanted;
      }
    }

    const store = await this.prisma.store.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : undefined),
        ...(dto.address !== undefined ? { address: dto.address } : undefined),
        ...(invoicePrefix !== undefined ? { invoicePrefix } : undefined),
        ...this.detailsData(dto),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId,
        action: AuditAction.STORE_UPDATED,
        entityType: "store",
        entityId: id,
        oldValue: existing,
        newValue: store,
      },
    });

    return store;
  }

  /**
   * Moves stock from the warehouse into the branch and charges the branch
   * for it. Any amount paid now is recorded as an already-approved payment.
   * Everything happens in one transaction.
   */
  async creditStock(
    storeId: string,
    dto: CreditStockDto,
    user: CurrentUserPayload,
  ) {
    const organizationId = requireOrganizationId(user);
    await this.findCreditStore(storeId, organizationId);

    const productIds = dto.items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException("Each product can appear only once");
    }

    const lines = await Promise.all(
      dto.items.map(async (item) => {
        const product = await this.productsService.findOne(item.productId);
        return {
          product,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: Number(product.averageCost),
          lineTotal: toMoneyNumber(item.unitPrice * item.quantity),
        };
      }),
    );
    const total = toMoneyNumber(
      lines.reduce((sum, line) => sum + line.lineTotal, 0),
    );

    const paidAmount = toMoneyNumber(dto.paidAmount ?? 0);
    if (paidAmount < 0) {
      throw new BadRequestException("paidAmount cannot be negative");
    }
    if (paidAmount > total + 0.001) {
      throw new BadRequestException(
        `Amount paid cannot exceed the credit total (${total.toFixed(2)})`,
      );
    }
    if (paidAmount > 0 && !dto.paidMethod) {
      throw new BadRequestException(
        "paidMethod is required when recording a payment",
      );
    }

    const warehouse =
      await this.storesService.ensureOrgWarehouse(organizationId);

    const creditId = await this.prisma.$transaction(async (tx) => {
      const credit = await tx.branchCredit.create({
        data: withOrganizationId(
          { storeId, total, note: dto.note, createdById: user.id },
          organizationId,
        ),
      });

      for (const line of lines) {
        const warehouseStock = await lockInventoryForMutation(
          tx,
          organizationId,
          line.product.id,
          warehouse.id,
        );
        if (!warehouseStock || warehouseStock.quantity < line.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${line.product.name}": ${
              warehouseStock?.quantity ?? 0
            } available, ${line.quantity} requested`,
          );
        }

        await tx.branchCreditItem.create({
          data: withOrganizationId(
            {
              branchCreditId: credit.id,
              productId: line.product.id,
              storeId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              unitCost: line.unitCost,
              lineTotal: line.lineTotal,
            },
            organizationId,
          ),
        });

        await tx.inventory.update({
          where: {
            productId_storeId: {
              productId: line.product.id,
              storeId: warehouse.id,
            },
          },
          data: { quantity: warehouseStock.quantity - line.quantity },
        });

        const branchStock = await lockInventoryForMutation(
          tx,
          organizationId,
          line.product.id,
          storeId,
        );
        if (branchStock) {
          await tx.inventory.update({
            where: { id: branchStock.id },
            data: { quantity: branchStock.quantity + line.quantity },
          });
        } else {
          await tx.inventory.create({
            data: withOrganizationId(
              { productId: line.product.id, storeId, quantity: line.quantity },
              organizationId,
            ),
          });
        }

        await tx.auditLog.create({
          data: {
            userId: user.id,
            organizationId,
            action: AuditAction.INVENTORY_UPDATED,
            entityType: "inventory",
            entityId: branchStock?.id ?? line.product.id,
            oldValue: {
              quantity: branchStock?.quantity ?? 0,
              storeId,
              productId: line.product.id,
            },
            newValue: {
              quantity: (branchStock?.quantity ?? 0) + line.quantity,
              storeId,
              productId: line.product.id,
              reason: "branch_credit",
            },
          },
        });
      }

      if (paidAmount > 0) {
        await tx.branchPayment.create({
          data: withOrganizationId(
            {
              storeId,
              branchCreditId: credit.id,
              amount: paidAmount,
              paidAt: new Date(),
              method: dto.paidMethod!,
              reference: dto.paidReference,
              status: "approved",
              submittedById: user.id,
              reviewedById: user.id,
              reviewedAt: new Date(),
            },
            organizationId,
          ),
        });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          organizationId,
          action: AuditAction.BRANCH_CREDIT_CREATED,
          entityType: "branch_credit",
          entityId: credit.id,
          oldValue: Prisma.JsonNull,
          newValue: {
            storeId,
            total,
            paidAmount,
            items: lines.map((l) => ({
              productId: l.product.id,
              productName: l.product.name,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
            })),
          },
        },
      });

      return credit.id;
    }, MUTATION_TRANSACTION_OPTIONS);

    return this.prisma.branchCredit.findUniqueOrThrow({
      where: { id: creditId },
      include: branchCreditInclude,
    });
  }

  /**
   * Returns items from a specific credit line back to the warehouse and
   * credits the branch's balance at that line's price.
   */
  async createReturn(
    storeId: string,
    dto: CreateBranchReturnDto,
    user: CurrentUserPayload,
  ) {
    const organizationId = requireOrganizationId(user);
    await this.findCreditStore(storeId, organizationId);

    const item = await this.prisma.branchCreditItem.findFirst({
      where: { id: dto.branchCreditItemId, storeId, organizationId },
      include: { returns: true, product: true },
    });
    if (!item) {
      throw new NotFoundException(
        `Credit line "${dto.branchCreditItemId}" not found on this branch`,
      );
    }

    const alreadyReturned = item.returns.reduce(
      (sum, r) => sum + r.quantity,
      0,
    );
    const remaining = item.quantity - alreadyReturned;
    if (dto.quantity > remaining) {
      throw new BadRequestException(
        `Only ${remaining} unit(s) of "${item.product.name}" from this credit remain to be returned`,
      );
    }

    const amount = toMoneyNumber(Number(item.unitPrice) * dto.quantity);
    const warehouse =
      await this.storesService.ensureOrgWarehouse(organizationId);

    const returnId = await this.prisma.$transaction(async (tx) => {
      const branchStock = await lockInventoryForMutation(
        tx,
        organizationId,
        item.productId,
        storeId,
      );
      if (!branchStock || branchStock.quantity < dto.quantity) {
        throw new BadRequestException(
          `Only ${branchStock?.quantity ?? 0} unit(s) of "${item.product.name}" are in the branch's stock`,
        );
      }

      await tx.inventory.update({
        where: { id: branchStock.id },
        data: { quantity: branchStock.quantity - dto.quantity },
      });

      const warehouseStock = await lockInventoryForMutation(
        tx,
        organizationId,
        item.productId,
        warehouse.id,
      );
      if (warehouseStock) {
        await tx.inventory.update({
          where: { id: warehouseStock.id },
          data: { quantity: warehouseStock.quantity + dto.quantity },
        });
      } else {
        await tx.inventory.create({
          data: withOrganizationId(
            {
              productId: item.productId,
              storeId: warehouse.id,
              quantity: dto.quantity,
            },
            organizationId,
          ),
        });
      }

      const branchReturn = await tx.branchReturn.create({
        data: withOrganizationId(
          {
            storeId,
            branchCreditItemId: item.id,
            quantity: dto.quantity,
            amount,
            reason: dto.reason,
            createdById: user.id,
          },
          organizationId,
        ),
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          organizationId,
          action: AuditAction.BRANCH_RETURN_CREATED,
          entityType: "branch_return",
          entityId: branchReturn.id,
          oldValue: Prisma.JsonNull,
          newValue: {
            storeId,
            productId: item.productId,
            productName: item.product.name,
            quantity: dto.quantity,
            amount,
            reason: dto.reason,
          },
        },
      });

      return branchReturn.id;
    }, MUTATION_TRANSACTION_OPTIONS);

    return this.prisma.branchReturn.findUniqueOrThrow({
      where: { id: returnId },
    });
  }

  /**
   * Ledger: credits add, returns and approved payments subtract. The running
   * balance is worked out over the whole history in date order, then the
   * requested page is cut out, so a page's balances are always correct
   * whichever way it is ordered.
   */
  async getStatement(
    id: string,
    query: BranchStatementQueryDto,
    user: CurrentUserPayload,
  ) {
    const organizationId = requireOrganizationId(user);
    const store = await this.findCreditStore(id, organizationId);
    this.assertBranchAccess(store.id, user);

    const [credits, returns, payments] = await Promise.all([
      this.prisma.branchCredit.findMany({
        where: { storeId: store.id },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.branchReturn.findMany({
        where: { storeId: store.id },
        include: { branchCreditItem: { include: { product: true } } },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.branchPayment.findMany({
        where: { storeId: store.id, status: "approved" },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    type LedgerEvent = {
      date: string;
      sort: number;
      /** Tie-break when two entries share a timestamp (a credit and the payment taken with it). */
      rank: number;
      kind: "credit" | "return" | "payment";
      description: string;
      charge: number | null;
      credit: number | null;
    };

    const events: LedgerEvent[] = [
      ...credits.map(
        (c): LedgerEvent => ({
          date: c.createdAt.toISOString(),
          sort: c.createdAt.getTime(),
          rank: 0,
          kind: "credit",
          description: c.note ? `Stock credited — ${c.note}` : "Stock credited",
          charge: toMoneyNumber(c.total),
          credit: null,
        }),
      ),
      ...returns.map(
        (r): LedgerEvent => ({
          date: r.createdAt.toISOString(),
          sort: r.createdAt.getTime(),
          rank: 1,
          kind: "return",
          description: `Returned ${r.quantity} × ${r.branchCreditItem.product.name} — ${r.reason}`,
          charge: null,
          credit: toMoneyNumber(r.amount),
        }),
      ),
      ...payments.map(
        (p): LedgerEvent => ({
          date: p.createdAt.toISOString(),
          sort: p.createdAt.getTime(),
          rank: 2,
          kind: "payment",
          description: `Paid by ${PAYMENT_METHOD_LABEL[p.method]}${p.reference ? ` · ref ${p.reference}` : ""}`,
          charge: null,
          credit: toMoneyNumber(p.amount),
        }),
      ),
    ].sort((a, b) => a.sort - b.sort || a.rank - b.rank);

    let running = 0;
    const chronological = events.map((e) => {
      running = toMoneyNumber(running + (e.charge ?? 0) - (e.credit ?? 0));
      return {
        date: e.date,
        kind: e.kind,
        description: e.description,
        charge: e.charge,
        credit: e.credit,
        balance: running,
      };
    });

    const ordered =
      query.order === "oldest" ? chronological : chronological.reverse();
    const { page, limit } = query;
    const total = ordered.length;

    return {
      rows: ordered.slice((page - 1) * limit, page * limit),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      balance: await getBranchBalance(this.prisma, store.id),
    };
  }
}
