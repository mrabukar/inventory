"use client";

import { Dialog } from "radix-ui";
import { RotateCcw, ShieldCheck, ShieldOff, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  twoFactorState,
  type TwoFactorAction,
  type User,
} from "@/types/users/user";

interface Option {
  action: TwoFactorAction;
  icon: typeof ShieldOff;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
}

function firstName(user: User): string {
  return user.name.trim().split(/\s+/)[0] || user.name;
}

function describeState(user: User): { label: string; detail: string } {
  const name = firstName(user);
  switch (twoFactorState(user)) {
    case "on":
      return {
        label: "On",
        detail: `${name} signs in with a password and a code from their authenticator app.`,
      };
    case "pending":
      return {
        label: "Waiting for setup",
        detail: `${name} must set up an authenticator app the next time they sign in.`,
      };
    case "off":
      return {
        label: "Off",
        detail: `${name} signs in with only a password.`,
      };
  }
}

function optionsFor(user: User): Option[] {
  const name = firstName(user);
  const turnOff: Option = {
    action: "disable",
    icon: ShieldOff,
    title: "Turn off two-factor",
    body: `${name} will sign in with only a password. Their authenticator app will stop working for this account.`,
    confirmLabel: "Turn off",
    danger: true,
  };

  switch (twoFactorState(user)) {
    case "on":
      return [
        {
          action: "reset",
          icon: RotateCcw,
          title: "Reset authenticator",
          body: `For a lost or replaced phone. ${name} will scan a new QR code the next time they sign in.`,
          confirmLabel: "Reset",
        },
        turnOff,
      ];
    case "pending":
      return [
        {
          ...turnOff,
          body: `${name} won't be asked to set up an authenticator app and will sign in with only a password.`,
        },
      ];
    case "off":
      return [
        {
          action: "require",
          icon: ShieldCheck,
          title: "Require two-factor",
          body: `${name} will be asked to set up an authenticator app the next time they sign in.`,
          confirmLabel: "Require",
        },
      ];
  }
}

interface TwoFactorDialogProps {
  user: User;
  pendingAction: TwoFactorAction | null;
  onAction: (action: TwoFactorAction) => void;
  onClose: () => void;
}

export function TwoFactorDialog({
  user,
  pendingAction,
  onAction,
  onClose,
}: TwoFactorDialogProps) {
  const state = describeState(user);
  const options = optionsFor(user);
  const busy = pendingAction !== null;

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-5 border border-border bg-background p-6 shadow-lg sm:rounded-lg">
          <div className="grid gap-1.5 pr-6">
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
              Two-factor sign-in
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              {user.name} · {user.email}
            </Dialog.Description>
          </div>

          <div className="rounded-md border border-border bg-muted/40 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current setting
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {state.label}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {state.detail}
            </p>
          </div>

          <ul className="grid gap-3">
            {options.map((option) => {
              const Icon = option.icon;
              return (
                <li
                  key={option.action}
                  className="flex items-start gap-3 rounded-md border border-border p-4"
                >
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      option.danger ? "text-destructive" : "text-foreground",
                    )}
                    aria-hidden
                  />
                  <div className="grid flex-1 gap-1">
                    <p className="text-sm font-medium text-foreground">
                      {option.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {option.body}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={option.danger ? "destructive" : "outline"}
                    disabled={busy}
                    onClick={() => onAction(option.action)}
                  >
                    {pendingAction === option.action
                      ? "Saving…"
                      : option.confirmLabel}
                  </Button>
                </li>
              );
            })}
          </ul>

          <Dialog.Close
            type="button"
            className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            disabled={busy}
          >
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
