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

// TODO: Think of a better way to place this component
// interface BymonthdayInputProps
//   extends Omit<React.ComponentProps<typeof Input>, "onChange"> {
//   onChange?: (values: number[]) => void;
// }

// function BymonthdayInput({ onChange, value, ...props }: BymonthdayInputProps) {
//   const [displayValue, setDisplayValue] = useState(value ?? "");
//   return (
//     <Input
//       type="text"
//       onChange={(e) => {
//         setDisplayValue(e.currentTarget.value);
//         const value = e.currentTarget.value
//           .trim()
//           .split(/[,\s*]/)
//           .filter((v) => v.length > 0)
//           .map((v) => Number(v));

//         onChange?.(value);
//       }}
//       value={displayValue}
//       {...props}
//     />
//   );
// }

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
    count: z.coerce.number().min(1).optional(),
  }),
});

const SPayLaterBillFormValues = BaseBillFormValues.extend({
  type: z.literal("spaylater"),
  spaylater: z.object({
    principalAmount: z.coerce.number().min(0, { message: "Principal amount must be positive" }),
    installmentMonths: z.enum(["3", "6", "12"]),
    interestRate: z.coerce.number().min(0).max(100),
    monthlyPayment: z.coerce.number().min(0),
    dtstart: z.coerce.date(),
  }),
});

const CreateBillFormValues = z.discriminatedUnion("type", [
  SingleBillFormValues,
  RecurringBillFormValues,
  SPayLaterBillFormValues,
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

  const [recurringEndsWith, setRecurringEndsWith] = useState<
    "never" | "until" | "count" | ({} & string)
  >("never");

  // Helper function to calculate SPayLater monthly payment
  const calculateMonthlyPayment = () => {
    const principal = parseFloat(String(form.getValues("spaylater.principalAmount"))) || 0;
    const months = parseInt(form.getValues("spaylater.installmentMonths") || "3");
    const rate = parseFloat(String(form.getValues("spaylater.interestRate"))) || 0;
    const totalAmount = principal * (1 + rate / 100);
    const monthly = totalAmount / months;
    form.setValue("spaylater.monthlyPayment", monthly);
  };

  const [formType, formRecurrenceType] = form.watch([
    "type",
    "recurrence.type",
  ]);

  async function handleSubmit(data: CreateBillFormValues) {
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
                    <Input type="text" placeholder="Title" {...field} />
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
                form.setValue("type", value as CreateBillFormValues["type"])
              }
            >
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="single">Once</TabsTrigger>
                <TabsTrigger value="recurring">Repeating</TabsTrigger>
                <TabsTrigger value="spaylater">SPayLater</TabsTrigger>
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
                  rules={{
                    min: 1,
                  }}
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
                <FormLabel>Ends...</FormLabel>
                <RadioGroup
                  value={recurringEndsWith}
                  onValueChange={(value) => setRecurringEndsWith(value)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="never" id="never" />
                    <Label htmlFor="never">Never</Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="count" id="count" />
                    <FormField
                      control={form.control}
                      name="recurrence.count"
                      rules={{
                        min: 1,
                      }}
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
                    <RadioGroupItem value="until" id="until" />
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
                {/* TODO: Every Month custom */}
                {/* <FormField
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
                        Enter the days of the month (1-31) when the bill is due,
                        separated by commas or spaces. For example: 1, 15, 30 or
                        1 15 30.
                      </FormDescription>
                    </FormItem>
                  )}
                /> */}
              </TabsContent>
              <TabsContent value="spaylater" className="space-y-4">
                <FormField
                  control={form.control}
                  name="spaylater.principalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter purchase amount"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            calculateMonthlyPayment();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="spaylater.installmentMonths"
                  defaultValue="3"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Installment Period</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          calculateMonthlyPayment();
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="3">3 Months</SelectItem>
                          <SelectItem value="6">6 Months</SelectItem>
                          <SelectItem value="12">12 Months</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="spaylater.interestRate"
                  defaultValue={0}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interest Rate (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="Enter interest rate"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            calculateMonthlyPayment();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="spaylater.monthlyPayment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Payment (Auto-calculated)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Monthly payment"
                          {...field}
                          value={field.value?.toFixed(2) ?? ""}
                          disabled
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="spaylater.dtstart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Payment Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          placeholder="First payment date"
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
            </Tabs>
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
