import { Controller, Get, NotFoundException, Req, Res } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { Request, Response } from "express";
import { DomainPolicyService } from "../../common/tenant/domain-policy.service";
import { OrganizationLogoService } from "../../common/storage/organization-logo.service";

/**
 * What the sign-in page needs before anyone is signed in: the name and logo of
 * the organization that uses this domain. Shown only when exactly one active
 * organization is assigned to the domain; otherwise the page stays generic.
 */
@Controller("public/tenant")
export class PublicTenantController {
  constructor(
    private readonly domainPolicy: DomainPolicyService,
    private readonly organizationLogo: OrganizationLogoService,
  ) {}

  @AllowAnonymous()
  @Get()
  async get(@Req() req: Request) {
    const tenant = await this.domainPolicy.tenantForHost(req.headers.host);
    return {
      name: tenant?.name ?? null,
      hasLogo: tenant?.hasLogo ?? false,
    };
  }

  @AllowAnonymous()
  @Get("logo")
  async logo(@Req() req: Request, @Res() res: Response) {
    const tenant = await this.domainPolicy.tenantForHost(req.headers.host);
    const logo = tenant?.organizationId
      ? await this.organizationLogo.getLogoBytesByOrganizationId(
          tenant.organizationId,
        )
      : null;
    if (!logo) {
      throw new NotFoundException("No logo");
    }
    res.setHeader("Content-Type", logo.contentType);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(logo.buffer);
  }
}
