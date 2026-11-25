/**
 * Walks every route in the API and checks the limited-user rules from the
 * metadata alone: a limited user can only ever read, only through a page mark,
 * and every page an admin can grant opens something.
 */
import "reflect-metadata";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { UserRole } from "@prisma/client";
import { ROLES_KEY } from "../decorators/roles.decorator";
import {
  LIMITED_SELF_KEY,
  PAGES_KEY,
} from "../decorators/page-access.decorator";
import { ANY_PAGE, LIMITED_PAGE_KEYS, pagesAvailableTo } from "./limited-pages";

// Libraries that are ESM-only or not needed to read route metadata.
jest.mock("better-auth/crypto", () => ({ hashPassword: jest.fn() }));
jest.mock("better-auth/node", () => ({ fromNodeHeaders: jest.fn() }));
jest.mock("@thallesp/nestjs-better-auth", () => ({
  AllowAnonymous: () => () => undefined,
  Session: () => () => undefined,
  AuthService: class {},
}));

const GET = 0;
const HEAD = 6;
const METHOD_NAMES: Record<number, string> = {
  0: "GET",
  1: "POST",
  2: "PUT",
  3: "DELETE",
  4: "PATCH",
  5: "ALL",
  6: "HEAD",
  7: "OPTIONS",
};

interface Route {
  name: string;
  method: string;
  roles: string[] | undefined;
  pages: string[] | undefined;
  self: boolean;
}

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return controllerFiles(full);
    return full.endsWith(".controller.ts") ? [full] : [];
  });
}

function collectRoutes(): Route[] {
  const routes: Route[] = [];
  for (const file of controllerFiles(join(__dirname, "../../modules"))) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const exported = require(file) as Record<string, unknown>;
    for (const [className, cls] of Object.entries(exported)) {
      if (typeof cls !== "function" || !className.endsWith("Controller")) {
        continue;
      }
      const proto = (cls as { prototype: Record<string, unknown> }).prototype;
      for (const key of Object.getOwnPropertyNames(proto)) {
        const handler = proto[key];
        if (typeof handler !== "function" || key === "constructor") continue;
        const method = Reflect.getMetadata("method", handler) as
          | number
          | undefined;
        if (method === undefined) continue;
        const read = <T>(metaKey: string) =>
          (Reflect.getMetadata(metaKey, handler) ??
            Reflect.getMetadata(metaKey, cls)) as T | undefined;
        routes.push({
          name: `${className}.${key}`,
          method: METHOD_NAMES[method] ?? String(method),
          roles: read<string[]>(ROLES_KEY),
          pages: read<string[]>(PAGES_KEY),
          self: Boolean(read<boolean>(LIMITED_SELF_KEY)),
        });
      }
    }
  }
  return routes;
}

describe("limited users and the route marks", () => {
  const routes = collectRoutes();

  it("finds the API's routes", () => {
    expect(routes.length).toBeGreaterThan(80);
  });

  it("never opens a route that changes data to a limited user", () => {
    const offenders = routes
      .filter((r) => r.method !== "GET" && r.method !== "HEAD")
      .filter(
        (r) =>
          r.roles?.includes(UserRole.limited_user) ||
          r.pages !== undefined ||
          (r.self && r.method !== "PATCH"),
      )
      .map((r) => `${r.method} ${r.name}`);
    expect(offenders).toEqual([]);
  });

  it("lets a limited user through a role gate only on a marked read route", () => {
    const offenders = routes
      .filter((r) => r.roles?.includes(UserRole.limited_user))
      .filter((r) => r.pages === undefined)
      .map((r) => `${r.method} ${r.name}`);
    expect(offenders).toEqual([]);
  });

  it("uses only real page keys in the marks", () => {
    const valid = new Set<string>([...LIMITED_PAGE_KEYS, ANY_PAGE]);
    const bad = routes.flatMap((r) =>
      (r.pages ?? [])
        .filter((p) => !valid.has(p))
        .map((p) => `${r.name}: ${p}`),
    );
    expect(bad).toEqual([]);
  });

  it("opens something for every page an admin can grant", () => {
    const marked = new Set(routes.flatMap((r) => r.pages ?? []));
    const dead = LIMITED_PAGE_KEYS.filter((page) => !marked.has(page));
    expect(dead).toEqual([]);
  });

  it("keeps the limited user's reach to read routes only", () => {
    const reachable = routes.filter((r) => r.pages !== undefined || r.self);
    expect(
      reachable.every(
        (r) =>
          r.method === "GET" ||
          r.method === "HEAD" ||
          (r.self && r.method === "PATCH"),
      ),
    ).toBe(true);
    expect(GET).toBe(0);
    expect(HEAD).toBe(6);
  });

  it("never offers the pages that don't exist for an organization", () => {
    expect(
      pagesAvailableTo({ hasStores: true, usesCreditBranches: false }),
    ).toEqual([]);
    const direct = pagesAvailableTo({
      hasStores: false,
      usesCreditBranches: false,
    });
    expect(direct).not.toContain("credit-branches");
    expect(direct).not.toContain("branch-payments");
    expect(direct).not.toContain("sale-approvals");
    const credit = pagesAvailableTo({
      hasStores: false,
      usesCreditBranches: true,
    });
    expect(credit).toEqual(
      expect.arrayContaining([
        "credit-branches",
        "branch-payments",
        "sale-approvals",
      ]),
    );
  });

  it("keeps submitting sales and organization settings out of the pages", () => {
    const keys = LIMITED_PAGE_KEYS as readonly string[];
    expect(keys).not.toContain("submit-sale");
    expect(keys).not.toContain("settings");
  });
});
