import { authClient } from "@/lib/auth/client";
import type { CreateUserInput, User } from "@/types/users/user";
import { manageUserTwoFactor } from "./manage-two-factor";
import { updateUser } from "./update-user";

export async function createUser(
  input: CreateUserInput,
  organizationId?: string | null,
): Promise<User> {
  const result = await authClient.signUp.email({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    name: input.name.trim(),
    role: input.role,
    ...(organizationId ? { organizationId } : {}),
    ...(input.role === "branch_manager" && input.storeId
      ? { storeId: input.storeId }
      : {}),
  } as Parameters<typeof authClient.signUp.email>[0]);

  if (result.error) {
    throw new Error(result.error.message ?? "Failed to create user");
  }

  const userId = result.data?.user?.id;
  if (!userId) {
    throw new Error("User was created but no user id was returned");
  }

  // A limited user starts with no pages; the admin gives them theirs next.
  if (input.role === "limited_user") {
    await updateUser(userId, { allowedPages: input.allowedPages ?? [] });
  }

  if (input.twoFactorRequired === false) {
    await manageUserTwoFactor(userId, "disable");
  }

  if (input.phone?.trim()) {
    return updateUser(userId, { phone: input.phone.trim() });
  }

  return {
    id: userId,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    phone: input.phone?.trim() || null,
    isActive: true,
    storeId: input.role === "branch_manager" ? (input.storeId ?? null) : null,
    store: null,
    allowedPages: input.role === "limited_user" ? (input.allowedPages ?? []) : [],
    twoFactorEnabled: false,
    twoFactorRequired: input.twoFactorRequired !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
