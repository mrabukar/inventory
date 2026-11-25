import { apiFetch } from "@/service/client";
import type {
  BranchCredit,
  BranchStatement,
  BranchStatementQuery,
  CreateBranchReturnInput,
  CreateCreditBranchInput,
  CreditBranch,
  CreditedStockQuery,
  CreditedStockResponse,
  CreditStockInput,
  UpdateCreditBranchInput,
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

export function updateCreditBranch(
  id: string,
  input: UpdateCreditBranchInput,
): Promise<CreditBranch> {
  return apiFetch<CreditBranch>(`/api/credit-branches/${id}`, {
    method: "PATCH",
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

export function listCreditedStock(
  params: CreditedStockQuery = {},
): Promise<CreditedStockResponse> {
  const search = new URLSearchParams();
  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.storeId) search.set("storeId", params.storeId);
  if (params.search) search.set("search", params.search);
  if (params.categoryId) search.set("categoryId", params.categoryId);
  if (params.fromDate) search.set("fromDate", params.fromDate);
  if (params.toDate) search.set("toDate", params.toDate);
  const qs = search.toString();
  return apiFetch<CreditedStockResponse>(
    `/api/credit-branches/stock-credits${qs ? `?${qs}` : ""}`,
  );
}
