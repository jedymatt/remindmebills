"use client";

import { useMemo } from "react";
import {
  CalendarClock,
  FileText,
  PiggyBank,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { startOfDay } from "date-fns";
import { sumBy } from "lodash";
import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { createPayRule, computeBillsInPeriod } from "~/lib/bill-utils";
import {
  formatUtcDate,
  localDateToUtcDateOnly,
  utcDateOnlyToLocal,
} from "~/lib/date-utils";
import type { BillEvent, IncomeProfile } from "~/types";

function formatPHP(value: number) {
  return value.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

// Color the balance by sign so it agrees with the bill list's money semantics:
// teal reads as "ahead", rose as "short".
function balanceToneClass(balance: number) {
  if (balance > 0) return "text-teal-700 dark:text-teal-300";
  if (balance < 0) return "text-rose-600 dark:text-rose-400";
  return "text-ledger-ink";
}

type SummaryCard = {
  icon: LucideIcon;
  label: string;
  value: string;
  subtitle: string;
  mono: boolean;
  valueClassName?: string;
};

export function FinancialSummaryCards({
  incomeProfile,
  bills,
}: {
  incomeProfile: IncomeProfile;
  bills: BillEvent[];
}) {
  const { currentPeriodBills, nextBill } = useMemo(() => {
    const payRule = createPayRule(incomeProfile);
    const currentPay = payRule.before(localDateToUtcDateOnly(new Date()), true);
    if (!currentPay) return { currentPeriodBills: [], nextBill: null };

    const nextPayDate = payRule.after(currentPay);
    if (!nextPayDate) return { currentPeriodBills: [], nextBill: null };

    const periodBills = computeBillsInPeriod(bills, currentPay, nextPayDate);

    // Find the nearest upcoming bill (today or future). Compare on day
    // granularity: bill dates are at midnight, so `b.date >= new Date()` would
    // drop a bill due today once the wall clock passes midnight.
    const today = startOfDay(new Date());
    const upcoming = periodBills.find(
      (b) => utcDateOnlyToLocal(b.date) >= today,
    );

    return { currentPeriodBills: periodBills, nextBill: upcoming ?? null };
  }, [incomeProfile, bills]);

  const income = incomeProfile.amount ?? 0;
  const totalBillAmount = sumBy(currentPeriodBills, (b) => b.amount ?? 0);
  const balance = income - totalBillAmount;

  const cards: SummaryCard[] = [
    {
      icon: Wallet,
      label: "Income",
      value: income > 0 ? formatPHP(income) : "Not set",
      subtitle: `Per ${incomeProfile.payFrequency === "fortnightly" ? "fortnight" : incomeProfile.payFrequency === "weekly" ? "week" : "month"}`,
      mono: true,
    },
    {
      icon: FileText,
      label: "Total Bills",
      value: bills.length.toString(),
      subtitle: "Active bills",
      mono: true,
    },
    {
      icon: PiggyBank,
      label: "Balance",
      value: formatPHP(balance),
      subtitle: "This period",
      mono: true,
      valueClassName: balanceToneClass(balance),
    },
    {
      icon: CalendarClock,
      label: "Next Bill",
      value: nextBill?.title ?? "None",
      subtitle: nextBill ? formatUtcDate(nextBill.date, "MMM dd, yyyy") : "No upcoming bills",
      mono: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="flex flex-col gap-1 p-4">
            <div className="flex items-center gap-2">
              <card.icon className="text-ledger-muted size-4" />
              <span className="text-ledger-muted text-sm">{card.label}</span>
            </div>
            <span
              className={cn(
                "text-ledger-ink truncate text-xl font-semibold",
                card.mono && "font-mono tabular-nums",
                card.valueClassName,
              )}
            >
              {card.value}
            </span>
            <span className="text-ledger-muted text-xs">{card.subtitle}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
