"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
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
import type { PlaygroundBill } from "~/types";

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

const BillFormValuesSchema = z.discriminatedUnion("type", [
  SingleBillFormValues,
  RecurringBillFormValues,
]);

type BillFormValues = z.infer<typeof BillFormValuesSchema>;

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

  const [formType, formRecurrenceType] = useWatch({
    name: ["type", "recurrence.type"],
    control: form.control,
  });

  const handleSubmit = (data: BillFormValues) => {
    const bill: PlaygroundBill = {
      ...data,
      id: crypto.randomUUID(),
    };
    onSubmit(bill);
    form.reset();
    onOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Hypothetical Bill</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            id="playground-bill-form"
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="e.g., Car Loan"
                      {...field}
                    />
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
                        Repeats every {Number(field.value) ?? 1}{" "}
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
                    setRecurringEndsWith(value as typeof recurringEndsWith)
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="never" id="pg-never" />
                    <Label htmlFor="pg-never">Never</Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="count" id="pg-count" />
                    <FormField
                      control={form.control}
                      name="recurrence.count"
                      rules={{ min: 1 }}
                      defaultValue={1}
                      disabled={recurringEndsWith !== "count"}
                      render={({ field }) => (
                        <FormItem className="pt-0.5">
                          <FormLabel
                            onClick={() => setRecurringEndsWith("count")}
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
                    <RadioGroupItem value="until" id="pg-until" />
                    <FormField
                      control={form.control}
                      name="recurrence.until"
                      disabled={recurringEndsWith !== "until"}
                      render={({ field }) => (
                        <FormItem className="pt-0.5">
                          <FormLabel
                            onClick={() => setRecurringEndsWith("until")}
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
