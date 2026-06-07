/** Whether sign-up is open without an admin session (bootstrap / first admin). */
export function isBootstrapSignupAllowed(): boolean {
  if (process.env.ALLOW_SIGNUP === "true") return true;
  if (process.env.ALLOW_SIGNUP === "false") return false;
  return (process.env.NODE_ENV ?? "development") !== "production";
}
