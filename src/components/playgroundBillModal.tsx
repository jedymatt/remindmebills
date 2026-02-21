"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { PlaygroundBill, PlaygroundBillData } from "~/types";
import {
  BillFormFields,
  BillFormValuesSchema,
  type BillFormValues,
} from "~/components/billFormFields";
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
      <BillFormFields
        form={form}
        recurringEndsWith={recurringEndsWith}
        onRecurringEndsWithChange={handleRecurringEndsWithChange}
        formId="edit-playground-bill-form"
        onSubmit={handleSubmit}
      />

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
