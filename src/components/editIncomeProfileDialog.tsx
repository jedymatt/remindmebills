"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { isFuture } from "date-fns";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";
import { DatePicker } from "./datePicker";
import type { IncomeProfile } from "~/types";

const EditIncomeProfileSchema = z.object({
  payFrequency: z.enum(["weekly", "fortnightly", "monthly"]),
  startDate: z.coerce.date<Date>().refine((val) => !isFuture(val), {
    message: "No future dates allowed",
  }),
  amount: z.number().min(0, "Amount must be 0 or more").optional(),
});

type EditIncomeProfileValues = z.infer<typeof EditIncomeProfileSchema>;

export function EditIncomeProfileDialog({
  open,
  onOpenChange,
  currentProfile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProfile: IncomeProfile;
}) {
  const form = useForm<EditIncomeProfileValues>({
    resolver: zodResolver(EditIncomeProfileSchema),
    defaultValues: {
      payFrequency: currentProfile.payFrequency,
      startDate: currentProfile.startDate,
      amount: currentProfile.amount,
    },
  });

  const utils = api.useUtils();
  const updateIncomeProfile = api.income.updateIncomeProfile.useMutation({
    onSuccess: async () => {
      await utils.income.getIncomeProfile.invalidate();
      toast("Income profile updated successfully.");
      onOpenChange(false);
    },
  });

  async function onSubmit(values: EditIncomeProfileValues) {
    await updateIncomeProfile.mutateAsync(values);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Income Profile</DialogTitle>
          <DialogDescription>
            Update your pay frequency, starting date, or income amount.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="payFrequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pay Frequency</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a pay frequency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Starting Date</FormLabel>
                  <DatePicker value={field.value} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Income Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
