"use client";

import { format } from "date-fns";
import { Calendar, Loader2, Repeat } from "lucide-react";
import { toast } from "sonner";
import { colorForOrder } from "~/lib/group-colors";
import { api } from "~/trpc/react";
import type { BillEvent } from "~/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface BillViewModeProps {
  bill: BillEvent;
  onEdit: () => void;
  onDelete: () => void;
}

// Build the InputBillSchema-shaped payload from a bill, swapping in a new groupId.
function buildBillUpdateData(bill: BillEvent, groupId: string | null) {
  const base = {
    title: bill.title,
    amount: bill.amount,
    groupId,
  };
  return bill.type === "single"
    ? { ...base, type: "single" as const, date: bill.date }
    : { ...base, type: "recurring" as const, recurrence: bill.recurrence };
}

export function BillViewMode({ bill, onEdit, onDelete }: BillViewModeProps) {
  const { data: groups } = api.group.getAll.useQuery();
  const utils = api.useUtils();
  const updateBill = api.bill.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.bill.getAll.invalidate(),
        utils.bill.getById.invalidate({ id: bill._id }),
      ]);
      toast.success("Group updated");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update group");
    },
  });

  const currentGroupId = bill.groupId ?? null;
  const currentGroup = currentGroupId
    ? groups?.find((g) => g._id === currentGroupId)
    : null;

  const handleGroupChange = (value: string) => {
    const newGroupId = value === "__none__" ? null : value;
    if (newGroupId === currentGroupId) return;
    updateBill.mutate({
      id: bill._id,
      data: buildBillUpdateData(bill, newGroupId),
    });
  };

  return (
    <div className="space-y-6">
      {/* Bill Type Badge */}
      {bill.type === "recurring" && (
        <div>
          <Badge variant="secondary" className="gap-1">
            <Repeat className="size-3" />
            Recurring Bill
          </Badge>
        </div>
      )}

      {/* Bill Details */}
      <div className="space-y-4">
        <div>
          <label className="text-muted-foreground text-sm">Title</label>
          <p className="text-lg font-medium">{bill.title}</p>
        </div>

        <div>
          <label className="text-muted-foreground text-sm">Amount</label>
          <p className="text-lg font-medium">
            {bill.amount != null ? (
              <>
                ₱
                {bill.amount.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </>
            ) : (
              <span className="text-muted-foreground text-sm">Not set</span>
            )}
          </p>
        </div>

        <div>
          <label className="text-muted-foreground text-sm">Group</label>
          <div className="flex items-center gap-2">
            <Select
              value={currentGroupId ?? "__none__"}
              onValueChange={handleGroupChange}
              disabled={updateBill.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {currentGroup ? (
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block size-3 rounded-full"
                        style={{
                          backgroundColor: colorForOrder(currentGroup.order),
                        }}
                      />
                      {currentGroup.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No group</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No group</SelectItem>
                {(groups ?? []).map((g) => (
                  <SelectItem key={g._id} value={g._id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block size-3 rounded-full"
                        style={{ backgroundColor: colorForOrder(g.order) }}
                      />
                      {g.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {updateBill.isPending && (
              <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
            )}
          </div>
        </div>

        {bill.type === "single" && (
          <div>
            <label className="text-muted-foreground text-sm">Due Date</label>
            <div className="flex items-center gap-2">
              <Calendar className="text-muted-foreground size-4" />
              <p className="font-medium">{format(bill.date, "PPP")}</p>
            </div>
          </div>
        )}

        {bill.type === "recurring" && (
          <div className="space-y-3">
            <div>
              <label className="text-muted-foreground text-sm">
                Recurrence Pattern
              </label>
              <p className="font-medium">
                Every {bill.recurrence.interval}{" "}
                {bill.recurrence.type === "weekly"
                  ? bill.recurrence.interval === 1
                    ? "week"
                    : "weeks"
                  : bill.recurrence.interval === 1
                    ? "month"
                    : "months"}
              </p>
            </div>

            {bill.recurrence.dtstart && (
              <div>
                <label className="text-muted-foreground text-sm">
                  Start Date
                </label>
                <div className="flex items-center gap-2">
                  <Calendar className="text-muted-foreground size-4" />
                  <p className="font-medium">
                    {format(bill.recurrence.dtstart, "PPP")}
                  </p>
                </div>
              </div>
            )}

            {bill.recurrence.until && (
              <div>
                <label className="text-muted-foreground text-sm">
                  End Date
                </label>
                <div className="flex items-center gap-2">
                  <Calendar className="text-muted-foreground size-4" />
                  <p className="font-medium">
                    {format(bill.recurrence.until, "PPP")}
                  </p>
                </div>
              </div>
            )}

            {bill.recurrence.count && (
              <div>
                <label className="text-muted-foreground text-sm">
                  Occurrences
                </label>
                <p className="font-medium">
                  {bill.recurrence.count}{" "}
                  {bill.recurrence.count === 1 ? "time" : "times"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="destructive" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
