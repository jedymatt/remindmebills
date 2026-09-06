"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { LAST_DAY_VALUE, parsePayDay } from "~/schemas/income";
import type { PayDay } from "~/types";

const LONGEST_MONTH_DAYS = 31;

const DAY_OPTIONS = [
  ...Array.from({ length: LONGEST_MONTH_DAYS }, (_, index) => ({
    value: String(index + 1),
    label: `Day ${index + 1}`,
  })),
  { value: LAST_DAY_VALUE, label: "Last day of month" },
];

export function PayDaySelect({
  value,
  onChange,
}: {
  value?: PayDay;
  onChange: (day: PayDay) => void;
}) {
  return (
    <Select
      value={value === undefined ? undefined : String(value)}
      onValueChange={(selected) => onChange(parsePayDay(selected))}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a day" />
      </SelectTrigger>
      <SelectContent>
        {DAY_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
