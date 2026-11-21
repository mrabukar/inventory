"use client";

import { Combobox, type ComboboxItem } from "@/components/ui/combobox";

/** The domains an organization can sign in on, shown by name. */
export const ORGANIZATION_DOMAINS = [
  { name: "Fonex", domain: "fonex.mobilephoneinventory.com" },
  { name: "Sanabil", domain: "sanabil.mobilephoneinventory.com" },
] as const;

interface Props {
  /** The chosen domain, or "" for none. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function OrganizationDomainSelect({ value, onChange, disabled }: Props) {
  // An organization saved with some other domain keeps showing it, so
  // opening the page never silently changes it.
  const items: ComboboxItem[] = ORGANIZATION_DOMAINS.map(({ name, domain }) => ({
    value: domain,
    label: name,
    keywords: [name, domain],
  }));
  if (value && !items.some((item) => item.value === value)) {
    items.push({ value, label: value, keywords: [value] });
  }

  return (
    <Combobox
      value={value || undefined}
      onValueChange={(next) => onChange(next ?? "")}
      items={items}
      placeholder="Choose Fonex or Sanabil"
      searchPlaceholder="Search…"
      emptyText="No domains."
      clearOption={{ label: "No domain (blocked from signing in)" }}
      disabled={disabled}
      className="w-full"
    />
  );
}
