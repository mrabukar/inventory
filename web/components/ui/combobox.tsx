"use client";

import * as React from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboboxItem {
  value: string;
  label: string;
  keywords?: string[];
}

interface ComboboxProps {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  items: ComboboxItem[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearOption?: { label: string };
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  popoverClassName?: string;
}

export function Combobox({
  value,
  onValueChange,
  items,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  clearOption,
  loading = false,
  disabled = false,
  className,
  popoverClassName,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selectedLabel = React.useMemo(() => {
    if (!value) return null;
    return items.find((item) => item.value === value)?.label ?? null;
  }, [items, value]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className={cn(
            "h-9 min-w-[180px] justify-between font-normal",
            !selectedLabel && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {loading ? "Loading…" : (selectedLabel ?? placeholder)}
          </span>
          {loading ? (
            <Loader2 className="ml-2 size-4 shrink-0 animate-spin opacity-50" />
          ) : (
            <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "z-50 flex w-[var(--radix-popover-trigger-width)] min-w-[12rem] flex-col overflow-hidden p-0",
          popoverClassName,
        )}
        align="start"
        side="bottom"
        collisionPadding={12}
      >
        <Command className="max-h-[min(20rem,var(--radix-popover-content-available-height))]">
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="min-h-0 flex-1">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {clearOption && (
                <CommandItem
                  value={clearOption.label}
                  keywords={[clearOption.label, "all"]}
                  onSelect={() => {
                    onValueChange(undefined);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      !value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {clearOption.label}
                </CommandItem>
              )}
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.label}
                  keywords={item.keywords ?? [item.label, item.value]}
                  onSelect={() => {
                    onValueChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      value === item.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
