"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { formatUtcDate } from "~/lib/date-utils";
import { Button } from "~/components/ui/button";
import { EditIncomeProfileDialog } from "./editIncomeProfileDialog";
import type { IncomeProfile } from "~/types";

// Capitalising the stored value cannot produce "Semi-monthly" from
// "semimonthly", and a Record keyed on the union makes a new frequency a
// compile error here rather than a mis-rendered label.
const FREQUENCY_LABELS: Record<IncomeProfile["payFrequency"], string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  semimonthly: "Semi-monthly",
};

export function IncomeProfileSection({
  incomeProfile,
}: {
  incomeProfile: IncomeProfile;
}) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div>
          <span className="text-muted-foreground">Pay Frequency: </span>
          <span className="font-medium">
            {FREQUENCY_LABELS[incomeProfile.payFrequency]}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Start Date: </span>
          <span className="font-medium">
            {formatUtcDate(incomeProfile.startDate, "MMM dd, yyyy")}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Income: </span>
          <span className="font-medium">
            {incomeProfile.amount
              ? incomeProfile.amount.toLocaleString("en-PH", {
                  style: "currency",
                  currency: "PHP",
                })
              : "Not set"}
          </span>
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)}>
        <Pencil className="size-4" />
      </Button>
      <EditIncomeProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        currentProfile={incomeProfile}
      />
    </div>
  );
}
