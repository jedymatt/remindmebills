import { describe, expect, it } from "vitest";
import {
  addUtcMonths,
  formatUtcDate,
  startOfUtcMonth,
  utcDateInMonth,
} from "~/lib/date-utils";

/**
 * These helpers delegate to date-fns, which reads and writes *local* fields, by
 * round-tripping through the UTC-naive frame. That round-trip is the whole risk:
 * a slip would shift the calendar day in any zone that isn't UTC. Every
 * assertion below therefore names an exact UTC-midnight instant, and the suite
 * is meant to be run under hostile offsets (`TZ=Pacific/Kiritimati`, +14, and
 * `TZ=Pacific/Midway`, -11) as well as UTC.
 */

const utc = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d));

describe("utcDateInMonth", () => {
  it("returns the requested day when it exists in the month", () => {
    expect(utcDateInMonth(utc(2026, 3, 1), 15)).toEqual(utc(2026, 3, 15));
  });

  it("reads only the year and month of its anchor, never the day", () => {
    expect(utcDateInMonth(utc(2026, 3, 27), 5)).toEqual(utc(2026, 3, 5));
  });

  it("clamps backward to month end rather than rolling into the next month", () => {
    // The load-bearing case: rolling forward would skip February entirely and
    // put a BNPL statement in March.
    expect(utcDateInMonth(utc(2026, 2, 1), 31)).toEqual(utc(2026, 2, 28));
    expect(utcDateInMonth(utc(2026, 4, 1), 31)).toEqual(utc(2026, 4, 30));
  });

  it("clamps to 29 in a leap February", () => {
    expect(utcDateInMonth(utc(2028, 2, 1), 31)).toEqual(utc(2028, 2, 29));
  });

  it("leaves days that exist in every month untouched", () => {
    for (let month = 1; month <= 12; month++) {
      expect(utcDateInMonth(utc(2026, month, 1), 28)).toEqual(
        utc(2026, month, 28),
      );
    }
  });
});

describe("startOfUtcMonth", () => {
  it("floors to the first of the UTC month", () => {
    expect(startOfUtcMonth(utc(2026, 8, 26))).toEqual(utc(2026, 8, 1));
  });

  it("is idempotent on a value already at the month start", () => {
    expect(startOfUtcMonth(utc(2026, 8, 1))).toEqual(utc(2026, 8, 1));
  });
});

describe("addUtcMonths", () => {
  it("advances whole months, anchored on the 1st", () => {
    expect(addUtcMonths(utc(2026, 8, 26), 2)).toEqual(utc(2026, 10, 1));
  });

  it("does not clamp when starting from a 31st", () => {
    // date-fns `addMonths` would answer Feb 28 from Jan 31; anchoring on the
    // 1st before adding means the result is the requested *month*, always.
    expect(addUtcMonths(utc(2026, 1, 31), 1)).toEqual(utc(2026, 2, 1));
  });

  it("crosses year boundaries in both directions", () => {
    expect(addUtcMonths(utc(2026, 11, 5), 3)).toEqual(utc(2027, 2, 1));
    expect(addUtcMonths(utc(2026, 2, 5), -3)).toEqual(utc(2025, 11, 1));
  });

  it("returns the same month for a zero offset", () => {
    expect(addUtcMonths(utc(2026, 8, 26), 0)).toEqual(utc(2026, 8, 1));
  });

  it("composes with utcDateInMonth the way the occurrence generator does", () => {
    // monthlyOccurrencesInPeriod walks months with addUtcMonths and re-places
    // the target day with utcDateInMonth. A 31st anchor must survive February.
    const dtstart = utc(2026, 1, 31);
    const days = [0, 1, 2, 3].map((i) =>
      utcDateInMonth(addUtcMonths(dtstart, i), dtstart.getUTCDate()),
    );

    expect(days).toEqual([
      utc(2026, 1, 31),
      utc(2026, 2, 28),
      utc(2026, 3, 31),
      utc(2026, 4, 30),
    ]);
  });
});

describe("formatUtcDate", () => {
  it("renders the UTC calendar day, not the viewer's", () => {
    // The trap: `format` on a bare UTC-midnight instant reads local fields, so
    // in any zone behind UTC it renders the *previous* day.
    expect(formatUtcDate(utc(2026, 1, 1), "yyyy-MM-dd")).toBe("2026-01-01");
    expect(formatUtcDate(utc(2026, 8, 26), "MMM d")).toBe("Aug 26");
  });

  it("round-trips the format the date input parses", () => {
    const value = utc(2026, 2, 28);
    expect(formatUtcDate(value, "yyyy-MM-dd")).toBe("2026-02-28");
  });
});
