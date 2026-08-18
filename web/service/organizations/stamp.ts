import type { Organization } from "@/types/organizations/organization";
import { apiDelete, apiUpload } from "@/service/upload";

export function uploadCurrentOrganizationStamp(file: File) {
  const formData = new FormData();
  formData.append("stamp", file);
  return apiUpload<Organization>("/api/organization/stamp", formData);
}

export function deleteCurrentOrganizationStamp() {
  return apiDelete<Organization>("/api/organization/stamp");
}
