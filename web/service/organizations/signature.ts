import type { Organization } from "@/types/organizations/organization";
import { apiDelete, apiUpload } from "@/service/upload";

export function uploadCurrentOrganizationSignature(file: File) {
  const formData = new FormData();
  formData.append("signature", file);
  return apiUpload<Organization>("/api/organization/signature", formData);
}

export function deleteCurrentOrganizationSignature() {
  return apiDelete<Organization>("/api/organization/signature");
}
