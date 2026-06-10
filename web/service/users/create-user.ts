import { authClient } from "@/lib/auth/client";
import type { CreateUserInput, User } from "@/types/users/user";
import { updateUser } from "./update-user";

export async function createUser(input: CreateUserInput): Promise<User> {
  const result = await authClient.signUp.email({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    name: input.name.trim(),
    role: input.role,
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
