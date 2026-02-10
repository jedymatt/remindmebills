"use client";

import { useMemo } from "react";
import {
  CalendarClock,
  FileText,
  PiggyBank,
  Wallet,
} from "lucide-react";
import { formatDate } from "date-fns";
import { sumBy } from "lodash";
import { Card, CardContent } from "~/components/ui/card";
import { createPayRule, computeBillsInPeriod } from "~/lib/bill-utils";
import type { BillEvent, IncomeProfile } from "~/types";

function formatPHP(value: number) {
  return value.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

export function FinancialSummaryCards({
  incomeProfile,
  bills,
}: {
  incomeProfile: IncomeProfile;
  bills: BillEvent[];
}) {
  const { currentPeriodBills, nextBill } = useMemo(() => {
    const payRule = createPayRule(incomeProfile);
    const currentPay = payRule.before(new Date(), true);
    if (!currentPay) return { currentPeriodBills: [], nextBill: null };

    const nextPayDate = payRule.after(currentPay);
    if (!nextPayDate) return { currentPeriodBills: [], nextBill: null };

    const periodBills = computeBillsInPeriod(bills, currentPay, nextPayDate);

    // Find the nearest upcoming bill (today or future)
    const now = new Date();
    const upcoming = periodBills.find(
      (b) => b.date >= now,
    );

    return { currentPeriodBills: periodBills, nextBill: upcoming ?? null };
  }, [incomeProfile, bills]);

  const income = incomeProfile.amount ?? 0;
  const totalBillAmount = sumBy(currentPeriodBills, (b) => b.amount ?? 0);
  const balance = income - totalBillAmount;

  const cards = [
    {
      icon: Wallet,
      label: "Income",
      value: income > 0 ? formatPHP(income) : "Not set",
      subtitle: `Per ${incomeProfile.payFrequency === "fortnightly" ? "fortnight" : incomeProfile.payFrequency === "weekly" ? "week" : "month"}`,
    },
    {
      icon: FileText,
      label: "Total Bills",
      value: bills.length.toString(),
      subtitle: "Active bills",
    },
    {
      icon: PiggyBank,
      label: "Balance",
      value: formatPHP(balance),
      subtitle: "This period",
    },
    {
      icon: CalendarClock,
      label: "Next Bill",
      value: nextBill?.title ?? "None",
      subtitle: nextBill ? formatDate(nextBill.date, "MMM dd, yyyy") : "No upcoming bills",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="flex flex-col gap-1 p-4">
            <div className="flex items-center gap-2">
              <card.icon className="text-muted-foreground size-4" />
              <span className="text-muted-foreground text-sm">{card.label}</span>
            </div>
            <span className="truncate text-xl font-semibold">{card.value}</span>
            <span className="text-muted-foreground text-xs">{card.subtitle}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
