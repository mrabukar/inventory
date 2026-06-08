export const FROM_PARAM = "from";

const DEFAULT_REDIRECT = "/dashboard";

/** Allow only same-app relative paths to prevent open redirects. */
export function sanitizeReturnUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.startsWith("/") || url.startsWith("//")) return null;
  if (url === "/login" || url.startsWith("/login?") || url.startsWith("/login/")) {
    return null;
  }
  return url;
}

export function buildLoginUrl(returnPath: string): string {
  const safe = sanitizeReturnUrl(returnPath);
  if (!safe) return "/login";
  return `/login?${FROM_PARAM}=${encodeURIComponent(safe)}`;
}

export function getPostLoginRedirect(
  searchParams: Pick<URLSearchParams, "get">,
): string {
  return sanitizeReturnUrl(searchParams.get(FROM_PARAM)) ?? DEFAULT_REDIRECT;
}
