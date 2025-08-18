"use client";

import {
  addMonths,
  formatDate,
  isAfter,
  isBefore,
  isEqual,
  subDays,
} from "date-fns";
import { sumBy } from "lodash";
import { CalendarPlus, EyeIcon, EyeOffIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RRule } from "rrule";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import type { BillEvent } from "~/types";

function getFrequency(freq: "weekly" | "fortnightly" | "monthly") {
  const frequency = {
    weekly: { freq: RRule.WEEKLY },
    fortnightly: { freq: RRule.WEEKLY, interval: 2 },
    monthly: { freq: RRule.MONTHLY },
  };
  return frequency[freq];
}

function BillListCard({
  bills,
  payDate,
  after,
  isCurrent,
}: {
  bills: (BillEvent & { date: Date })[]; // TODO: & {date: Date} is a temporary fix
  payDate: Date;
  after: Date | null;
  isCurrent: boolean;
}) {
  const [excludedBills, setExcludedBills] = useState<string[]>([]);

  const totalAmount = useMemo(() => {
    return sumBy(
      bills.filter((bill) => !excludedBills.includes(bill._id)),
      (bill) => bill.amount ?? 0,
    );
  }, [bills, excludedBills]);

  return (
    <Card className={cn(isCurrent && "border-primary border-2")}>
      {/* // format by date month date, year */}
      <CardHeader>
        <CardTitle>
          {formatDate(payDate, "MMMM dd, yyyy")} -{" "}
          {after && formatDate(subDays(after, 1), "MMMM dd, yyyy")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-1">
        {bills.map((bill) => (
          <div key={bill._id} className="flex gap-2">
            <div className="mt-0.5 size-5">
              {excludedBills.includes(bill._id) ? (
                <EyeOffIcon
                  className="size-5 text-primary/50"
                  onClick={() => {
                    setExcludedBills((prev) => {
                      return prev.filter((id) => id !== bill._id);
                    });
                  }}
                />
              ) : (
                <EyeIcon
                  className="size-5"
                  onClick={() => {
                    setExcludedBills((prev) => {
                      return [...prev, bill._id];
                    });
                  }}
                />
              )}
            </div>
            <div className={cn("w-full")}>
              <div
                className={cn(
                  "font-medium",
                  excludedBills.includes(bill._id) && "text-sm text-primary/50",
                )}
              >
                {bill.title}
              </div>
              {!excludedBills.includes(bill._id) && (
                <div className="flex justify-between text-xs">
                  <div>{bill.date?.toLocaleDateString("en-PH")}</div>
                  <div>
                    {bill.amount?.toLocaleString("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }) ?? (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="justify-end">
        ~{" "}
        {totalAmount.toLocaleString("en-PH", {
          style: "currency",
          currency: "PHP",
        })}
      </CardFooter>
    </Card>
  );
}

export function BillList() {
  const { data: bills, isLoading: isBillLoading } = api.bill.getAll.useQuery();
  const { data: incomeProfile, isLoading: isIncomeProfileLoading } =
    api.income.getIncomeProfile.useQuery();

  const isLoading = isBillLoading || isIncomeProfileLoading;

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-9 w-24" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Card key={index} className="h-auto">
              <CardHeader>
                <CardTitle>
                  <Skeleton className="h-5 w-1/2" />
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="space-y-0.5">
                    <Skeleton className="h-5 w-1/2" />
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-1/4" />
                      <Skeleton className="h-4 w-1/4" />
                    </div>
                  </div>
                ))}
              </CardContent>
              <CardFooter className="justify-end">
                <Skeleton className="h-5 w-1/3" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!incomeProfile) return null;

  const payRule = new RRule({
    dtstart: incomeProfile.startDate,
    ...getFrequency(incomeProfile.payFrequency),
  });

  const currentPay = payRule.before(new Date(), true)!;
  const paysUntilFutureMonths = payRule.between(
    currentPay,
    addMonths(currentPay, 6),
    true,
  );

  const billsInPayPeriod = paysUntilFutureMonths.map((payDate) => {
    const currentBills = bills
      ?.map((bill) => {
        if (bill.type === "single") {
          if (
            (isAfter(bill.date, payDate) || isEqual(bill.date, payDate)) &&
            isBefore(bill.date, payRule.after(payDate)!)
          ) {
            return [bill];
          }

          return [];
        }

        const { recurrence } = bill;

        const billRule = new RRule({
          ...getFrequency(recurrence.type),
          interval: recurrence.interval,
          // need to pass payDate as fallback so it will capture the periods after that date
          // in the future, fallback won't be needed as we can just override the event when we can create bills.
          dtstart: recurrence.dtstart ?? payDate,
          bymonthday: recurrence.bymonthday,
          until: recurrence.until,
          count: recurrence.count,
        });

        // next pay date
        const nextPayDate = payRule.after(payDate)!;
        const billDates = billRule
          .between(payDate, nextPayDate, true)
          .filter(
            (date) =>
              (isAfter(date, payDate) || isEqual(date, payDate)) &&
              isBefore(date, nextPayDate),
          );

        return billDates.map((date) => ({
          ...bill,
          date,
        }));
      })
      .flat()
      .filter((bill) => bill !== null)
      .sort((a, b) => (isAfter(a.date, b.date) ? 1 : -1));

    return {
      payDate,
      bills: currentBills ?? [],
      after: payRule.after(payDate),
    };
  });

  return (
    <div className="space-y-4 p-6">
      <div>
        <Button asChild>
          <Link href={"/bills/create"}>
            New Bill <CalendarPlus />
          </Link>
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {billsInPayPeriod?.map(({ payDate, bills, after }, index) => (
          <BillListCard
            key={index}
            payDate={payDate}
            bills={bills}
            after={after}
            isCurrent={index === 0}
          />
        ))}
      </div>
    </div>
  );
}
