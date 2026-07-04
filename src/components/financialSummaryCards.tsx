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
import { buildPaidLookup, isOccurrencePaid } from "~/lib/payment-utils";
import { api } from "~/trpc/react";
import type { BillEvent, IncomeProfile } from "~/types";

function formatPHP(value: number) {
  return value.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

// Fully paid reads as "all clear" (teal); anything still owed stays neutral ink.
function remainingToneClass(remaining: number) {
  return remaining === 0
    ? "text-teal-700 dark:text-teal-300"
    : "text-ledger-ink";
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
  const { data: payments } = api.payment.getAll.useQuery();
  const paidKeys = useMemo(() => buildPaidLookup(payments ?? []), [payments]);

  const { currentPeriodBills, nextBill } = useMemo(() => {
    const payRule = createPayRule(incomeProfile);
    const currentPay = payRule.before(localDateToUtcDateOnly(new Date()), true);
    if (!currentPay) return { currentPeriodBills: [], nextBill: null };

    const nextPayDate = payRule.after(currentPay);
    if (!nextPayDate) return { currentPeriodBills: [], nextBill: null };

    const periodBills = computeBillsInPeriod(bills, currentPay, nextPayDate);

    // Find the nearest upcoming *unpaid* bill (today or future). Compare on day
    // granularity: bill dates are at midnight, so `b.date >= new Date()` would
    // drop a bill due today once the wall clock passes midnight.
    const today = startOfDay(new Date());
    const upcoming = periodBills.find(
      (b) =>
        utcDateOnlyToLocal(b.date) >= today &&
        !isOccurrencePaid(paidKeys, b._id, b.date),
    );

    return { currentPeriodBills: periodBills, nextBill: upcoming ?? null };
  }, [incomeProfile, bills, paidKeys]);

  const income = incomeProfile.amount ?? 0;
  // What's still owed this period — paid occurrences drop out. This is a plain
  // remaining-to-pay total (no income term), so it stays coherent and shrinks
  // toward ₱0 as bills are marked paid, whatever the income is.
  const remaining = sumBy(
    currentPeriodBills.filter((b) => !isOccurrencePaid(paidKeys, b._id, b.date)),
    (b) => b.amount ?? 0,
  );

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
      label: "Remaining",
      value: formatPHP(remaining),
      subtitle: "Left to pay this period",
      mono: true,
      valueClassName: remainingToneClass(remaining),
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
