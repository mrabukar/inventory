"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { type DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  dateToYmd,
  formatPeriodLabel,
  getCurrentMonthRange,
  getLastMonthRange,
  getLastSixMonthsRange,
  isSameRange,
  ymdToDate,
} from "@/lib/filters/dates";
import { cn } from "@/lib/utils";

const PRESETS = [
  { id: "this-month" as const, label: "This month", range: getCurrentMonthRange },
  { id: "last-month" as const, label: "Last month", range: getLastMonthRange },
  { id: "last-6-months" as const, label: "Last 6 months", range: getLastSixMonthsRange },
];

export interface DateRangePickerProps {
  fromDate: string;
  toDate: string;
  onChange: (range: { fromDate: string; toDate: string }) => void;
  className?: string;
  disabled?: boolean;
}

export function DateRangePicker({
  fromDate,
  toDate,
  onChange,
  className,
  disabled = false,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>();
  const [month, setMonth] = React.useState<Date>(() => ymdToDate(fromDate));

  React.useEffect(() => {
    if (!open) {
      setDraft(undefined);
      return;
    }

    setDraft({
      from: ymdToDate(fromDate),
      to: ymdToDate(toDate),
    });
    setMonth(ymdToDate(fromDate));
  }, [open, fromDate, toDate]);

  function applyRange(range: { fromDate: string; toDate: string }) {
    onChange(range);
    setOpen(false);
  }

  function handleCalendarSelect(range: DateRange | undefined) {
    setDraft(range);
    if (range?.from && range?.to) {
      applyRange({
        fromDate: dateToYmd(range.from),
        toDate: dateToYmd(range.to),
      });
    }
  }

  return (
    <Popover open={disabled ? false : open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 min-w-[240px] justify-start text-left font-normal",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4 shrink-0 opacity-50" />
          <span className="truncate">
            {formatPeriodLabel(fromDate, toDate)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex flex-wrap gap-1.5 border-b p-2">
          {PRESETS.map((preset) => {
            const range = preset.range();
            const active = isSameRange({ fromDate, toDate }, range);
            return (
              <Button
                key={preset.id}
                type="button"
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className="h-8"
                onClick={() => applyRange(range)}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>
        <Calendar
          autoFocus
          mode="range"
          resetOnSelect
          month={month}
          onMonthChange={setMonth}
          selected={draft}
          onSelect={handleCalendarSelect}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}
