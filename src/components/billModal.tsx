"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "~/trpc/react";
import type { BillEvent } from "~/types";
import { BillViewMode } from "./billViewMode";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
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
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface BillModalProps {
  billId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

function BillEditMode({
  bill,
  onCancel,
  onSaveSuccess,
}: {
  bill: BillEvent;
  onCancel: () => void;
  onSaveSuccess: () => void;
}) {
  const form = useForm<BillFormValues>({
    resolver: zodResolver(BillFormValuesSchema),
    defaultValues: {
      title: bill.title,
      amount: bill.amount,
      type: bill.type,
      ...(bill.type === "single"
        ? { date: bill.date }
        : {
            recurrence: {
              type: bill.recurrence.type,
              interval: bill.recurrence.interval,
              bymonthday: bill.recurrence.bymonthday,
              dtstart: bill.recurrence.dtstart,
              until: bill.recurrence.until,
              count: bill.recurrence.count,
            },
          }),
    } as BillFormValues,
  });

  const utils = api.useUtils();
  const updateBill = api.bill.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.bill.getAll.invalidate(),
        utils.bill.getById.invalidate({ id: bill._id }),
      ]);
      toast.success("Bill updated successfully");
      onSaveSuccess();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update bill");
    },
  });

  const [recurringEndsWith, setRecurringEndsWith] = useState<
    "never" | "until" | "count"
  >(
    bill.type === "recurring"
      ? bill.recurrence.count
        ? "count"
        : bill.recurrence.until
          ? "until"
          : "never"
      : "never",
  );

  const [formType, formRecurrenceType] = useWatch({
    name: ["type", "recurrence.type"],
    control: form.control,
  });

  async function handleSubmit(data: BillFormValues) {
    await updateBill.mutateAsync({
      id: bill._id,
      data,
    });
  }

  return (
    <div>
      <Form {...form}>
        <form
          id="edit-bill-form"
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4"
        >
          {/* Title Field */}
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

          {/* Amount Field */}
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

          {/* Type Tabs - Same as CreateBillForm */}
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

            {/* Single Bill Tab */}
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

            {/* Recurring Bill Tab - Complete form like CreateBillForm */}
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
                  <RadioGroupItem value="never" id="never" />
                  <Label htmlFor="never">Never</Label>
                </div>

                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="count" id="count" />
                  <FormField
                    control={form.control}
                    name="recurrence.count"
                    rules={{ min: 1 }}
                    defaultValue={1}
                    disabled={recurringEndsWith !== "count"}
                    render={({ field }) => (
                      <FormItem className="pt-0.5">
                        <FormLabel onClick={() => setRecurringEndsWith("count")}>
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
                        <FormLabel onClick={() => setRecurringEndsWith("until")}>
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

      {/* Action Buttons */}
      <div className="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={updateBill.isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="edit-bill-form"
          disabled={updateBill.isPending}
        >
          {updateBill.isPending && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

export function BillModal({ billId, open, onOpenChange }: BillModalProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    data: bill,
    isLoading,
    error,
  } = api.bill.getById.useQuery({ id: billId! }, { enabled: !!billId });

  const utils = api.useUtils();
  const deleteBill = api.bill.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.bill.getAll.invalidate(),
        utils.bill.getById.invalidate({ id: bill!._id }),
      ]);
      toast.success("Bill deleted successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      if (error.data?.code === "NOT_FOUND") {
        toast.error("This bill no longer exists");
        onOpenChange(false);
      } else {
        toast.error(error.message || "Failed to delete bill");
      }
    },
  });

  // Reset mode when modal opens/closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setMode("view");
      setShowDeleteDialog(false);
    }
    onOpenChange(open);
  };

  const handleEdit = () => {
    setMode("edit");
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleCancelEdit = () => {
    setMode("view");
  };

  const handleSaveSuccess = () => {
    setMode("view");
  };

  // Handle NOT_FOUND error from getById query
  if (error) {
    if (error.data?.code === "NOT_FOUND") {
      toast.error("This bill no longer exists");
      onOpenChange(false);
    } else {
      toast.error("Failed to load bill");
    }
    return null;
  }

  if (!billId) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {mode === "view" ? "Bill Details" : "Edit Bill"}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-6">
              {/* Badge skeleton for recurring bills */}
              <Skeleton className="h-6 w-32" />

              {/* Bill details */}
              <div className="space-y-4">
                <div>
                  <Skeleton className="mb-2 h-4 w-12" />
                  <Skeleton className="h-6 w-48" />
                </div>
                <div>
                  <Skeleton className="mb-2 h-4 w-16" />
                  <Skeleton className="h-6 w-32" />
                </div>
                <div>
                  <Skeleton className="mb-2 h-4 w-20" />
                  <Skeleton className="h-5 w-40" />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-2">
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-10 w-20" />
              </div>
            </div>
          ) : bill ? (
            mode === "view" ? (
              <BillViewMode
                bill={bill}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ) : (
              <BillEditMode
                bill={bill}
                onCancel={handleCancelEdit}
                onSaveSuccess={handleSaveSuccess}
              />
            )
          ) : (
            <p className="text-muted-foreground text-center">Bill not found</p>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bill</AlertDialogTitle>
            <AlertDialogDescription>
              {bill?.type === "recurring"
                ? `Are you sure you want to delete "${bill.title}"? This will delete all occurrences of this recurring bill. This action cannot be undone.`
                : `Are you sure you want to delete "${bill?.title}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (bill) {
                  await deleteBill.mutateAsync({ id: bill._id });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteBill.isPending}
            >
              {deleteBill.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
