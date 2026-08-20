export const ORGANIZATION_SIGNATURE_MAX_BYTES = 3 * 1024 * 1024;
export const ORGANIZATION_SIGNATURE_MAX_WIDTH = 800;
export const ORGANIZATION_SIGNATURE_MAX_HEIGHT = 300;
export const ORGANIZATION_SIGNATURE_MIN_WIDTH = 100;
export const ORGANIZATION_SIGNATURE_MIN_HEIGHT = 40;

export const ORGANIZATION_SIGNATURE_PREFIX = "org-signatures";

export function organizationSignatureObjectKey(organizationId: string): string {
  return `${ORGANIZATION_SIGNATURE_PREFIX}/${organizationId}/signature.png`;
}
