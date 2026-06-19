import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<string | null>();

  run<T>(organizationId: string | null, fn: () => T): T {
    return this.storage.run(organizationId, fn);
  }

  set(organizationId: string | null): void {
    this.storage.enterWith(organizationId);
  }

  get(): string | null | undefined {
    return this.storage.getStore();
  }
}
