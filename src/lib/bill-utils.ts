import { addMonths, isAfter, isBefore, isEqual } from "date-fns";
import { RRule } from "rrule";
import type { BillEvent, IncomeProfile } from "~/types";

export function getFrequency(freq: "weekly" | "fortnightly" | "monthly") {
  const frequency = {
    weekly: { freq: RRule.WEEKLY },
    fortnightly: { freq: RRule.WEEKLY, interval: 2 },
    monthly: { freq: RRule.MONTHLY },
  };
  return frequency[freq];
}

export function createPayRule(incomeProfile: IncomeProfile) {
  return new RRule({
    dtstart: incomeProfile.startDate,
    ...getFrequency(incomeProfile.payFrequency),
  });
}

export function computeBillsInPeriod(
  bills: BillEvent[],
  periodStart: Date,
  periodEnd: Date,
) {
  return bills
    .map((bill) => {
      if (bill.type === "single") {
        if (
          (isAfter(bill.date, periodStart) ||
            isEqual(bill.date, periodStart)) &&
          isBefore(bill.date, periodEnd)
        ) {
          return [{ ...bill, date: bill.date }];
        }
        return [];
      }

      const { recurrence } = bill;

      const billRule = new RRule({
        ...getFrequency(recurrence.type),
        interval: recurrence.interval,
        dtstart: recurrence.dtstart ?? periodStart,
        bymonthday: recurrence.bymonthday,
        until: recurrence.until,
        count: recurrence.count,
      });

      const billDates = billRule
        .between(periodStart, periodEnd, true)
        .filter(
          (date) =>
            (isAfter(date, periodStart) || isEqual(date, periodStart)) &&
            isBefore(date, periodEnd),
        );

      return billDates.map((date) => ({
        ...bill,
        date,
      }));
    })
    .flat()
    .filter((bill) => bill !== null)
    .sort((a, b) => (isAfter(a.date, b.date) ? 1 : -1));
}

export function getBillsByPayPeriod(
  bills: BillEvent[],
  incomeProfile: IncomeProfile,
  monthsAhead = 6,
) {
  const payRule = createPayRule(incomeProfile);
  const currentPay = payRule.before(new Date(), true)!;
  const paysUntilFuture = payRule.between(
    currentPay,
    addMonths(currentPay, monthsAhead),
    true,
  );

  return paysUntilFuture.map((payDate) => {
    const nextPayDate = payRule.after(payDate)!;
    const periodBills = computeBillsInPeriod(bills, payDate, nextPayDate);

    return {
      payDate,
      bills: periodBills,
      after: payRule.after(payDate),
    };
  });
}
