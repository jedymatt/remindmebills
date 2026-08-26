import { TRPCError } from "@trpc/server";
import { ObjectId, type Db, type WithoutId } from "mongodb";
import { z } from "zod";
import { truncateToUtcDateOnly } from "~/lib/date-utils";
import type { Payment as SerializedPayment } from "~/types";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { assertAccountOwned } from "./bnpl";

// A payment marks one *occurrence* of a bill as settled. Occurrences aren't
// stored rows — they're generated on the fly from the bill's recurrence rule —
// so a payment stands alone, identified by the (billId, occurrenceDate) pair.
// The set is sparse: only paid occurrences have a document; absence = unpaid.
type PaymentDoc = {
  _id: ObjectId;
  userId: ObjectId;
  billId: ObjectId;
  occurrenceDate: Date;
  paidAt: Date;
};

function serializePayment(payment: PaymentDoc): SerializedPayment {
  return {
    ...payment,
    _id: payment._id.toHexString(),
    userId: payment.userId.toHexString(),
    billId: payment.billId.toHexString(),
  };
}

// Confirms the bill exists and belongs to the requesting user before a payment
// is attached to it — mirrors the ownership check in the bill router. Returns the
// resolved ids so callers don't re-parse them.
async function assertBillOwned(
  ctx: { db: Db; session: { user: { id: string } } },
  billId: string,
): Promise<{ billOid: ObjectId; userOid: ObjectId }> {
  if (!ObjectId.isValid(billId)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
  }

  const billOid = new ObjectId(billId);
  const userOid = new ObjectId(ctx.session.user.id);
  const found = await ctx.db
    .collection("bills")
    .findOne({ _id: billOid, userId: userOid }, { projection: { _id: 1 } });

  if (!found) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
  }

  return { billOid, userOid };
}

// A statement is settled as a unit, so its mutations act on a set of bill ids.
// Every id must belong to the requesting user *and* to the named account —
// otherwise this endpoint would be a way to write payments against arbitrary
// bills in bulk.
async function assertPurchasesInAccount(
  ctx: { db: Db; session: { user: { id: string } } },
  accountId: string,
  billIds: string[],
): Promise<{ billOids: ObjectId[]; userOid: ObjectId }> {
  const { accountOid, userOid } = await assertAccountOwned(ctx, accountId);

  // Dedupe before counting: a repeated id would otherwise make countDocuments'
  // distinct-document match fall short of the raw input length and reject a
  // valid request. The deduped list is also what gets queried and written.
  const uniqueIds = [...new Set(billIds)];

  if (uniqueIds.some((id) => !ObjectId.isValid(id))) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Purchase not found" });
  }

  const billOids = uniqueIds.map((id) => new ObjectId(id));
  const matched = await ctx.db.collection("bills").countDocuments({
    _id: { $in: billOids },
    userId: userOid,
    bnplAccountId: accountOid,
  });

  if (matched !== billOids.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Purchase not found" });
  }

  return { billOids, userOid };
}

export const paymentRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const cursor = ctx.db
      .collection<PaymentDoc>("payments")
      .find({ userId: new ObjectId(ctx.session.user.id) });
    const payments = await cursor.toArray();
    await cursor.close();

    return payments.map(serializePayment);
  }),
  markPaid: protectedProcedure
    .input(z.object({ billId: z.string(), occurrenceDate: z.date() }))
    .mutation(async ({ ctx, input }) => {
      const { billOid, userOid } = await assertBillOwned(ctx, input.billId);
      const occurrenceDate = truncateToUtcDateOnly(input.occurrenceDate);

      // Upsert on the (userId, billId, occurrenceDate) identity so re-marking the
      // same occurrence refreshes paidAt rather than adding a row. Without a
      // unique index, truly concurrent upserts can still race to insert
      // duplicates — deferred; markUnpaid's deleteMany clears any that appear.
      await ctx.db.collection<WithoutId<PaymentDoc>>("payments").updateOne(
        { userId: userOid, billId: billOid, occurrenceDate },
        { $set: { paidAt: new Date() } },
        { upsert: true },
      );
    }),
  markUnpaid: protectedProcedure
    .input(z.object({ billId: z.string(), occurrenceDate: z.date() }))
    .mutation(async ({ ctx, input }) => {
      const { billOid, userOid } = await assertBillOwned(ctx, input.billId);

      // deleteMany (not deleteOne) self-heals any duplicate a concurrent
      // upsert race may have created, so unmarking always fully clears it.
      await ctx.db.collection<PaymentDoc>("payments").deleteMany({
        userId: userOid,
        billId: billOid,
        occurrenceDate: truncateToUtcDateOnly(input.occurrenceDate),
      });
    }),
  markStatementPaid: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        statementDate: z.date(),
        billIds: z.array(z.string()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { billOids, userOid } = await assertPurchasesInAccount(
        ctx,
        input.accountId,
        input.billIds,
      );
      const occurrenceDate = truncateToUtcDateOnly(input.statementDate);

      // One bulkWrite rather than N client mutations: a statement is a single
      // user action and shouldn't be able to land half-applied because a
      // request in the middle failed.
      await ctx.db.collection("payments").bulkWrite(
        billOids.map((billId) => ({
          updateOne: {
            filter: { userId: userOid, billId, occurrenceDate },
            update: { $set: { paidAt: new Date() } },
            upsert: true,
          },
        })),
      );
    }),

  markStatementUnpaid: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        statementDate: z.date(),
        billIds: z.array(z.string()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { billOids, userOid } = await assertPurchasesInAccount(
        ctx,
        input.accountId,
        input.billIds,
      );

      // deleteMany, mirroring markUnpaid: self-heals any duplicate a concurrent
      // upsert race may have created.
      await ctx.db.collection("payments").deleteMany({
        userId: userOid,
        billId: { $in: billOids },
        occurrenceDate: truncateToUtcDateOnly(input.statementDate),
      });
    }),
});
