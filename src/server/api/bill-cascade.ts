import type { Db, ObjectId } from "mongodb";

/**
 * Delete bills together with the paid-occurrence markers pointing at them.
 *
 * A `payments` document is a small marker meaning "this bill's occurrence on
 * this date is settled" — it carries no amount, only that pairing. Occurrences
 * are generated from a bill's recurrence rather than stored, so a marker is
 * only meaningful while its bill exists. Deleting a bill without its markers
 * leaves rows nothing can render and nothing can clear.
 *
 * Shared by the bill router and the BNPL router: purchases are `bills` rows,
 * but their mutations live in the BNPL router, so without this helper the same
 * rule would be written twice and remembered once.
 *
 * Returns the number of bills actually deleted, so callers can distinguish
 * "not found" from "deleted".
 */
export async function deleteBillsWithPayments(
  db: Db,
  userOid: ObjectId,
  billOids: ObjectId[],
): Promise<number> {
  if (billOids.length === 0) return 0;

  const result = await db
    .collection("bills")
    .deleteMany({ _id: { $in: billOids }, userId: userOid });

  await db
    .collection("payments")
    .deleteMany({ userId: userOid, billId: { $in: billOids } });

  return result.deletedCount;
}
