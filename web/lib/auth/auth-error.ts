type AuthClientError = {
  message?: string | null;
  statusText?: string | null;
  status?: number;
  code?: string;
};

export function getAuthClientErrorMessage(
  error: AuthClientError | undefined,
  fallback: string,
): string {
  const message = error?.message?.trim();
  if (message) return message;

  const statusText = error?.statusText?.trim();
  if (statusText) return statusText;

  if (error?.code === "INVALID_PASSWORD") {
    return "Current password is incorrect.";
  }

  return fallback;
}

export function isCurrentPasswordError(message: string): boolean {
  return /current password|incorrect password|invalid password|wrong password|password is incorrect/i.test(
    message,
  );
}
