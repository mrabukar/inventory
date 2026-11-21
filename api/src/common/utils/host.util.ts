/** Lower-cases a host and drops any port, so "FoneX.example.com:443" → "fonex.example.com". */
export function normalizeHost(value: string | null | undefined): string {
  if (!value) return "";
  const first = value.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.replace(/:\d+$/, "").replace(/\.$/, "");
}

/** A plain hostname: letters, numbers, dots and hyphens, with at least one dot. */
export function isValidHostname(value: string): boolean {
  return /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
    value,
  );
}
