import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { localDateToUtcDateOnly, utcDateOnlyToLocal } from "~/lib/date-utils";

export function DatePicker({
  value,
  onChange,
}: {
  value?: Date;
  onChange?: (date?: Date) => void;
}) {
  const [open, setOpen] = React.useState(false);

  // `value` is canonical UTC midnight; the Calendar works in local time, so we
  // present the same calendar day as a local Date and convert the selection
  // back to UTC midnight on the way out.
  const selected = value ? utcDateOnlyToLocal(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="text-muted-foreground hover:text-muted-foreground w-full justify-between bg-transparent font-normal hover:bg-transparent"
        >
          {selected ? selected.toLocaleDateString() : "Select date"}
          <ChevronDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          captionLayout="dropdown"
          onSelect={(date) => {
            onChange?.(date ? localDateToUtcDateOnly(date) : undefined);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
