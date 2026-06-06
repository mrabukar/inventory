/** Trim, lowercase, and strip whitespace, hyphens, and underscores for duplicate detection. */
export function normalizeProductName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, "");
}
