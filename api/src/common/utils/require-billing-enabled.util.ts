import { ForbiddenException } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";

/**
 * Enforce that the organization has billing enabled. The backend is the gate
 * for every invoice / payment / balance / sale-location endpoint — never rely
 * on the frontend hiding the UI. Gate on `billingEnabled`, not `hasStores`.
 */
export async function assertBillingEnabled(
  prisma: PrismaService,
  organizationId: string,
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { billingEnabled: true },
  });

  if (!org?.billingEnabled) {
    throw new ForbiddenException(
      "Billing features are not enabled for this organization",
    );
  }
}
