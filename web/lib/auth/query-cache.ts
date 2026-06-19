import type { QueryClient } from "@tanstack/react-query";
import { SESSION_QUERY_KEY } from "@/hooks/auth/session";

function isSessionQueryKey(queryKey: readonly unknown[]): boolean {
  return queryKey.length === 1 && queryKey[0] === SESSION_QUERY_KEY[0];
}

/** Remove tenant API cache but keep the session query observer state intact. */
export function clearTenantQueries(queryClient: QueryClient) {
  void queryClient.cancelQueries({
    predicate: (query) => !isSessionQueryKey(query.queryKey),
  });
  queryClient.removeQueries({
    predicate: (query) => !isSessionQueryKey(query.queryKey),
  });
}

/** Clear tenant data and mark the session as logged out. */
export function clearClientSession(queryClient: QueryClient) {
  clearTenantQueries(queryClient);
  queryClient.setQueryData(SESSION_QUERY_KEY, null);
}
