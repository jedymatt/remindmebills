"use client";

import { format } from "date-fns";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

// ── Shared Zod schemas ────────────────────────────────────────────────────────

const BaseBillFormValues = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  amount: z.coerce.number<number>().min(0).optional(),
});

const SingleBillFormValues = BaseBillFormValues.extend({
  type: z.literal("single"),
  date: z.coerce.date<Date>(),
});

const RecurringBillFormValues = BaseBillFormValues.extend({
  type: z.literal("recurring"),
  recurrence: z.object({
    type: z.enum(["weekly", "monthly"]),
    interval: z.coerce.number<number>().min(1),
    bymonthday: z.array(z.number()).optional(),
    dtstart: z.coerce.date<Date>(),
    until: z.coerce.date<Date>().optional(),
    count: z.coerce.number<number>().min(1).optional(),
  }),
});

export const BillFormValuesSchema = z.discriminatedUnion("type", [
  SingleBillFormValues,
  RecurringBillFormValues,
]);

export type BillFormValues = z.infer<typeof BillFormValuesSchema>;

// ── BillFormFields component ──────────────────────────────────────────────────

interface BillFormFieldsProps {
  form: UseFormReturn<BillFormValues>;
  recurringEndsWith: "never" | "until" | "count";
  onRecurringEndsWithChange: (value: "never" | "until" | "count") => void;
  formId: string;
  onSubmit: (data: BillFormValues) => void | Promise<void>;
  titlePlaceholder?: string;
}

export function BillFormFields({
  form,
  recurringEndsWith,
  onRecurringEndsWithChange,
  formId,
  onSubmit,
  titlePlaceholder = "Title",
}: BillFormFieldsProps) {
  const [formType, formRecurrenceType] = useWatch({
    name: ["type", "recurrence.type"],
    control: form.control,
  });

  return (
    <Form {...form}>
      <form
        id={formId}
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input type="text" placeholder={titlePlaceholder} {...field} />
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
              <FormLabel>Amount (optional)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="Amount"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Separator />

        <Tabs
          value={formType}
          onValueChange={(value) =>
            form.setValue("type", value as BillFormValues["type"])
          }
        >
          <TabsList className="w-full">
            <TabsTrigger value="single">Once</TabsTrigger>
            <TabsTrigger value="recurring">Repeating</TabsTrigger>
          </TabsList>
          <TabsContent value="single" className="space-y-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      placeholder="Date"
                      {...field}
                      value={
                        field.value ? format(field.value, "yyyy-MM-dd") : ""
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
          <TabsContent value="recurring" className="space-y-4">
            <FormField
              control={form.control}
              name="recurrence.type"
              defaultValue="monthly"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Every</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="weekly">Week</SelectItem>
                      <SelectItem value="monthly">Month</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="recurrence.interval"
              defaultValue={1}
              rules={{ min: 1 }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Repeats every {Number(field.value) || 1}{" "}
                    {formRecurrenceType === "weekly"
                      ? "week" + (Number(field.value) !== 1 ? "s" : "")
                      : "month" + (Number(field.value) !== 1 ? "s" : "")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Interval"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="recurrence.dtstart"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date Start</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      placeholder="Date Start"
                      {...field}
                      value={
                        field.value ? format(field.value, "yyyy-MM-dd") : ""
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormLabel>Ends...</FormLabel>
            <RadioGroup
              value={recurringEndsWith}
              onValueChange={(value) =>
                onRecurringEndsWithChange(value as typeof recurringEndsWith)
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="never" id={`${formId}-never`} />
                <Label htmlFor={`${formId}-never`}>Never</Label>
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="count" id={`${formId}-count`} />
                <FormField
                  control={form.control}
                  name="recurrence.count"
                  rules={{ min: 1 }}
                  defaultValue={1}
                  disabled={recurringEndsWith !== "count"}
                  render={({ field }) => (
                    <FormItem className="pt-0.5">
                      <FormLabel
                        onClick={() => onRecurringEndsWithChange("count")}
                      >
                        After
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="No. of terms"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="until" id={`${formId}-until`} />
                <FormField
                  control={form.control}
                  name="recurrence.until"
                  disabled={recurringEndsWith !== "until"}
                  render={({ field }) => (
                    <FormItem className="pt-0.5">
                      <FormLabel
                        onClick={() => onRecurringEndsWithChange("until")}
                      >
                        Until
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          placeholder="Until"
                          {...field}
                          value={
                            field.value
                              ? format(field.value, "yyyy-MM-dd")
                              : ""
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </RadioGroup>
          </TabsContent>
        </Tabs>
      </form>
    </Form>
  );
}
