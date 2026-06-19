export const ORGANIZATION_LOGO_MAX_BYTES = 3 * 1024 * 1024;
export const ORGANIZATION_LOGO_MAX_WIDTH = 1200;
export const ORGANIZATION_LOGO_MAX_HEIGHT = 400;
export const ORGANIZATION_LOGO_MIN_WIDTH = 200;
export const ORGANIZATION_LOGO_MIN_HEIGHT = 80;

export const ORGANIZATION_LOGO_PREFIX = "org-logos";

export function organizationLogoObjectKey(
  organizationId: string,
  extension: "jpg" | "png",
): string {
  return `${ORGANIZATION_LOGO_PREFIX}/${organizationId}/logo.${extension}`;
}
