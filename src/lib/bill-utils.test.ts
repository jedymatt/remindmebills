import { describe, expect, it } from "vitest";
import { createPayRule, partitionBills } from "~/lib/bill-utils";
import type { IncomeProfile, PayDay } from "~/types";

describe("partitionBills", () => {
  it("splits installments from ordinary bills", () => {
    const rows = [
      { _id: "a" },
      { _id: "b", bnplAccountId: "acc1" },
      { _id: "c", bnplAccountId: null },
      { _id: "d", bnplAccountId: "acc2" },
    ];

    const { bills, installments } = partitionBills(rows);

    expect(bills.map((b) => b._id)).toEqual(["a", "c"]);
    expect(installments.map((b) => b._id)).toEqual(["b", "d"]);
  });

  it("treats an empty-string account id as an ordinary bill", () => {
    // Defensive: an empty string is not a usable ObjectId, so it must not be
    // routed into the installment bucket where it would be grouped by a
    // meaningless key.
    const { bills, installments } = partitionBills([
      { _id: "a", bnplAccountId: "" },
    ]);

    expect(bills.map((b) => b._id)).toEqual(["a"]);
    expect(installments).toEqual([]);
  });

  it("preserves input order within each bucket", () => {
    const rows = [
      { _id: "1", bnplAccountId: "x" },
      { _id: "2" },
      { _id: "3", bnplAccountId: "x" },
      { _id: "4" },
    ];

    const { bills, installments } = partitionBills(rows);

    expect(bills.map((b) => b._id)).toEqual(["2", "4"]);
    expect(installments.map((b) => b._id)).toEqual(["1", "3"]);
  });

  it("returns two empty buckets for empty input", () => {
    expect(partitionBills([])).toEqual({ bills: [], installments: [] });
  });
});

/** UTC-midnight date, in the frame the scheduler works in. */
const utc = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d));
const iso = (d: Date) => d.toISOString().slice(0, 10);

const semiMonthly = (
  payDays: [PayDay, PayDay],
  startDate = utc(2026, 1, 1),
): IncomeProfile => ({ payFrequency: "semimonthly", payDays, startDate });

describe("createPayRule — semi-monthly", () => {
  it('resolves "last" to the final day of each month', () => {
    const schedule = createPayRule(semiMonthly([15, "last"]));

    const dates = schedule.between(utc(2026, 1, 1), utc(2026, 4, 1), true);

    expect(dates.map(iso)).toEqual([
      "2026-01-15",
      "2026-01-31",
      "2026-02-15",
      "2026-02-28",
      "2026-03-15",
      "2026-03-31",
    ]);
  });

  it("clamps a 30th payday to the last day of a short month", () => {
    // The case rrule gets wrong: `bymonthday: [15, 30]` SKIPS February rather
    // than clamping, collapsing two pay periods into one month-long period.
    const schedule = createPayRule(semiMonthly([15, 30]));

    const dates = schedule.between(utc(2026, 1, 1), utc(2026, 4, 1), true);

    expect(dates.map(iso)).toEqual([
      "2026-01-15",
      "2026-01-30",
      "2026-02-15",
      "2026-02-28",
      "2026-03-15",
      "2026-03-30",
    ]);
  });

  it("leaves paydays that exist in every month untouched", () => {
    const schedule = createPayRule(semiMonthly([10, 25]));

    const dates = schedule.between(utc(2026, 1, 1), utc(2026, 3, 1), true);

    expect(dates.map(iso)).toEqual([
      "2026-01-10",
      "2026-01-25",
      "2026-02-10",
      "2026-02-25",
    ]);
  });

  it("emits paydays in date order however the pair is given", () => {
    // getPayPeriodsByCount walks the schedule with repeated `after` calls, so a
    // non-monotonic sequence would loop or emit overlapping periods.
    const schedule = createPayRule(semiMonthly(["last", 15]));

    const dates = schedule.between(utc(2026, 1, 1), utc(2026, 2, 1), true);

    expect(dates.map(iso)).toEqual(["2026-01-15", "2026-01-31"]);
  });

  it("finds the current pay period when startDate lands mid-month", () => {
    // startDate is only an anchor for semi-monthly — the paydays define the
    // schedule. Anchoring on the 20th must not hide that month's 15th.
    const schedule = createPayRule(semiMonthly([15, "last"], utc(2026, 3, 20)));

    expect(iso(schedule.before(utc(2026, 3, 25), true)!)).toBe("2026-03-15");
  });

  it("emits one payday when both clamp onto the same date", () => {
    // 30 and "last" both land on Feb 28. A duplicate would make `after` return
    // the date it was handed, and getPayPeriodsByCount walks with `after`.
    const schedule = createPayRule(semiMonthly([30, "last"]));

    const feb = schedule.between(utc(2026, 2, 1), utc(2026, 3, 1), true);

    expect(feb.map(iso)).toEqual(["2026-02-28"]);
    expect(iso(schedule.after(utc(2026, 2, 28))!)).toBe("2026-03-30");
  });

  it("steps forward across a month boundary", () => {
    const schedule = createPayRule(semiMonthly([15, "last"]));

    expect(iso(schedule.after(utc(2026, 1, 31))!)).toBe("2026-02-15");
  });
});
