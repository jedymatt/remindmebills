"use client";

import { format } from "date-fns";
import { Calendar, Repeat } from "lucide-react";
import type { BillEvent } from "~/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

interface BillViewModeProps {
  bill: BillEvent;
  onEdit: () => void;
  onDelete: () => void;
}

export function BillViewMode({ bill, onEdit, onDelete }: BillViewModeProps) {
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
