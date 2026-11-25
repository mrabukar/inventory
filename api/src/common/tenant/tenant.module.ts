import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { PageAccessInterceptor } from "../access/page-access.interceptor";
import { DomainPolicyService } from "./domain-policy.service";
import { TenantContextService } from "./tenant-context.service";
import { TenantInterceptor } from "./tenant.interceptor";

@Global()
@Module({
  providers: [
    TenantContextService,
    DomainPolicyService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    // After sign-in, a limited user may only read the pages they were given.
    {
      provide: APP_INTERCEPTOR,
      useClass: PageAccessInterceptor,
    },
  ],
  exports: [TenantContextService, DomainPolicyService],
})
export class TenantModule {}
