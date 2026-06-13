"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, List, Loader2, Plus } from "lucide-react";

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
import type { ExpenseCategory } from "@/types/expenses/expense-category";

interface Props {
  value?: number;
  onValueChange: (categoryId: number | undefined) => void;
  categories: ExpenseCategory[];
  loading?: boolean;
  disabled?: boolean;
  error?: boolean;
  onSeeAll: () => void;
  onAddNew: () => void;
}

export function ExpenseCategoryPicker({
  value,
  onValueChange,
  categories,
  loading = false,
  disabled = false,
  error = false,
  onSeeAll,
  onAddNew,
}: Props) {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    if (value == null) return null;
    return categories.find((c) => c.id === value)?.name ?? null;
  }, [categories, value]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className={cn(
            "h-10 w-full justify-between font-normal",
            !selectedLabel && "text-muted-foreground",
            error && "border-destructive",
          )}
        >
          <span className="truncate">
            {loading ? "Loading…" : (selectedLabel ?? "Select category")}
          </span>
          {loading ? (
            <Loader2 className="ml-2 size-4 shrink-0 animate-spin opacity-50" />
          ) : (
            <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[200] flex w-[var(--radix-popover-trigger-width)] flex-col overflow-hidden p-0"
        align="start"
        side="bottom"
        collisionPadding={12}
      >
        <Command className="max-h-[min(22rem,var(--radix-popover-content-available-height))]">
          <button
            type="button"
            className="flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-accent"
            onClick={() => {
              setOpen(false);
              onSeeAll();
            }}
          >
            <List className="size-4 shrink-0" />
            See all categories
          </button>
          <CommandInput placeholder="Search categories…" />
          <CommandList className="min-h-0 flex-1">
            <CommandEmpty>No categories found.</CommandEmpty>
            <CommandGroup>
              {categories.map((category) => (
                <CommandItem
                  key={category.id}
                  value={category.name}
                  keywords={[category.name, String(category.id)]}
                  onSelect={() => {
                    onValueChange(category.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      value === category.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {category.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="border-t border-border p-2">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-primary hover:bg-accent"
              onClick={() => {
                setOpen(false);
                onAddNew();
              }}
            >
              <Plus className="size-4 shrink-0" />
              Add new category
            </button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
