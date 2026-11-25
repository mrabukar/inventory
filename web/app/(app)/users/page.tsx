"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { TwoFactorDialog } from "./components/two-factor-dialog";
import { UserModal, type UserFormValues } from "./components/user-modal";
import { UsersTable } from "./components/users-table";
import { BranchScopeSelect } from "@/components/filters/branch-scope-select";
import { usePeopleStoreFilter } from "@/hooks/branch-view/use-branch-view";
import { Combobox } from "@/components/ui/combobox";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useSession } from "@/hooks/auth/session";
import { useActivateUser } from "@/hooks/users/use-activate-user";
import { useCreateUser } from "@/hooks/users/use-create-user";
import { useDeactivateUser } from "@/hooks/users/use-deactivate-user";
import { useManageTwoFactor } from "@/hooks/users/use-manage-two-factor";
import { useUpdateUser } from "@/hooks/users/use-update-user";
import { useUsers } from "@/hooks/users/use-users";
import { useStores } from "@/hooks/stores/list-stores";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { listUsers } from "@/service/users/list-users";
import { useAppStore } from "@/store/app";
import {
  ROLE_ITEMS,
  type TwoFactorAction,
  type User,
  type UserRole,
} from "@/types/users/user";

const TWO_FACTOR_TOAST: Record<TwoFactorAction, string> = {
  disable: "Two-factor turned off",
  require: "Two-factor is now required",
  reset: "Authenticator reset",
};

interface ModalState {
  mode: "add" | "edit";
  user?: User;
}

const STATUS_ITEMS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
] as const;

export default function UsersPage() {
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const { user: sessionUser } = useSession();
  const router = useRouter();

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRole | undefined>();
  const [status, setStatus] = useState<boolean | undefined>();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [confirm, setConfirm] = useState<User | null>(null);
  const [twoFactorUser, setTwoFactorUser] = useState<User | null>(null);
  const [twoFactorPending, setTwoFactorPending] =
    useState<TwoFactorAction | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);
  // A credit organization looks at itself, one branch, or all branches.
  const peopleStoreId = usePeopleStoreFilter();

  const listQuery = useMemo(
    () => ({
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      role,
      isActive: status,
      storeId: peopleStoreId,
    }),
    [pageIndex, pageSize, debouncedSearch, role, status, peopleStoreId],
  );

  const hasStores = sessionUser?.hasStores ?? true;

  const { data: storesData } = useStores({ limit: 100 });
  const { data, isPending, isFetching, isError, error } = useUsers(listQuery);

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const activateUser = useActivateUser();
  const deactivateUser = useDeactivateUser();
  const manageTwoFactor = useManageTwoFactor();

  const rows = data?.data ?? [];
  const rowCount = data?.meta.total ?? 0;
  const isLoading =
    isPending || (isFetching && (data?.data.length ?? 0) === 0);

  const storeItems = useMemo(
    () =>
      (storesData?.data ?? []).map((store) => ({
        value: store.id,
        label: store.name,
      })),
    [storesData],
  );

  const roleFilterItems = useMemo(
    () => ROLE_ITEMS.map((item) => ({ value: item.value, label: item.label })),
    [],
  );

  const resetPage = () => setPageIndex(0);

  const handleExportAll = useCallback(async () => {
    const limit = 100;
    let page = 1;
    const exported: User[] = [];
    let totalPages = 1;

    do {
      const response = await listUsers({
        page,
        limit,
        search: debouncedSearch || undefined,
        role,
        isActive: status,
      });
      exported.push(...response.data);
      totalPages = response.meta.totalPages;
      page += 1;
    } while (page <= totalPages);

    return exported;
  }, [debouncedSearch, role, status]);

  const saveUser = async (form: UserFormValues) => {
    try {
      if (modal?.mode === "edit" && modal.user) {
        const input: Parameters<typeof updateUser.mutateAsync>[0]["input"] = {
          name: form.name,
          email: form.email,
          role: form.role,
          phone: form.phone || null,
        };

        if (form.password) input.password = form.password;

        if (form.role === "branch_manager") {
          input.storeId = form.storeId;
        } else {
          input.storeId = null;
        }

        await updateUser.mutateAsync({ id: modal.user.id, input });
        addToast({ title: "User updated" });
      } else {
        await createUser.mutateAsync({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          storeId:
            form.role === "branch_manager" ? form.storeId : undefined,
          phone: form.phone || undefined,
          twoFactorRequired: form.twoFactorRequired,
        });
        addToast({ title: "User added successfully" });
      }
      setModal(null);
    } catch (e) {
      addErrorToast({
        title: "Failed to save user",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  const handleDeactivate = async () => {
    if (!confirm) return;
    try {
      await deactivateUser.mutateAsync(confirm.id);
      addToast({ title: "User deactivated" });
      setConfirm(null);
    } catch (e) {
      addErrorToast({
        title: "Failed to deactivate user",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  const handleActivate = async (user: User) => {
    try {
      await activateUser.mutateAsync(user.id);
      addToast({ title: "User reactivated" });
    } catch (e) {
      addErrorToast({
        title: "Failed to reactivate user",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  };

  const handleTwoFactorAction = async (action: TwoFactorAction) => {
    if (!twoFactorUser) return;
    setTwoFactorPending(action);
    try {
      await manageTwoFactor.mutateAsync({ id: twoFactorUser.id, action });
      addToast({ title: TWO_FACTOR_TOAST[action], sub: twoFactorUser.name });
      setTwoFactorUser(null);
    } catch (e) {
      addErrorToast({
        title: "Couldn't change two-factor sign-in",
        sub: e instanceof Error ? e.message : "Something went wrong",
      });
    } finally {
      setTwoFactorPending(null);
    }
  };

  const isSaving = createUser.isPending || updateUser.isPending;

  const toolbarExtra = (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
      }}
    >
      <BranchScopeSelect />
      <Combobox
        value={role}
        onValueChange={(value) => {
          setRole(value as UserRole | undefined);
          resetPage();
        }}
        items={roleFilterItems}
        placeholder="All roles"
        searchPlaceholder="Search roles…"
        emptyText="No roles found."
      />
      <Combobox
        value={status === undefined ? undefined : String(status)}
        onValueChange={(value) => {
          setStatus(value === undefined ? undefined : value === "true");
          resetPage();
        }}
        items={[...STATUS_ITEMS]}
        placeholder="All status"
        searchPlaceholder="Search status…"
        emptyText="No status found."
      />
    </div>
  );

  return (
    <>
      <PageHeader
        title="Users"
        desc="Admins and branch managers"
        action={
          <Button onClick={() => setModal({ mode: "add" })}>
            <Plus className="size-4" />
            Add User
          </Button>
        }
      />

      {isError && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          {error instanceof Error ? error.message : "Failed to load users."}
        </div>
      )}

      <UsersTable
        rows={rows}
        rowCount={rowCount}
        pageIndex={pageIndex}
        pageSize={pageSize}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          resetPage();
        }}
        onPaginationChange={({ pageIndex: nextIndex, pageSize: nextSize }) => {
          setPageIndex(nextIndex);
          setPageSize(nextSize);
        }}
        isLoading={isLoading}
        onExportAll={handleExportAll}
        onEdit={(user) => setModal({ mode: "edit", user })}
        onDeactivate={(user) => {
          if (sessionUser?.id === user.id) {
            addErrorToast({
              title: "Cannot deactivate your own account",
              sub: "Ask another admin to deactivate this account.",
            });
            return;
          }
          setConfirm(user);
        }}
        onActivate={handleActivate}
        onManageTwoFactor={(user) => {
          // Your own 2FA needs your password and a code: manage it from Profile.
          if (sessionUser?.id === user.id) {
            router.push("/settings/profile");
            return;
          }
          setTwoFactorUser(user);
        }}
        toolbarExtra={toolbarExtra}
      />

      {modal && (
        <UserModal
          key={`${modal.mode}-${modal.user?.id ?? "new"}`}
          open
          mode={modal.mode}
          user={modal.user}
          storeItems={storeItems}
          showStoreField={hasStores || storeItems.length > 0}
          onClose={() => setModal(null)}
          onSave={(form) => void saveUser(form)}
          isSaving={isSaving}
          showTwoFactorField
        />
      )}

      {confirm && (
        <ConfirmDialog
          title="Deactivate user?"
          message={`Deactivate ${confirm.name}? They will no longer be able to sign in.`}
          confirmLabel="Deactivate"
          variant="danger"
          isLoading={deactivateUser.isPending}
          onConfirm={() => void handleDeactivate()}
          onClose={() => setConfirm(null)}
        />
      )}

      {twoFactorUser && (
        <TwoFactorDialog
          user={twoFactorUser}
          pendingAction={twoFactorPending}
          onAction={(action) => void handleTwoFactorAction(action)}
          onClose={() => setTwoFactorUser(null)}
        />
      )}
    </>
  );
}
