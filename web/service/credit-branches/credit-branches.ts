import { apiFetch } from "@/service/client";
import type {
  BranchCredit,
  BranchStatement,
  BranchStatementQuery,
  CreateBranchReturnInput,
  CreateCreditBranchInput,
  CreditBranch,
  CreditStockInput,
} from "@/types/credit-branches/credit-branch";

export function listCreditBranches(): Promise<CreditBranch[]> {
  return apiFetch<CreditBranch[]>("/api/credit-branches");
}

export function getCreditBranch(id: string): Promise<CreditBranch> {
  return apiFetch<CreditBranch>(`/api/credit-branches/${id}`);
}

export function getBranchStatement(
  id: string,
  params: BranchStatementQuery = {},
): Promise<BranchStatement> {
  const search = new URLSearchParams();
  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.order) search.set("order", params.order);
  const qs = search.toString();
  return apiFetch<BranchStatement>(
    `/api/credit-branches/${id}/statement${qs ? `?${qs}` : ""}`,
  );
}

export function listBranchCredits(id: string): Promise<BranchCredit[]> {
  return apiFetch<BranchCredit[]>(`/api/credit-branches/${id}/credits`);
}

export function createCreditBranch(
  input: CreateCreditBranchInput,
): Promise<CreditBranch> {
  return apiFetch<CreditBranch>("/api/credit-branches", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function creditStock(
  id: string,
  input: CreditStockInput,
): Promise<BranchCredit> {
  return apiFetch<BranchCredit>(`/api/credit-branches/${id}/credits`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createBranchReturn(
  id: string,
  input: CreateBranchReturnInput,
) {
  return apiFetch(`/api/credit-branches/${id}/returns`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
