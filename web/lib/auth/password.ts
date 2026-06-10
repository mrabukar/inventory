export function isStrongPassword(password: string): boolean {
  return (
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export const STRONG_PASSWORD_MESSAGE =
  "Password must contain at least one uppercase letter, one number, and one special character";
