import { describe, expect, it } from "vitest";
import { deriveStatementDtstart, groupStatements, installmentProgress } from "~/lib/bnpl-utils";
import type { BnplAccount } from "~/types";

// Helper: a UTC-midnight date, for readable expectations.
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("deriveStatementDtstart", () => {
  it("uses the account's due day in the chosen month", () => {
    expect(deriveStatementDtstart(15, utc(2026, 9, 1))).toEqual(utc(2026, 9, 15));
  });

  it("ignores the day component of firstDueMonth", () => {
    // Only the year and month of the input matter; the day comes from dueDay.
    expect(deriveStatementDtstart(5, utc(2026, 9, 28))).toEqual(utc(2026, 9, 5));
  });

  it("clamps day 31 back to the end of a short month", () => {
    expect(deriveStatementDtstart(31, utc(2026, 2, 1))).toEqual(utc(2026, 2, 28));
    expect(deriveStatementDtstart(31, utc(2026, 4, 1))).toEqual(utc(2026, 4, 30));
  });

  it("clamps to Feb 29 in a leap year", () => {
    expect(deriveStatementDtstart(31, utc(2028, 2, 1))).toEqual(utc(2028, 2, 29));
  });

  it("leaves day 28 untouched in every month", () => {
    for (let month = 1; month <= 12; month++) {
      expect(deriveStatementDtstart(28, utc(2026, month, 1))).toEqual(
        utc(2026, month, 28),
      );
    }
  });

  it("returns exact UTC midnight", () => {
    const result = deriveStatementDtstart(15, utc(2026, 9, 1));
    expect(result.getUTCHours()).toBe(0);
    expect(result.getTime() % 86_400_000).toBe(0);
  });
});

const account = (id: string, name: string, dueDay = 15): BnplAccount => ({
  _id: id,
  userId: "u1",
  name,
  dueDay,
});

describe("groupStatements", () => {
  it("sums one account's installments on the same date into one statement", () => {
    const result = groupStatements(
      [
        { _id: "b1", bnplAccountId: "a1", amount: 1250, date: utc(2026, 9, 15) },
        { _id: "b2", bnplAccountId: "a1", amount: 700, date: utc(2026, 9, 15) },
        { _id: "b3", bnplAccountId: "a1", amount: 2250, date: utc(2026, 9, 15) },
      ],
      [account("a1", "SPayLater")],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      accountId: "a1",
      accountName: "SPayLater",
      amount: 4200,
      purchaseCount: 3,
    });
    expect(result[0]?.billIds).toEqual(["b1", "b2", "b3"]);
  });

  it("keeps different accounts as separate statements", () => {
    const result = groupStatements(
      [
        { _id: "b1", bnplAccountId: "a1", amount: 1000, date: utc(2026, 9, 15) },
        { _id: "b2", bnplAccountId: "a2", amount: 900, date: utc(2026, 9, 20) },
      ],
      [account("a1", "SPayLater"), account("a2", "LazPayLater", 20)],
    );

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.accountName)).toEqual([
      "SPayLater",
      "LazPayLater",
    ]);
  });

  it("sorts by date, then by account name", () => {
    const result = groupStatements(
      [
        { _id: "b1", bnplAccountId: "a2", amount: 1, date: utc(2026, 9, 20) },
        { _id: "b2", bnplAccountId: "a1", amount: 1, date: utc(2026, 9, 15) },
        { _id: "b3", bnplAccountId: "a3", amount: 1, date: utc(2026, 9, 15) },
      ],
      [account("a1", "Bravo"), account("a2", "Alpha", 20), account("a3", "Alpha")],
    );

    expect(result.map((s) => [s.accountName, s.date.getUTCDate()])).toEqual([
      ["Alpha", 15],
      ["Bravo", 15],
      ["Alpha", 20],
    ]);
  });

  it("treats a missing amount as zero", () => {
    const result = groupStatements(
      [{ _id: "b1", bnplAccountId: "a1", date: utc(2026, 9, 15) }],
      [account("a1", "SPayLater")],
    );

    expect(result[0]?.amount).toBe(0);
    expect(result[0]?.purchaseCount).toBe(1);
  });

  it("keeps installments whose account is unknown, under a fallback name", () => {
    // Money must never silently vanish from the roll-up: the period's outgoing
    // total already includes this installment, so dropping it here would break
    // the "subtotals sum to the balance" invariant the bill list documents.
    const result = groupStatements(
      [{ _id: "b1", bnplAccountId: "gone", amount: 500, date: utc(2026, 9, 15) }],
      [],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ accountName: "BNPL", amount: 500 });
  });

  it("floors dates to their UTC day when grouping", () => {
    const result = groupStatements(
      [
        { _id: "b1", bnplAccountId: "a1", amount: 100, date: utc(2026, 9, 15) },
        {
          _id: "b2",
          bnplAccountId: "a1",
          amount: 100,
          date: new Date(Date.UTC(2026, 8, 15, 13, 30)),
        },
      ],
      [account("a1", "SPayLater")],
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.amount).toBe(200);
  });

  it("returns nothing for no installments", () => {
    expect(groupStatements([], [account("a1", "SPayLater")])).toEqual([]);
  });
});

describe("installmentProgress", () => {
  it("counts the first month as installment 1", () => {
    expect(installmentProgress(utc(2026, 9, 15), 6, utc(2026, 9, 15))).toEqual({
      elapsed: 1,
      total: 6,
    });
  });

  it("counts elapsed months inclusively", () => {
    expect(installmentProgress(utc(2026, 9, 15), 6, utc(2026, 11, 15))).toEqual({
      elapsed: 3,
      total: 6,
    });
  });

  it("counts across a year boundary", () => {
    expect(installmentProgress(utc(2026, 11, 15), 6, utc(2027, 2, 15))).toEqual({
      elapsed: 4,
      total: 6,
    });
  });

  it("never exceeds the total", () => {
    expect(installmentProgress(utc(2026, 9, 15), 6, utc(2028, 9, 15))).toEqual({
      elapsed: 6,
      total: 6,
    });
  });

  it("reports zero before the first installment", () => {
    expect(installmentProgress(utc(2026, 9, 15), 6, utc(2026, 8, 15))).toEqual({
      elapsed: 0,
      total: 6,
    });
  });

  it("treats a missing count as a single installment", () => {
    // A purchase always has a tenure, but `count` is optional on the shared
    // recurrence type, so the fallback must be defined rather than NaN.
    expect(installmentProgress(utc(2026, 9, 15), undefined, utc(2026, 9, 15)))
      .toEqual({ elapsed: 1, total: 1 });
  });
});
