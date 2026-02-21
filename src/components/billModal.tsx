"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import type { BillEvent } from "~/types";
import {
  BillFormFields,
  BillFormValuesSchema,
  type BillFormValues,
} from "~/components/billFormFields";
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
import { Skeleton } from "./ui/skeleton";

interface BillModalProps {
  billId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

  const handleRecurringEndsWithChange = (
    value: "never" | "until" | "count",
  ) => {
    setRecurringEndsWith(value);
    if (value !== "count") form.setValue("recurrence.count", undefined);
    if (value !== "until") form.setValue("recurrence.until", undefined);
  };

  async function handleSubmit(data: BillFormValues) {
    await updateBill.mutateAsync({
      id: bill._id,
      data,
    });
  }

  return (
    <div>
      <BillFormFields
        form={form}
        recurringEndsWith={recurringEndsWith}
        onRecurringEndsWithChange={handleRecurringEndsWithChange}
        formId="edit-bill-form"
        onSubmit={handleSubmit}
      />

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
