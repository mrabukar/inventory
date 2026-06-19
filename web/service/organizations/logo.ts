import type { Organization } from "@/types/organizations/organization";
import { apiDelete, apiUpload } from "@/service/upload";

export function uploadOrganizationLogo(organizationId: string, file: File) {
  const formData = new FormData();
  formData.append("logo", file);
  return apiUpload<Organization>(
    `/api/organizations/${organizationId}/logo`,
    formData,
  );
}

export function deleteOrganizationLogo(organizationId: string) {
  return apiDelete<Organization>(`/api/organizations/${organizationId}/logo`);
}

export function uploadCurrentOrganizationLogo(file: File) {
  const formData = new FormData();
  formData.append("logo", file);
  return apiUpload<Organization>("/api/organization/logo", formData);
}

export function deleteCurrentOrganizationLogo() {
  return apiDelete<Organization>("/api/organization/logo");
}
