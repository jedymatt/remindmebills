"use client";

import { formatDate, isEqual, subDays } from "date-fns";
import { sumBy } from "lodash";
import { ChevronDown, ChevronUp, EyeClosedIcon, EyeIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { getBillsByPayPeriod } from "~/lib/bill-utils";
import { cn } from "~/lib/utils";
import type { BillEvent, IncomeProfile, PlaygroundBill } from "~/types";

function formatPHP(value: number, signDisplay?: "always") {
  return value.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    signDisplay,
  });
}

interface PlaygroundBillListCardProps {
  bills: (PlaygroundBill & { date: Date })[];
  payDate: Date;
  after: Date | null;
  isCurrent: boolean;
  ingoing: number;
  onBillClick: (billId: string) => void;
}

function PlaygroundBillListCard({
  bills,
  payDate,
  after,
  isCurrent,
  ingoing,
  onBillClick,
}: PlaygroundBillListCardProps) {
  const [excludedBills, setExcludedBills] = useState<string[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const outgoing = useMemo(
    () =>
      sumBy(
        bills.filter((bill) => !excludedBills.includes(bill.id)),
        (bill) => bill.amount ?? 0,
      ),
    [bills, excludedBills],
  );

  const balance = ingoing - outgoing;

  const toggleExclude = (billId: string) => {
    setExcludedBills((prev) =>
      prev.includes(billId)
        ? prev.filter((id) => id !== billId)
        : [...prev, billId],
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border",
        isCurrent
          ? "ring-primary/20 border-primary/50 ring-2"
          : "border-border",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-5 py-3.5",
          isCurrent ? "bg-primary/5" : "bg-muted/30",
        )}
      >
        <div>
          <div className="text-sm font-semibold">
            {formatDate(payDate, "MMM d")}
            {after && <> – {formatDate(subDays(after, 1), "MMM d, yyyy")}</>}
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {bills.length} {bills.length === 1 ? "bill" : "bills"}
          </div>
        </div>
        {isCurrent && (
          <span className="bg-primary text-primary-foreground rounded-full px-2.5 py-0.5 text-[11px] font-medium">
            Current
          </span>
        )}
      </div>

      {/* Bill list */}
      <div className="flex-1 px-5 py-2">
        {bills.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No bills this period
          </p>
        ) : (
          <ul className="divide-y">
            {bills.map((bill) => {
              const isExcluded = excludedBills.includes(bill.id);
              return (
                <li
                  key={bill.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 py-3 -mx-5 px-5 transition-colors hover:bg-muted/50",
                    isEqual(bill.date, payDate) &&
                      "text-yellow-700 dark:text-yellow-500",
                    isExcluded && "opacity-40",
                  )}
                  onClick={() => onBillClick(bill.id)}
                >
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExclude(bill.id);
                    }}
                  >
                    {isExcluded ? (
                      <EyeClosedIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {bill.title}
                    </div>
                    {!isExcluded && (
                      <div className="text-muted-foreground text-xs">
                        Due {formatDate(bill.date, "MMM d")}
                      </div>
                    )}
                  </div>
                  {!isExcluded && (
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {bill.amount != null ? (
                        formatPHP(bill.amount)
                      ) : (
                        <span className="text-muted-foreground text-xs font-normal">
                          —
                        </span>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Summary footer */}
      {bills.length > 0 && (
        <div className="bg-muted/30 border-t px-5 py-3">
          <button
            type="button"
            className="flex w-full items-center justify-between"
            onClick={() => setShowBreakdown((prev) => !prev)}
          >
            <span className="text-muted-foreground text-xs">Balance</span>
            <span className="flex items-center gap-1">
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  balance > 0
                    ? "text-green-600 dark:text-green-400"
                    : balance < 0
                      ? "text-red-600 dark:text-red-400"
                      : "",
                )}
              >
                {formatPHP(balance, "always")}
              </span>
              {showBreakdown ? (
                <ChevronUp className="text-muted-foreground size-3.5" />
              ) : (
                <ChevronDown className="text-muted-foreground size-3.5" />
              )}
            </span>
          </button>
          {showBreakdown && (
            <div className="text-muted-foreground mt-2 space-y-1 border-t pt-2 text-xs">
              <div className="flex justify-between">
                <span>Income</span>
                <span className="tabular-nums">
                  {formatPHP(ingoing, "always")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Bills</span>
                <span className="tabular-nums">
                  {formatPHP(-outgoing, "always")}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface PlaygroundBillListProps {
  bills: PlaygroundBill[];
  incomeProfile: IncomeProfile;
  onBillClick: (billId: string) => void;
}

export function PlaygroundBillList({
  bills,
  incomeProfile,
  onBillClick,
}: PlaygroundBillListProps) {
  // Convert PlaygroundBill[] to BillEvent[] shape for getBillsByPayPeriod
  const billsAsBillEvent = bills.map((bill) => ({
    ...bill,
    _id: bill.id, // Map id to _id for compatibility
  })) as unknown as BillEvent[];

  const billsInPayPeriod = getBillsByPayPeriod(billsAsBillEvent, incomeProfile);
  const ingoing = incomeProfile.amount ?? 0;

  // Map back to use `id` instead of `_id`
  const mappedPeriods = billsInPayPeriod.map((period) => ({
    ...period,
    bills: period.bills.map((bill) => ({
      ...bill,
      id: bill._id,
    })) as (PlaygroundBill & { date: Date })[],
  }));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {mappedPeriods.map(({ payDate, bills, after }, index) => (
        <PlaygroundBillListCard
          key={payDate.toISOString()}
          payDate={payDate}
          bills={bills}
          after={after}
          isCurrent={index === 0}
          ingoing={ingoing}
          onBillClick={onBillClick}
        />
      ))}
    </div>
  );
}
