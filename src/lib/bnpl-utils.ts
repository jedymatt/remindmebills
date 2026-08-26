import { truncateToUtcDateOnly } from "~/lib/date-utils";
import type { BnplAccount } from "~/types";

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

/** Shown when an installment references an account that no longer exists. */
const UNKNOWN_ACCOUNT_NAME = "BNPL";

/** One account's consolidated obligation on one date. */
export interface Statement {
  accountId: string;
  accountName: string;
  date: Date;
  amount: number;
  purchaseCount: number;
  billIds: string[];
}

/** The shape `groupStatements` needs from a generated occurrence row. */
interface InstallmentOccurrence {
  _id: string;
  bnplAccountId?: string | null;
  amount?: number;
  date: Date;
}

/**
 * Collapse installment occurrences into one statement per (account, date).
 *
 * This is what a BNPL provider actually bills: not N separate purchases, but a
 * single consolidated payment per account per month. The amount is derived
 * rather than stored, so it shrinks on its own as purchases finish their tenure.
 *
 * An installment whose account has vanished is kept under a fallback name
 * instead of being dropped. The enclosing period's outgoing total already counts
 * it, so discarding it here would make the section subtotals stop summing to the
 * balance — the same reasoning behind the bill list's "Ungrouped" catch-all.
 */
export function groupStatements(
  installments: InstallmentOccurrence[],
  accounts: BnplAccount[],
): Statement[] {
  const nameById = new Map(accounts.map((a) => [a._id, a.name]));
  const byKey = new Map<string, Statement>();

  for (const row of installments) {
    const accountId = row.bnplAccountId;
    if (!accountId) continue;

    const date = truncateToUtcDateOnly(row.date);
    const key = `${accountId}:${date.getTime()}`;

    const existing = byKey.get(key);
    if (existing) {
      existing.amount += row.amount ?? 0;
      existing.purchaseCount += 1;
      existing.billIds.push(row._id);
      continue;
    }

    byKey.set(key, {
      accountId,
      accountName: nameById.get(accountId) ?? UNKNOWN_ACCOUNT_NAME,
      date,
      amount: row.amount ?? 0,
      purchaseCount: 1,
      billIds: [row._id],
    });
  }

  return [...byKey.values()].sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      a.accountName.localeCompare(b.accountName),
  );
}

/**
 * How far a purchase has advanced through its tenure as of a given statement
 * date — the "3 of 6" on an account card.
 *
 * Counted inclusively from `dtstart`, so the first statement reads 1 of N, and
 * clamped to `[0, total]` so a long-finished purchase reads N of N rather than
 * drifting past it. Month arithmetic uses UTC fields to stay in the same frame
 * as the stored anchor.
 */
export function installmentProgress(
  dtstart: Date,
  count: number | undefined,
  asOf: Date,
): { elapsed: number; total: number } {
  const total = count ?? 1;
  const monthsApart =
    (asOf.getUTCFullYear() - dtstart.getUTCFullYear()) * 12 +
    (asOf.getUTCMonth() - dtstart.getUTCMonth());
  const elapsed = Math.min(Math.max(monthsApart + 1, 0), total);

  return { elapsed, total };
}
