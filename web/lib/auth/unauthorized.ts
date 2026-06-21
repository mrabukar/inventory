import { buildLoginUrl } from "@/lib/auth/redirect";

type UnauthorizedHandler = () => void;

let handler: UnauthorizedHandler | null = null;
let redirecting = false;

function isLoginRoute(): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  return path === "/login" || path.startsWith("/login/");
}

export function registerUnauthorizedHandler(fn: UnauthorizedHandler): () => void {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
}

/** Clear session state and send the user to login when an API call returns 401. */
export function notifyUnauthorized(): void {
  if (redirecting || isLoginRoute()) return;
  redirecting = true;

  if (handler) {
    handler();
    return;
  }

  if (typeof window !== "undefined") {
    const returnPath = `${window.location.pathname}${window.location.search}`;
    window.location.replace(buildLoginUrl(returnPath));
  }
}
