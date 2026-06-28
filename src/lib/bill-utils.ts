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

/**
 * Monthly recurrences anchor on the day-of-month taken from `dtstart`. RRule's
 * default is to SKIP months that lack that day — a bill on the 31st silently
 * disappears in February, April, etc. Instead we clamp to the last day of short
 * months (a "31st" bill lands on Feb 28, Apr 30, …) so it never vanishes. Days
 * ≤ 28 exist in every month, so this matches RRule's output for them.
 *
 * Dates are built in UTC to stay in the same frame as the UTC-midnight `dtstart`
 * the rest of the scheduler uses. `interval`/`until`/`count` mirror RRule:
 * `count` counts occurrences from `dtstart`; `until` is inclusive.
 */
function monthlyOccurrencesInPeriod(
  dtstart: Date,
  interval: number,
  until: Date | undefined,
  count: number | undefined,
  periodStart: Date,
  periodEnd: Date,
) {
  const targetDay = dtstart.getUTCDate();
  const startYear = dtstart.getUTCFullYear();
  const startMonth = dtstart.getUTCMonth();
  const step = Math.max(1, interval);

  const occurrences: Date[] = [];
  let emitted = 0;
  // Occurrences increase monotonically, so we stop once past the window; the
  // iteration cap is only a defensive backstop against pathological input.
  for (let i = 0; i < 12_000; i++) {
    if (count != null && emitted >= count) break;

    const monthIndex = startMonth + i * step;
    const year = startYear + Math.floor(monthIndex / 12);
    const month = monthIndex % 12;
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const occ = new Date(
      Date.UTC(year, month, Math.min(targetDay, lastDayOfMonth)),
    );

    if (until != null && isAfter(occ, until)) break;
    emitted++;

    if (
      (isAfter(occ, periodStart) || isEqual(occ, periodStart)) &&
      isBefore(occ, periodEnd)
    ) {
      occurrences.push(occ);
    }
    if (!isBefore(occ, periodEnd)) break;
  }
  return occurrences;
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
      const dtstart = recurrence.dtstart ?? periodStart;

      // Monthly bills with no explicit bymonthday use the clamping generator so
      // a day missing from a short month falls on that month's last day instead
      // of being skipped. Weekly/fortnightly (and any explicit bymonthday) keep
      // using RRule.
      let billDates: Date[];
      if (
        recurrence.type === "monthly" &&
        (recurrence.bymonthday == null || recurrence.bymonthday.length === 0)
      ) {
        billDates = monthlyOccurrencesInPeriod(
          dtstart,
          recurrence.interval,
          recurrence.until,
          recurrence.count,
          periodStart,
          periodEnd,
        );
      } else {
        const billRule = new RRule({
          ...getFrequency(recurrence.type),
          interval: recurrence.interval,
          dtstart,
          bymonthday: recurrence.bymonthday,
          until: recurrence.until,
          count: recurrence.count,
        });

        billDates = billRule
          .between(periodStart, periodEnd, true)
          .filter(
            (date) =>
              (isAfter(date, periodStart) || isEqual(date, periodStart)) &&
              isBefore(date, periodEnd),
          );
      }

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

export function getPayPeriodsByCount(
  bills: BillEvent[],
  incomeProfile: IncomeProfile,
  count: number,
) {
  const payRule = createPayRule(incomeProfile);
  const payDates: Date[] = [];
  let currentPay = payRule.before(new Date(), true)!;
  for (let i = 0; i < count; i++) {
    payDates.push(currentPay);
    currentPay = payRule.after(currentPay)!;
  }

  return payDates.map((payDate) => {
    const nextPayDate = payRule.after(payDate)!;
    const periodBills = computeBillsInPeriod(bills, payDate, nextPayDate);

    return {
      payDate,
      bills: periodBills,
      after: payRule.after(payDate),
    };
  });
}
