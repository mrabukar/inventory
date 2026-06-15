/** Must match api/src/modules/auth/auth.constants.ts */
export const SESSION_COOKIE_NAME = "better-auth.session_token";

/** Better-Auth prepends this in production when useSecureCookies is enabled. */
export const SECURE_SESSION_COOKIE_NAME =
  `__Secure-${SESSION_COOKIE_NAME}` as const;

export const SESSION_COOKIE_NAMES = [
  SESSION_COOKIE_NAME,
  SECURE_SESSION_COOKIE_NAME,
] as const;
