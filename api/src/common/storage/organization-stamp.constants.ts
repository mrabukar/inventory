export const ORGANIZATION_STAMP_MAX_BYTES = 3 * 1024 * 1024;
export const ORGANIZATION_STAMP_MAX_WIDTH = 800;
export const ORGANIZATION_STAMP_MAX_HEIGHT = 800;
export const ORGANIZATION_STAMP_MIN_WIDTH = 80;
export const ORGANIZATION_STAMP_MIN_HEIGHT = 80;

export const ORGANIZATION_STAMP_PREFIX = "org-stamps";

export function organizationStampObjectKey(
  organizationId: string,
  extension: "jpg" | "png",
): string {
  return `${ORGANIZATION_STAMP_PREFIX}/${organizationId}/stamp.${extension}`;
}
