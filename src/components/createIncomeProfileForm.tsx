"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

const CreateIncomeProfileFormValues = z.object({
  payFrequency: z.enum(["weekly", "fortnightly", "monthly"]),
  startDate: z.date(),
});

type CreateIncomeProfileFormValues = z.infer<
  typeof CreateIncomeProfileFormValues
>;

export function CreateIncomeProfileForm() {
  const form = useForm<CreateIncomeProfileFormValues>({
    resolver: zodResolver(CreateIncomeProfileFormValues),
  });
  const utils = api.useUtils();
  const createIncomeProfile = api.income.createIncomeProfile.useMutation({
    onSuccess: async () => {
      await utils.income.getIncomeProfile.invalidate();
      toast("Income profile created successfully.");
    },
  });

  async function onSubmit(values: CreateIncomeProfileFormValues) {
    await createIncomeProfile.mutateAsync(values);
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
                </SelectContent>
              </Select>

              <FormDescription>
                This will be used to assign when the bills will be paid.
              </FormDescription>
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
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground",
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date > new Date() || date < new Date("1900-01-01")
                    }
                  />
                </PopoverContent>
              </Popover>
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
      <h2 className="text-2xl font-bold">Setup Income Profile</h2>
      <CreateIncomeProfileForm />
    </div>
  );
}
