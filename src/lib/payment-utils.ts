import { truncateToUtcDateOnly } from "~/lib/date-utils";
import type { Payment } from "~/types";

// Occurrences are generated client-side from recurrence rules, and paid-state
// lives in a separate sparse `payments` set. To render each occurrence's paid
// status we join the two in memory: encode every occurrence as a stable string
// key, drop the paid ones into a Set, then test each generated occurrence
// against it. This module owns that key so the write side (a payment row) and
// the read side (a generated occurrence) agree on exactly one encoding.

/**
 * Stable composite key identifying one occurrence of a bill.
 *
 * The date is floored to its UTC-midnight day via the shared
 * `truncateToUtcDateOnly` — the same helper the server applies before storing a
 * payment — so the read-side key lines up with the stored day even if a bill's
 * date ever carries a sub-day time component. The `:` separator can't appear in a
 * hex ObjectId string, so bill and day never collide.
 */
export function occurrenceKey(billId: string, occurrenceDate: Date): string {
  return `${billId}:${truncateToUtcDateOnly(occurrenceDate).getTime()}`;
}

/** Build the O(1) lookup of paid occurrences from the user's payment set. */
export function buildPaidLookup(payments: Payment[]): Set<string> {
  return new Set(
    payments.map((p) => occurrenceKey(p.billId, p.occurrenceDate)),
  );
}

/** True when the given occurrence has a payment recorded against it. */
export function isOccurrencePaid(
  paidKeys: Set<string>,
  billId: string,
  occurrenceDate: Date,
): boolean {
  return paidKeys.has(occurrenceKey(billId, occurrenceDate));
}
