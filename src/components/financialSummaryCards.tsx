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
import {
  computeBillsInPeriod,
  createPayRule,
  partitionBills,
} from "~/lib/bill-utils";
import { groupStatements } from "~/lib/bnpl-utils";
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
  const { data: accounts } = api.bnpl.getAll.useQuery();

  const { remaining, nextItem, billCount } = useMemo(() => {
    const payRule = createPayRule(incomeProfile);
    const currentPay = payRule.before(localDateToUtcDateOnly(new Date()), true);
    if (!currentPay) return { remaining: 0, nextItem: null, billCount: 0 };

    const nextPayDate = payRule.after(currentPay);
    if (!nextPayDate) return { remaining: 0, nextItem: null, billCount: 0 };

    const periodRows = computeBillsInPeriod(bills, currentPay, nextPayDate);
    const { bills: ordinaryRows, installments } = partitionBills(periodRows);
    const statements = groupStatements(installments, accounts ?? []);

    // Remaining counts every unpaid peso, installments included — a statement
    // is unpaid until all of its purchases are.
    const remainingBills = sumBy(ordinaryRows, (b) =>
      isOccurrencePaid(paidKeys, b._id, b.date) ? 0 : (b.amount ?? 0),
    );
    const remainingStatements = sumBy(statements, (s) =>
      s.billIds.every((id) => isOccurrencePaid(paidKeys, id, s.date))
        ? 0
        : s.amount,
    );

    // "Total Bills" counts a statement as one obligation, not N purchases —
    // one payment is what the user actually makes.
    const { bills: ordinaryAll, installments: installmentsAll } =
      partitionBills(bills);
    const accountsWithPurchases = new Set(
      installmentsAll.map((b) => b.bnplAccountId),
    );

    // Nearest upcoming unpaid obligation of either kind.
    const today = startOfDay(new Date());
    const upcomingBill = ordinaryRows.find(
      (b) =>
        utcDateOnlyToLocal(b.date) >= today &&
        !isOccurrencePaid(paidKeys, b._id, b.date),
    );
    const upcomingStatement = statements.find(
      (s) =>
        utcDateOnlyToLocal(s.date) >= today &&
        !s.billIds.every((id) => isOccurrencePaid(paidKeys, id, s.date)),
    );

    const candidates: Array<{ title: string; date: Date }> = [];
    if (upcomingBill)
      candidates.push({ title: upcomingBill.title, date: upcomingBill.date });
    if (upcomingStatement)
      candidates.push({
        title: upcomingStatement.accountName,
        date: upcomingStatement.date,
      });
    candidates.sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      remaining: remainingBills + remainingStatements,
      nextItem: candidates[0] ?? null,
      billCount: ordinaryAll.length + accountsWithPurchases.size,
    };
  }, [incomeProfile, bills, paidKeys, accounts]);

  const income = incomeProfile.amount ?? 0;

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
      value: billCount.toString(),
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
      value: nextItem?.title ?? "None",
      subtitle: nextItem
        ? formatUtcDate(nextItem.date, "MMM dd, yyyy")
        : "No upcoming bills",
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
