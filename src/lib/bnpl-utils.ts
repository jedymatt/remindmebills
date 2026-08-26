// Pure BNPL logic. A BNPL provider consolidates: every active purchase's
// installment for the month lands on one statement, with one due date and one
// payment. That invariant is enforced here — the account owns the day-of-month,
// and a purchase's schedule is derived from it rather than supplied alongside
// it, so a split statement can't be constructed.

/** Last day of the given UTC month (`month` is 0-indexed). */
function lastDayOfUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * First statement date for a purchase: the account's `dueDay` placed in the
 * month of `firstDueMonth`, at canonical UTC midnight.
 *
 * A `dueDay` of 29–31 doesn't exist in every month, so it clamps *backward* to
 * that month's last day — day 31 in February yields Feb 28 (Feb 29 in a leap
 * year). Rolling forward instead would push the statement into the wrong month
 * and skip the intended one. This matches the clamping that
 * `monthlyOccurrencesInPeriod` applies to every occurrence *after* the first;
 * doing it here keeps the anchor in the same frame as the series it seeds.
 *
 * Only the year and month of `firstDueMonth` are read — its day is irrelevant,
 * since the day always comes from the account.
 */
export function deriveStatementDtstart(
  dueDay: number,
  firstDueMonth: Date,
): Date {
  const year = firstDueMonth.getUTCFullYear();
  const month = firstDueMonth.getUTCMonth();
  const day = Math.min(dueDay, lastDayOfUtcMonth(year, month));
  return new Date(Date.UTC(year, month, day));
}
