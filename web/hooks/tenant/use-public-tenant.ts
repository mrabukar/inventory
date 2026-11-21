"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/api-base-url";

export interface PublicTenant {
  name: string | null;
  hasLogo: boolean;
}

/** The organization that uses this domain, for the sign-in page. Nothing is shown if it can't be found. */
export function usePublicTenant() {
  return useQuery({
    queryKey: ["public-tenant"],
    queryFn: async (): Promise<PublicTenant> => {
      const res = await fetch(`${getApiBaseUrl()}/api/public/tenant`);
      if (!res.ok) return { name: null, hasLogo: false };
      return (await res.json()) as PublicTenant;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function publicTenantLogoUrl(): string {
  return `${getApiBaseUrl()}/api/public/tenant/logo`;
}
