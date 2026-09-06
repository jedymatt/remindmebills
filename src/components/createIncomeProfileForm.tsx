"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { isFuture } from "date-fns";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { utcDateOnlyToLocal } from "~/lib/date-utils";
import {
  PayDaysSchema,
  PayFrequencySchema,
  refineIncomeFields,
} from "~/schemas/income";
import { api } from "~/trpc/react";
import { DatePicker } from "./datePicker";
import { PayDaySelect } from "./payDaySelect";

const CreateIncomeProfileFormValuesSchema = z
  .object({
    payFrequency: PayFrequencySchema,
    payDays: PayDaysSchema.optional(),
    // startDate is canonical UTC midnight; compare its calendar day (not the raw
    // instant) so picking "today" is never treated as future in +offset zones.
    startDate: z.coerce
      .date<Date>()
      .refine((val) => !isFuture(utcDateOnlyToLocal(val)), {
        message: "No future dates allowed",
      }),
  })
  .superRefine(refineIncomeFields);

type CreateIncomeProfileFormValues = z.infer<
  typeof CreateIncomeProfileFormValuesSchema
>;

export function CreateIncomeProfileForm() {
  // TODO: Add amount field later
  const form = useForm({
    resolver: zodResolver(CreateIncomeProfileFormValuesSchema),
  });
  const payFrequency = useWatch({
    control: form.control,
    name: "payFrequency",
  });

  const utils = api.useUtils();
  const createIncomeProfile = api.income.createIncomeProfile.useMutation({
    onSuccess: async () => {
      await utils.income.getIncomeProfile.invalidate();
      toast("Income profile created successfully.");
    },
  });

  async function onSubmit(values: CreateIncomeProfileFormValues) {
    if (values.payFrequency === "semimonthly") {
      await createIncomeProfile.mutateAsync({
        payFrequency: values.payFrequency,
        // The schema's refinement rejects a semi-monthly profile without both
        // paydays, so submit cannot reach here with them missing.
        payDays: values.payDays!,
        startDate: values.startDate,
      });
      return;
    }

    await createIncomeProfile.mutateAsync({
      payFrequency: values.payFrequency,
      startDate: values.startDate,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="payFrequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pay Frequency</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a pay frequency" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="semimonthly">Semi-monthly</SelectItem>
                </SelectContent>
              </Select>

              <FormDescription>
                This will be used to assign when the bills will be paid.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {payFrequency === "semimonthly" && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="payDays.0"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First payday</FormLabel>
                  <PayDaySelect value={field.value} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payDays.1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Second payday</FormLabel>
                  <PayDaySelect value={field.value} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Starting Date</FormLabel>
              <DatePicker value={field.value} onChange={field.onChange} />
              <FormDescription>Initial received pay date.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          className="w-full"
          type="submit"
          disabled={form.formState.isSubmitting}
        >
          Submit
        </Button>
      </form>
    </Form>
  );
}

export function IncomeProfileSetup() {
  return (
    <div className="w-full space-y-6 rounded-lg border p-6 shadow-md">
      <h2 className="text-ledger-ink font-display text-2xl">
        Setup Income Profile
      </h2>
      <CreateIncomeProfileForm />
    </div>
  );
}
