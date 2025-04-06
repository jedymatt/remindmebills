"use client";

import { addMonths, formatDate, isAfter } from "date-fns";
import { sumBy } from "lodash";
import { RRule } from "rrule";
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

function getFrequency(freq: "weekly" | "fortnightly" | "monthly") {
  const frequency = {
    weekly: { freq: RRule.WEEKLY },
    fortnightly: { freq: RRule.WEEKLY, interval: 2 },
    monthly: { freq: RRule.MONTHLY },
  };
  return frequency[freq];
}

export function BillList() {
  const { data: bills, isLoading: isBillLoading } = api.bill.getAll.useQuery();
  const { data: incomeProfile, isLoading: isIncomeProfileLoading } =
    api.income.getIncomeProfile.useQuery();

  const isLoading = isBillLoading || isIncomeProfileLoading;

  if (isLoading) {
    return (
      <div className="grid gap-2 sm:grid-cols-4">
        {Array.from({ length: 3 }).map((_, index) => (
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
    );
  }

  if (!incomeProfile) {
    <div className="grid gap-2 sm:grid-cols-4">
      {bills?.map((bill) => (
        <Card key={bill._id}>
          <CardHeader>
            <CardTitle>{bill.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {bill.date?.toLocaleDateString("en-PH")}
            {bill.amount?.toLocaleString("en-PH", {
              style: "currency",
              currency: "PHP",
            })}
          </CardContent>
        </Card>
      ))}
    </div>;
  }

  const payRule = new RRule({
    dtstart: incomeProfile!.startDate,
    ...getFrequency(incomeProfile!.payFrequency),
  });

  const currentPay = payRule.before(new Date(), true)!;
  const paysUntilFutureMonths = payRule.between(
    currentPay,
    addMonths(currentPay, 3),
    true,
  );

  const billsInPayPeriod = paysUntilFutureMonths.map((payDate) => {
    const currentBills = bills
      ?.flatMap((bill) => {
        const { recurrence } = bill;

        if (!recurrence) {
          return [];
        }

        const billRule = new RRule({
          ...getFrequency(recurrence.type),
          interval: recurrence.interval,
          // need to pass payDate as fallback so it will capture the periods after that date
          // in the future, fallback won't be needed as we can just override the event when we can create bills.
          dtstart: recurrence.start ?? payDate,
          bymonthday: recurrence.daysOfMonth,
          until: recurrence.end,
        });

        // next pay date
        const nextPayDate = payRule.after(payDate)!;
        const billDates = billRule.between(payDate, nextPayDate);

        return billDates.map((date) => ({
          ...bill,
          date,
        }));
      })
      .filter((bill) => bill !== null)
      .sort((a, b) => (isAfter(a.date, b.date) ? 1 : -1));

    return {
      payDate,
      bills: currentBills ?? [],
      after: payRule.after(payDate),
    };
  });

  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {billsInPayPeriod?.map(({ payDate, bills, after }, index) => (
        <Card
          key={index}
          className={cn(index === 0 && "border-primary border-2")}
        >
          {/* // format by date month date, year */}
          <CardHeader>
            <CardTitle>
              {formatDate(payDate, "MMMM dd, yyyy")} -{" "}
              {after && formatDate(after, "MMMM dd, yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-1">
            {bills.map((bill) => (
              <div key={bill._id}>
                <div className="font-medium">{bill.title}</div>
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
              </div>
            ))}
          </CardContent>
          <CardFooter className="justify-end">
            ~{" "}
            {sumBy(bills, (bill) => bill.amount ?? 0).toLocaleString("en-PH", {
              style: "currency",
              currency: "PHP",
            })}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
