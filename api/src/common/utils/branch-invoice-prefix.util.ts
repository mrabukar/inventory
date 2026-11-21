import { BadRequestException, ConflictException } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/** "INV" is the organization's own invoice list, so a branch can't use it. */
export const RESERVED_INVOICE_PREFIX = "INV";

export function normalizeInvoicePrefix(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** A readable default from the branch name: "Hargeisa Branch" → "HARG". */
export function derivePrefixFromName(name: string): string {
  const firstWord = name.trim().split(/\s+/)[0] ?? "";
  const base = normalizeInvoicePrefix(firstWord).slice(0, 4);
  return base.length >= 2 ? base : "BR";
}

export function assertValidInvoicePrefix(prefix: string): void {
  if (!/^[A-Z0-9]{2,6}$/.test(prefix)) {
    throw new BadRequestException(
      "Invoice prefix must be 2 to 6 letters or numbers",
    );
  }
  if (prefix === RESERVED_INVOICE_PREFIX) {
    throw new BadRequestException(
      `"${RESERVED_INVOICE_PREFIX}" is used by the organization's own invoices`,
    );
  }
}

async function prefixTaken(
  db: Db,
  organizationId: string,
  prefix: string,
  exceptStoreId?: string,
): Promise<boolean> {
  const existing = await db.store.findFirst({
    where: {
      organizationId,
      invoicePrefix: prefix,
      ...(exceptStoreId ? { id: { not: exceptStoreId } } : undefined),
    },
    select: { id: true },
  });
  return existing !== null;
}

/** A prefix the user asked for: refused if another branch already has it. */
export async function assertPrefixAvailable(
  db: Db,
  organizationId: string,
  prefix: string,
  exceptStoreId?: string,
): Promise<void> {
  assertValidInvoicePrefix(prefix);
  if (await prefixTaken(db, organizationId, prefix, exceptStoreId)) {
    throw new ConflictException(
      `Another branch already uses the invoice prefix "${prefix}"`,
    );
  }
}

/** A default prefix, nudged ("HARG", "HARG2", …) until no other branch has it. */
export async function allocateUniquePrefix(
  db: Db,
  organizationId: string,
  wanted: string,
  exceptStoreId?: string,
): Promise<string> {
  const base = normalizeInvoicePrefix(wanted).slice(0, 5) || "BR";
  let candidate = base.length >= 2 ? base : `${base}R`;
  for (let n = 2; n < 100; n += 1) {
    if (
      candidate !== RESERVED_INVOICE_PREFIX &&
      !(await prefixTaken(db, organizationId, candidate, exceptStoreId))
    ) {
      return candidate;
    }
    candidate = `${base}${n}`.slice(0, 6);
  }
  throw new ConflictException("Couldn't find a free invoice prefix");
}
