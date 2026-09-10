import type { Db } from "mongodb";

let databaseIndexesPromise: Promise<void> | undefined;

async function createDatabaseIndexes(db: Db): Promise<void> {
  await db.collection("payments").createIndex(
    { userId: 1, billId: 1, occurrenceDate: 1 },
    {
      name: "payments_user_bill_occurrence_unique",
      unique: true,
    },
  );
}

/**
 * Ensures application-level MongoDB indexes exist.
 *
 * MongoDB index creation is idempotent when the name/spec/options match, and the
 * module-level promise keeps concurrent first requests from racing to create the
 * same index repeatedly.
 */
export function ensureDatabaseIndexes(db: Db): Promise<void> {
  databaseIndexesPromise ??= createDatabaseIndexes(db).catch((error: unknown) => {
    databaseIndexesPromise = undefined;
    throw error;
  });
  return databaseIndexesPromise;
}
