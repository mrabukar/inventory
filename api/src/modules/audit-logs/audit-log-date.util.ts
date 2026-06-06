/** Parse audit log range start (date-only → start of UTC day). */
export function parseAuditRangeStart(value: string): Date {
  const trimmed = value.trim();
  if (trimmed.includes("T") || trimmed.includes(" ")) {
    return new Date(trimmed.replace(" ", "T"));
  }
  return new Date(`${trimmed}T00:00:00.000Z`);
}

/** Parse audit log range end (date-only → end of UTC day). */
export function parseAuditRangeEnd(value: string): Date {
  const trimmed = value.trim();
  if (trimmed.includes("T") || trimmed.includes(" ")) {
    return new Date(trimmed.replace(" ", "T"));
  }
  return new Date(`${trimmed}T23:59:59.999Z`);
}
