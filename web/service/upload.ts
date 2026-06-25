import { getApiBaseUrl } from "@/lib/api-base-url";
import { throwIfNotOk } from "@/service/client";

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "DELETE",
    credentials: "include",
  });

  await throwIfNotOk(res);

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  init?: Omit<RequestInit, "body">,
): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    method: init?.method ?? "POST",
    credentials: "include",
    body: formData,
  });

  await throwIfNotOk(res);

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export function organizationLogoUrl(
  scope: "current" | "organization",
  organizationId?: string,
  logoUpdatedAt?: string | null,
): string | null {
  const apiBase = getApiBaseUrl();
  const base =
    scope === "current"
      ? `${apiBase}/api/organization/logo`
      : organizationId
        ? `${apiBase}/api/organizations/${organizationId}/logo`
        : null;

  if (!base) return null;
  if (!logoUpdatedAt) return base;
  return `${base}?v=${encodeURIComponent(logoUpdatedAt)}`;
}

export async function fetchOrganizationLogoBlob(
  scope: "current" | "organization",
  organizationId?: string,
  logoUpdatedAt?: string | null,
): Promise<string | null> {
  const url = organizationLogoUrl(scope, organizationId, logoUpdatedAt);
  if (!url) return null;

  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    return null;
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
