"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type { PlaygroundBill, PlaygroundBillData } from "~/types";
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
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

function formatPHP(value: number) {
  return value.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

function PlaygroundBillViewMode({
  bill,
  onEdit,
  onDelete,
}: {
  bill: PlaygroundBill;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-6">
      {bill.type === "recurring" && (
        <Badge variant="secondary">Recurring</Badge>
      )}

      <div className="space-y-4">
        <div>
          <p className="text-muted-foreground text-sm">Title</p>
          <p className="text-lg font-medium">{bill.title}</p>
        </div>

        <div>
          <p className="text-muted-foreground text-sm">Amount</p>
          <p className="text-lg font-medium">
            {bill.amount != null ? formatPHP(bill.amount) : "Not set"}
          </p>
        </div>

        {bill.type === "single" ? (
          <div>
            <p className="text-muted-foreground text-sm">Due Date</p>
            <p className="font-medium">{format(bill.date, "MMMM d, yyyy")}</p>
          </div>
        ) : (
          <div>
            <p className="text-muted-foreground text-sm">Schedule</p>
            <p className="font-medium">
              Every {bill.recurrence.interval}{" "}
              {bill.recurrence.type === "weekly" ? "week" : "month"}
              {bill.recurrence.interval !== 1 ? "s" : ""}
            </p>
            {bill.recurrence.dtstart && (
              <p className="text-muted-foreground text-sm">
                Starting {format(bill.recurrence.dtstart, "MMMM d, yyyy")}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onDelete}>
          <Trash2 className="mr-1 size-4" />
          Delete
        </Button>
        <Button size="sm" onClick={onEdit}>
          <Pencil className="mr-1 size-4" />
          Edit
        </Button>
      </div>
    </div>
  );
}

function PlaygroundBillEditMode({
  bill,
  onCancel,
  onSave,
}: {
  bill: PlaygroundBill;
  onCancel: () => void;
  onSave: (data: PlaygroundBillData) => void;
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

  const handleRecurringEndsWithChange = (
    value: "never" | "until" | "count",
  ) => {
    setRecurringEndsWith(value);
    if (value !== "count") form.setValue("recurrence.count", undefined);
    if (value !== "until") form.setValue("recurrence.until", undefined);
  };

  const handleSubmit = (data: BillFormValues) => {
    onSave(data);
  };

  return (
    <div>
      <Form {...form}>
        <form
          id="edit-playground-bill-form"
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
                  handleRecurringEndsWithChange(
                    value as typeof recurringEndsWith,
                  )
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="never" id="pg-edit-never" />
                  <Label htmlFor="pg-edit-never">Never</Label>
                </div>

                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="count" id="pg-edit-count" />
                  <FormField
                    control={form.control}
                    name="recurrence.count"
                    rules={{ min: 1 }}
                    defaultValue={1}
                    disabled={recurringEndsWith !== "count"}
                    render={({ field }) => (
                      <FormItem className="pt-0.5">
                        <FormLabel
                          onClick={() =>
                            handleRecurringEndsWithChange("count")
                          }
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
                  <RadioGroupItem value="until" id="pg-edit-until" />
                  <FormField
                    control={form.control}
                    name="recurrence.until"
                    disabled={recurringEndsWith !== "until"}
                    render={({ field }) => (
                      <FormItem className="pt-0.5">
                        <FormLabel
                          onClick={() =>
                            handleRecurringEndsWithChange("until")
                          }
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

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" form="edit-playground-bill-form">
          Save Changes
        </Button>
      </div>
    </div>
  );
}

interface PlaygroundBillModalProps {
  bill: PlaygroundBill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, data: PlaygroundBillData) => void;
  onDelete: (id: string) => void;
}

export function PlaygroundBillModal({
  bill,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: PlaygroundBillModalProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setMode("view");
      setShowDeleteDialog(false);
    }
    onOpenChange(open);
  };

  const handleSave = (data: PlaygroundBillData) => {
    if (bill) {
      onUpdate(bill.id, data);
      setMode("view");
    }
  };

  const handleConfirmDelete = () => {
    if (bill) {
      onDelete(bill.id);
      onOpenChange(false);
    }
  };

  if (!bill) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {mode === "view" ? "Bill Details" : "Edit Bill"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {mode === "view"
                ? "View and manage this playground bill."
                : "Edit the details of this playground bill."}
            </DialogDescription>
          </DialogHeader>

          {mode === "view" ? (
            <PlaygroundBillViewMode
              bill={bill}
              onEdit={() => setMode("edit")}
              onDelete={() => setShowDeleteDialog(true)}
            />
          ) : (
            <PlaygroundBillEditMode
              bill={bill}
              onCancel={() => setMode("view")}
              onSave={handleSave}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bill</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &quot;{bill.title}&quot; from the playground?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
