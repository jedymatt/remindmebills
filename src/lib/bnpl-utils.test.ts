import { describe, expect, it } from "vitest";
import { deriveStatementDtstart } from "~/lib/bnpl-utils";

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
