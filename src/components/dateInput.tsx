import type React from "react";
import { dateInputToUtcDateOnly, formatUtcDate } from "~/lib/date-utils";
import { Input } from "./ui/input";

/**
 * Native `<input type="date">` that speaks canonical UTC-midnight `Date`s
 * (the sibling of `DatePicker`, which does the same for the popover Calendar).
 *
 * The DOM input's currency is a `"yyyy-MM-dd"` string; this owns both
 * directions of that conversion so form state never holds the raw string.
 * Spreading a react-hook-form `field` here is safe — the default RHF
 * `onChange` (which would store the string) is overridden by this contract.
 */
export function DateInput({
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value?: Date;
  onChange?: (date?: Date) => void;
}) {
  return (
    <Input
      type="date"
      {...props}
      value={value ? formatUtcDate(value, "yyyy-MM-dd") : ""}
      onChange={(e) => onChange?.(dateInputToUtcDateOnly(e.target.value))}
    />
  );
}
