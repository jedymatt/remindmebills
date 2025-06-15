"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "~/trpc/react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
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

interface BymonthdayInputProps
  extends Omit<React.ComponentProps<typeof Input>, "onChange"> {
  onChange?: (values: number[]) => void;
}

function BymonthdayInput({ onChange, value, ...props }: BymonthdayInputProps) {
  const [displayValue, setDisplayValue] = useState(value ?? "");

  return (
    <Input
      type="text"
      onChange={(e) => {
        setDisplayValue(e.currentTarget.value);
        const value = e.currentTarget.value
          .trim()
          .split(/[,\s*]/)
          .filter((v) => v.length > 0)
          .map((v) => Number(v));

        onChange?.(value);
      }}
      value={displayValue}
      {...props}
    />
  );
}

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
    bymonthday: z.array(z.number()).optional(),
    dtstart: z.coerce.date(),
    until: z.coerce.date().optional(),
    count: z.coerce.number().optional(),
  }),
});

const CreateBillFormValues = z.discriminatedUnion("type", [
  SingleBillFormValues,
  RecurringBillFormValues,
]);

type CreateBillFormValues = z.infer<typeof CreateBillFormValues>;

export function CreateBillForm() {
  const router = useRouter();
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
      router.push("/dashboard");
    },
  });

  const isSingle = form.watch("type") === "single";

  async function onSubmit(data: CreateBillFormValues) {
    await createBill.mutateAsync(data);
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Create a new bill</CardTitle>
        <CardDescription>
          Fill in the details of the bill you want to create.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                      defaultValue={field.value}
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
            <div className="space-y-4 rounded-md border p-4">
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
                      defaultValue="monthly"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
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
                      defaultValue={1}
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
                          <BymonthdayInput
                            type="text"
                            placeholder="1, 15, 31"
                            {...field}
                            onChange={field.onChange}
                            value={field.value?.join(", ") ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                        <FormDescription>
                          {`[ ${field.value?.join(", ") ?? ""} ]`}
                          <br />
                          Enter the days of the month (1-31) when the bill is
                          due, separated by commas or spaces. For example: 1,
                          15, 30 or 1 15 30.
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
                  {/* todo: radio input like bluecoins app */}
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
                    {/* Term (optional) */}
                    <FormField
                      control={form.control}
                      name="recurrence.count"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Term (optional)</FormLabel>
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
                </>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="justify-between">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" form="create-bill-form">
          Create
        </Button>
      </CardFooter>
    </Card>
  );
}
