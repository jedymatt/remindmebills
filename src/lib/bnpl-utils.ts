import { truncateToUtcDateOnly, utcDateInMonth } from "~/lib/date-utils";
import { occurrenceKey } from "~/lib/payment-utils";
import type { BnplAccount } from "~/types";

// Pure BNPL logic. A BNPL provider consolidates: every active purchase's
// installment for the month lands on one statement, with one due date and one
// payment. That invariant is enforced here — the account owns the day-of-month,
// and both the statement's date and its membership are derived from it rather
// than read off each purchase's own occurrence, so a split statement can't be
// constructed even when a purchase's stored anchor has drifted.

/**
 * First statement date for a purchase: the account's `dueDay` placed in the
 * month of `firstDueMonth`, at canonical UTC midnight.
 *
 * Uses the same `utcDateInMonth` clamp the monthly occurrence generator applies,
 * so the anchor sits in exactly the frame of the series it seeds.
 *
 * Only the year and month of `firstDueMonth` are read — its day is irrelevant,
 * since the day always comes from the account.
 *
 * NOTE: the clamp is lossy. A `dueDay` of 31 anchored in February stores day 28,
 * and `monthlyOccurrencesInPeriod` re-derives its `targetDay` from that stored
 * day — so this purchase's later occurrences fall on the 28th while a sibling
 * anchored in a 31-day month falls on the 31st. `groupStatements` is what keeps
 * that drift invisible: it consolidates by *month*, not by occurrence date. The
 * deeper fix is to store only the first month and derive the day at read time
 * from `account.dueDay`, which would also remove `bnpl.update`'s fan-out.
 */
export function deriveStatementDtstart(
  dueDay: number,
  firstDueMonth: Date,
): Date {
  return utcDateInMonth(firstDueMonth, dueDay);
}

/** Shown when an installment references an account that no longer exists. */
const UNKNOWN_ACCOUNT_NAME = "BNPL";

/** One account's consolidated obligation on one date. */
export interface Statement {
  accountId: string;
  accountName: string;
  date: Date;
  amount: number;
  /**
   * Per-purchase breakdown. Keeping the amounts (not just the ids) is what lets
   * a partially settled statement report only what is still owed — see
   * `statementRemaining`.
   */
  items: Array<{ billId: string; amount: number }>;
}

/** The shape `groupStatements` needs from a generated occurrence row. */
interface InstallmentOccurrence {
  _id: string;
  bnplAccountId?: string | null;
  amount?: number;
  date: Date;
}

/**
 * Stable composite key identifying one statement, mirroring `occurrenceKey`'s
 * role for a single bill occurrence: one spelling, so every producer and
 * consumer of a statement key agrees. A `:` can't appear in a hex ObjectId, so
 * account and day never collide.
 */
export function statementKey(accountId: string, date: Date): string {
  return `${accountId}:${truncateToUtcDateOnly(date).getTime()}`;
}

/** The bill ids a statement consolidates — the unit `payment.markStatement*` acts on. */
export function statementBillIds(statement: Statement): string[] {
  return statement.items.map((item) => item.billId);
}

/**
 * True when every purchase on the statement is settled. A purchase added after
 * the statement was paid correctly flips it back to unpaid.
 */
export function isStatementPaid(
  paidKeys: Set<string>,
  statement: Statement,
): boolean {
  return statement.items.every((item) =>
    paidKeys.has(occurrenceKey(item.billId, statement.date)),
  );
}

/**
 * What is still owed on a statement — the sum of its *unpaid* purchases, not an
 * all-or-nothing whole-statement figure. A statement settled at ₱3,000 that
 * then gains a ₱500 purchase owes ₱500, not ₱3,500.
 */
export function statementRemaining(
  paidKeys: Set<string>,
  statement: Statement,
): number {
  return statement.items.reduce(
    (total, item) =>
      paidKeys.has(occurrenceKey(item.billId, statement.date))
        ? total
        : total + item.amount,
    0,
  );
}

/**
 * Collapse installment occurrences into one statement per (account, month).
 *
 * This is what a BNPL provider actually bills: not N separate purchases, but a
 * single consolidated payment per account per month. The amount is derived
 * rather than stored, so it shrinks on its own as purchases finish their tenure.
 *
 * Grouping is by *calendar month*, and the statement's date is the account's
 * `dueDay` clamped into that month — deliberately not each occurrence's own
 * date. Occurrence dates can disagree within one account (see the note on
 * `deriveStatementDtstart`), and keying on them would emit two statements a
 * month for one provider, which is the one thing this module exists to prevent.
 * Dating the statement from the account also means every paid-marker for it is
 * written on the same day, so `bnpl.update`'s month-preserving marker shift
 * lands exactly on the new statement date.
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
  const accountById = new Map(accounts.map((a) => [a._id, a]));
  const byKey = new Map<string, Statement>();

  for (const row of installments) {
    const accountId = row.bnplAccountId;
    if (!accountId) continue;

    const occurrence = truncateToUtcDateOnly(row.date);
    const account = accountById.get(accountId);
    // With no account there is no dueDay to date the statement from, so the
    // occurrence's own day stands in.
    const date = account
      ? deriveStatementDtstart(account.dueDay, occurrence)
      : occurrence;
    const key = statementKey(accountId, date);
    const item = { billId: row._id, amount: row.amount ?? 0 };

    const existing = byKey.get(key);
    if (existing) {
      existing.amount += item.amount;
      existing.items.push(item);
      continue;
    }

    byKey.set(key, {
      accountId,
      accountName: account?.name ?? UNKNOWN_ACCOUNT_NAME,
      date,
      amount: item.amount,
      items: [item],
    });
  }

  return [...byKey.values()].sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      a.accountName.localeCompare(b.accountName),
  );
}

/**
 * How far a purchase has advanced through its tenure as of a given date — the
 * "3 of 6" on an account card.
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
