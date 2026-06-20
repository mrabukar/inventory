"use client";

import { useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import { Eye, EyeOff, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { isStrongPassword, STRONG_PASSWORD_MESSAGE } from "@/lib/auth/password";
import { cn } from "@/lib/utils";
import { ROLE_ITEMS, type User, type UserRole } from "@/types/users/user";

export interface UserFormValues {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  storeId: string;
  phone: string;
}

interface UserModalProps {
  open: boolean;
  mode: "add" | "edit";
  user?: User;
  storeItems: { value: string; label: string }[];
  showStoreField?: boolean;
  hideRoleField?: boolean;
  withPasswordConfirm?: boolean;
  onClose: () => void;
  onSave: (data: UserFormValues) => void;
  isSaving: boolean;
}

function FormField({
  label,
  required,
  error,
  helper,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium leading-none">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {helper && !error ? (
        <p className="text-sm text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}

const inputClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const dialogContentClassName = cn(
  "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg duration-200 sm:max-h-[90vh] sm:overflow-y-auto",
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
  "sm:rounded-lg",
);

function initialForm(user?: User): UserFormValues {
  return {
    name: user?.name ?? "",
    email: user?.email ?? "",
    password: "",
    role: user?.role ?? "branch_manager",
    storeId: user?.storeId ?? "",
    phone: user?.phone ?? "",
  };
}

export function UserModal({
  open,
  mode,
  user,
  storeItems,
  showStoreField = true,
  hideRoleField = false,
  withPasswordConfirm = false,
  onClose,
  onSave,
  isSaving,
}: UserModalProps) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState<UserFormValues>(() => initialForm(user));
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [err, setErr] = useState<Partial<Record<keyof UserFormValues, string>>>(
    {},
  );
  const [confirmErr, setConfirmErr] = useState<string | undefined>();

  const roleItems = useMemo(() => {
    const items = ROLE_ITEMS.map((item) => ({
      value: item.value,
      label: item.label,
    }));
    return showStoreField
      ? items
      : items.filter((item) => item.value !== "branch_manager");
  }, [showStoreField]);

  const set = (key: keyof UserFormValues, value: string) =>
    setForm((state) => ({ ...state, [key]: value }));

  const setRole = (role: UserRole | undefined) => {
    const nextRole = role ?? "branch_manager";
    setForm((state) => ({
      ...state,
      role: nextRole,
      storeId: nextRole === "admin" ? "" : state.storeId,
    }));
  };

  const save = () => {
    const next: Partial<Record<keyof UserFormValues, string>> = {};

    if (!form.name.trim()) next.name = "Name is required";
    if (!form.email.trim()) next.email = "Email is required";

    if (!isEdit) {
      if (!form.password) next.password = "Password is required";
      else if (form.password.length < 8)
        next.password = "Password must be at least 8 characters";
      else if (!isStrongPassword(form.password)) next.password = STRONG_PASSWORD_MESSAGE;
    } else if (form.password) {
      if (form.password.length < 8)
        next.password = "Password must be at least 8 characters";
      else if (!isStrongPassword(form.password))
        next.password = STRONG_PASSWORD_MESSAGE;
    }

    if (showStoreField && form.role === "branch_manager" && !form.storeId) {
      next.storeId = "Store is required for branch managers";
    }

    setErr(next);
    let nextConfirmErr: string | undefined;
    if (withPasswordConfirm && form.password && form.password !== confirmPassword) {
      nextConfirmErr = "Passwords do not match";
    } else if (withPasswordConfirm && !isEdit && form.password !== confirmPassword) {
      nextConfirmErr = "Passwords do not match";
    }
    setConfirmErr(nextConfirmErr);

    if (Object.keys(next).length || nextConfirmErr) return;

    onSave({
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
    });
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className={dialogContentClassName}>
          <div className="flex flex-col gap-1.5 text-left">
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
              {isEdit ? "Edit User" : "Add User"}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              {isEdit
                ? "Update account details. Leave password blank to keep the current one."
                : "Create an admin or branch manager account."}
            </Dialog.Description>
          </div>

          <div className="grid gap-4 py-2">
            <FormField label="Name" required error={err.name}>
              <input
                className={cn(inputClassName, err.name && "border-destructive")}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Full name"
              />
            </FormField>

            <FormField label="Email" required error={err.email}>
              <input
                className={cn(inputClassName, err.email && "border-destructive")}
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="name@company.com"
              />
            </FormField>

            <FormField
              label="Password"
              required={!isEdit}
              error={err.password}
              helper={
                isEdit
                  ? "Leave blank to keep the current password."
                  : STRONG_PASSWORD_MESSAGE
              }
            >
              <div className="relative">
                <input
                  className={cn(
                    inputClassName,
                    "pr-10",
                    err.password && "border-destructive",
                  )}
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => {
                    set("password", e.target.value);
                    setConfirmErr(undefined);
                  }}
                  placeholder={isEdit ? "Unchanged" : "Min. 8 characters"}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setShowPassword((show) => !show)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </FormField>

            {withPasswordConfirm ? (
              <FormField
                label="Confirm password"
                required={!isEdit || Boolean(form.password)}
                error={confirmErr}
              >
                <div className="relative">
                  <input
                    className={cn(
                      inputClassName,
                      "pr-10",
                      confirmErr && "border-destructive",
                    )}
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setConfirmErr(undefined);
                    }}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowConfirmPassword((show) => !show)}
                    tabIndex={-1}
                    aria-label={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </FormField>
            ) : null}

            {!hideRoleField ? (
              <FormField label="Role" required>
                <Combobox
                  value={form.role}
                  onValueChange={(value) => setRole(value as UserRole | undefined)}
                  items={roleItems}
                  placeholder="Select role"
                  searchPlaceholder="Search roles…"
                  emptyText="No roles found."
                  className="w-full"
                  popoverClassName="z-[200]"
                />
              </FormField>
            ) : null}

            {showStoreField && form.role === "branch_manager" ? (
              <FormField label="Store" required error={err.storeId}>
                <Combobox
                  value={form.storeId || undefined}
                  onValueChange={(value) => set("storeId", value ?? "")}
                  items={storeItems}
                  placeholder="Select store"
                  searchPlaceholder="Search stores…"
                  emptyText="No stores found."
                  className="w-full"
                  popoverClassName="z-[200]"
                />
              </FormField>
            ) : null}

            <FormField label="Phone">
              <input
                className={inputClassName}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="Optional"
              />
            </FormField>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={isSaving}>
              {isSaving ? "Saving…" : isEdit ? "Save Changes" : "Add User"}
            </Button>
          </div>

          <Dialog.Close
            type="button"
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onClick={onClose}
          >
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
