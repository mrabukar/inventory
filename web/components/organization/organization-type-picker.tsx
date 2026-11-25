"use client";

import {
  ORGANIZATION_TYPE_OPTIONS,
  type OrganizationType,
} from "@/lib/organization-type";
import { cn } from "@/lib/utils";

interface Props {
  value: OrganizationType;
  onChange: (value: OrganizationType) => void;
  disabled?: boolean;
}

/** The three organization types as one choice. */
export function OrganizationTypePicker({ value, onChange, disabled }: Props) {
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium leading-none">
        Organization type
      </legend>
      {ORGANIZATION_TYPE_OPTIONS.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors",
            value === option.value
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-muted/40",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <input
            type="radio"
            name="organization-type"
            className="mt-0.5 size-4 accent-[var(--brand-indigo-600)]"
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>
            <span className="font-medium">{option.label}</span>
            <span className="mt-1 block text-muted-foreground">
              {option.description}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
