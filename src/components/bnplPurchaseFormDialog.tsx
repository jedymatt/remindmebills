"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { formatUtcDate } from "~/lib/date-utils";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";

const PurchaseFormSchema = z.object({
  title: z.string().trim().min(1, { message: "Title is required" }),
  amount: z.coerce.number<number>().min(1, { message: "Amount is required" }),
  tenureMonths: z.coerce.number<number>().int().min(1).max(60),
  firstDueMonth: z.date(),
});

export type PurchaseFormValues = z.infer<typeof PurchaseFormSchema>;

/** `"yyyy-MM"` → UTC midnight on the 1st, or undefined when cleared/invalid. */
function monthInputToUtc(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}-01`);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

// Shared by useForm's initial state and the create-mode reset below, so the
// two can't drift apart into two different "empty purchase" shapes.
function defaultPurchaseFormValues(): PurchaseFormValues {
  return {
    title: "",
    amount: 0,
    tenureMonths: 6,
    firstDueMonth: new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
    ),
  };
}

export function BnplPurchaseFormDialog({
  open,
  onOpenChange,
  accountName,
  initialValues,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountName: string;
  initialValues?: PurchaseFormValues;
  onSubmit: (values: PurchaseFormValues) => void;
  isPending: boolean;
}) {
  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(PurchaseFormSchema),
    defaultValues: defaultPurchaseFormValues(),
  });

  // Reset on open so an edit shows the current values and a create starts
  // clean — otherwise one dialog instance serving both modes leaves a create
  // holding whatever an earlier edit last had in it.
  useEffect(() => {
    if (!open) return;
    form.reset(initialValues ?? defaultPurchaseFormValues());
  }, [open, initialValues, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initialValues ? "Edit purchase" : "New purchase"}
          </DialogTitle>
          <DialogDescription>
            Billed on {accountName}&apos;s monthly statement.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            id="bnpl-purchase-form"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item</FormLabel>
                  <FormControl>
                    <Input placeholder="Airpods" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly installment</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tenureMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Months</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={60} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="firstDueMonth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First statement month</FormLabel>
                  <FormControl>
                    <Input
                      type="month"
                      value={
                        field.value ? formatUtcDate(field.value, "yyyy-MM") : ""
                      }
                      onChange={(e) =>
                        field.onChange(monthInputToUtc(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    The day comes from the account&apos;s due day.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form="bnpl-purchase-form" disabled={isPending}>
            {isPending && <Loader2 className="mr-1 size-4 animate-spin" />}
            {initialValues ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
