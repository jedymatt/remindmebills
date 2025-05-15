"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "~/trpc/react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";
import { useState } from "react";

const BaseBillFormValues = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  amount: z.coerce.number().min(0).optional(),
});

const SingleBillFormValues = BaseBillFormValues.extend({
  type: z.literal("single"),
  date: z.coerce.date(),
});

const RecurringBillFormValues = BaseBillFormValues.extend({
  type: z.literal("recurring"),
  recurrence: z.object({
    type: z.enum(["weekly", "monthly"]),
    interval: z.coerce.number().min(1),
    bymonthday: z.coerce.number().array().optional(),
    dtstart: z.coerce.date(),
    until: z.coerce.date().optional(),
    termInMonths: z.coerce.number().optional(),
  }),
});

const CreateBillFormValues = z.discriminatedUnion("type", [
  SingleBillFormValues,
  RecurringBillFormValues,
]);

type CreateBillFormValues = z.infer<typeof CreateBillFormValues>;

export function CreateBillFormDialog() {
  const [open, setOpen] = useState(false);
  const form = useForm<CreateBillFormValues>({
    resolver: zodResolver(CreateBillFormValues),
    defaultValues: {
      title: "",
      type: "single",
    },
  });
  const utils = api.useUtils();
  const createBill = api.bill.create.useMutation({
    onSuccess: async () => {
      await utils.bill.getAll.invalidate();
      toast("Bill created successfully.");
      setOpen(false);
      form.reset();
    },
  });

  const isSingle = form.watch("type") === "single";

  async function onSubmit(data: CreateBillFormValues) {
    await createBill.mutateAsync(data);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          New Bill <CalendarPlus />
        </Button>
      </DialogTrigger>
      <DialogContent onCloseAutoFocus={() => form.reset()}>
        <DialogHeader>
          <DialogTitle>Create New Bill</DialogTitle>
          <DialogDescription>
            Create a new bill to track your expenses.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="create-bill-form"
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
                    <Input type="text" placeholder="Title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue="single"
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select bill type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="recurring">Recurring</SelectItem>
                      </SelectContent>
                    </Select>

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
            </div>

            <Separator />
            <p className="font-semibold">
              {isSingle ? "Single" : "Recurring"} Bill Details
            </p>

            {isSingle && (
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
            )}

            {!isSingle && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="recurrence.type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue="monthly"
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a recurrence type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="recurrence.interval"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Interval</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Interval"
                            {...field}
                            value={field.value ?? 1}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="recurrence.bymonthday"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>By Month Day (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="1, 15, 30"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value
                              .split(",")
                              .map((v) => v.trim())
                              .filter((v) => v !== "")
                              .map((v) => parseInt(v, 10))
                              .filter((v) => !isNaN(v));

                            field.value = value;
                          }}
                          value={field.value?.join(", ") ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                      <FormDescription>
                        Enter the days of the month (1-31) when the bill is due,
                        separated by commas. For example: 1, 15, 30.
                      </FormDescription>
                    </FormItem>
                  )}
                />
                {/* Date Start */}
                <FormField
                  control={form.control}
                  name="recurrence.dtstart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Start </FormLabel>
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
                <div className="grid grid-cols-2 gap-4">
                  {/* Until (optional) */}
                  <FormField
                    control={form.control}
                    name="recurrence.until"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Until (optional)</FormLabel>
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
                  {/* Term in Months (optional) */}
                  <FormField
                    control={form.control}
                    name="recurrence.termInMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Term (optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Term in Months"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}
          </form>
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            type="submit"
            form="create-bill-form"
            disabled={form.formState.isSubmitting}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
