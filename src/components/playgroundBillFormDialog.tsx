"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { BillFormFields, BillFormValuesSchema, type BillFormValues } from "./billFormFields";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import type { PlaygroundBill } from "~/types";

interface PlaygroundBillFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (bill: PlaygroundBill) => void;
}

export function PlaygroundBillFormDialog({
  open,
  onOpenChange,
  onSubmit,
}: PlaygroundBillFormDialogProps) {
  const form = useForm<BillFormValues>({
    resolver: zodResolver(BillFormValuesSchema),
    defaultValues: {
      title: "",
      type: "single",
    },
  });

  const [recurringEndsWith, setRecurringEndsWith] = useState<
    "never" | "until" | "count"
  >("never");

  const handleRecurringEndsWithChange = (
    value: "never" | "until" | "count",
  ) => {
    setRecurringEndsWith(value);
    if (value !== "count") form.setValue("recurrence.count", undefined);
    if (value !== "until") form.setValue("recurrence.until", undefined);
  };

  const handleSubmit = (data: BillFormValues) => {
    const bill: PlaygroundBill = {
      ...data,
      id: crypto.randomUUID(),
    };
    onSubmit(bill);
    form.reset();
    setRecurringEndsWith("never");
    onOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
      setRecurringEndsWith("never");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Hypothetical Bill</DialogTitle>
          <DialogDescription className="sr-only">
            Add a hypothetical bill to explore its impact on your budget.
          </DialogDescription>
        </DialogHeader>

        <BillFormFields
          form={form}
          recurringEndsWith={recurringEndsWith}
          onRecurringEndsWithChange={handleRecurringEndsWithChange}
          formId="playground-bill-form"
          onSubmit={handleSubmit}
        />

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="playground-bill-form">
            Add Bill
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
