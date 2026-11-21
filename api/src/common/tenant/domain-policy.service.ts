import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { normalizeHost } from "../utils/host.util";
import { PrismaService } from "../../prisma/prisma.service";

export interface DomainSubject {
  role?: string | null;
  organizationId?: string | null;
}

export interface PublicTenant {
  name: string | null;
  hasLogo: boolean;
}

const CACHE_TTL_MS = 30_000;

/**
 * Keeps each organization on its own domain.
 *
 * - An organization's users may only use the host assigned to it.
 * - The platform super admin may only use the hosts in PLATFORM_ADMIN_HOST
 *   (one or several, comma-separated).
 * - An organization with no domain is blocked.
 *
 * Switched on with ENFORCE_ORG_DOMAINS=true so it can be rolled out after the
 * domains have been filled in.
 */
@Injectable()
export class DomainPolicyService {
  private readonly cache = new Map<
    string,
    { domain: string | null; at: number }
  >();

  constructor(private readonly prisma: PrismaService) {}

  isEnforced(): boolean {
    return process.env.ENFORCE_ORG_DOMAINS === "true";
  }

  /** Hosts the platform super admin may use (PLATFORM_ADMIN_HOST, comma-separated for several). */
  platformHosts(): string[] {
    return (process.env.PLATFORM_ADMIN_HOST ?? "")
      .split(",")
      .map((host) => normalizeHost(host))
      .filter(Boolean);
  }

  /** Call after changing an organization's domain so the change applies at once. */
  forget(organizationId?: string): void {
    if (organizationId) this.cache.delete(organizationId);
    else this.cache.clear();
  }

  private async domainOf(organizationId: string): Promise<string | null> {
    const hit = this.cache.get(organizationId);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.domain;

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { domain: true },
    });
    const domain = org?.domain ? normalizeHost(org.domain) : null;
    this.cache.set(organizationId, { domain, at: Date.now() });
    return domain;
  }

  /** Whether this person may use the app on this host. */
  async isAllowed(
    host: string | null | undefined,
    subject: DomainSubject,
  ): Promise<boolean> {
    if (!this.isEnforced()) return true;

    const requested = normalizeHost(host);
    if (!requested) return false;

    if (subject.role === UserRole.super_admin) {
      return this.platformHosts().includes(requested);
    }

    if (!subject.organizationId) return false;
    const domain = await this.domainOf(subject.organizationId);
    return domain !== null && domain === requested;
  }

  /**
   * What the login page may show for this host: the organization's name and
   * logo when exactly one active organization uses it, otherwise nothing.
   */
  async tenantForHost(
    host: string | null | undefined,
  ): Promise<(PublicTenant & { organizationId: string | null }) | null> {
    const requested = normalizeHost(host);
    if (!requested) return null;

    const orgs = await this.prisma.organization.findMany({
      where: { domain: requested, isActive: true },
      select: { id: true, name: true, logoKey: true },
      take: 2,
    });
    if (orgs.length === 0 && this.platformHosts().includes(requested)) {
      return { name: "Platform admin", hasLogo: false, organizationId: null };
    }
    if (orgs.length !== 1) return null;
    return {
      name: orgs[0].name,
      hasLogo: Boolean(orgs[0].logoKey),
      organizationId: orgs[0].id,
    };
  }
}
