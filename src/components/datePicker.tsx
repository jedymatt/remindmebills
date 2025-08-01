import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";

export function DatePicker({
  value,
  onChange,
}: {
  value?: Date;
  onChange?: (date?: Date) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="text-muted-foreground hover:text-muted-foreground w-full justify-between bg-transparent font-normal hover:bg-transparent"
        >
          {date ? date.toLocaleDateString() : "Select date"}
          <ChevronDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          captionLayout="dropdown"
          onSelect={(date) => {
            setDate(date);
            onChange?.(date);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
