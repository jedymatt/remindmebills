import { TRPCError } from "@trpc/server";
import { ObjectId, type Db, type WithoutId } from "mongodb";
import { z } from "zod";
import type { Payment as SerializedPayment } from "~/types";
import { createTRPCRouter, protectedProcedure } from "../trpc";

// A payment marks one *occurrence* of a bill as settled. Occurrences aren't
// stored rows — they're generated on the fly from the bill's recurrence rule —
// so a payment stands alone, identified by the (billId, occurrenceDate) pair.
// The set is sparse: only paid occurrences have a document; absence = unpaid.
type PaymentDoc = {
  _id: ObjectId;
  userId: ObjectId;
  billId: ObjectId;
  occurrenceDate: Date;
  amountPaid?: number;
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

// Truncate an occurrence instant to UTC midnight of its calendar day, so the
// stored key sits in the same UTC-naive frame the scheduler generates
// occurrences in (see date-utils.ts). Without this a paid marker could miss its
// occurrence by a sub-day offset.
function toOccurrenceKey(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

// Confirms the bill exists and belongs to the requesting user before a payment
// is attached to it — mirrors the ownership check in the bill router.
async function assertBillOwned(
  ctx: { db: Db; session: { user: { id: string } } },
  billId: string,
): Promise<ObjectId> {
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

  return billOid;
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
    .input(
      z.object({
        billId: z.string(),
        occurrenceDate: z.date(),
        amountPaid: z.number().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const billOid = await assertBillOwned(ctx, input.billId);
      const occurrenceDate = toOccurrenceKey(input.occurrenceDate);

      // Upsert on the (userId, billId, occurrenceDate) identity so marking the
      // same occurrence paid twice refreshes paidAt instead of duplicating.
      const set: Record<string, unknown> = { paidAt: new Date() };
      if (input.amountPaid != null) set.amountPaid = input.amountPaid;

      await ctx.db.collection<WithoutId<PaymentDoc>>("payments").updateOne(
        {
          userId: new ObjectId(ctx.session.user.id),
          billId: billOid,
          occurrenceDate,
        },
        { $set: set },
        { upsert: true },
      );
    }),
  markUnpaid: protectedProcedure
    .input(z.object({ billId: z.string(), occurrenceDate: z.date() }))
    .mutation(async ({ ctx, input }) => {
      const billOid = await assertBillOwned(ctx, input.billId);

      // deleteMany (not deleteOne) self-heals any duplicate a concurrent
      // upsert race may have created, so unmarking always fully clears it.
      await ctx.db.collection<PaymentDoc>("payments").deleteMany({
        userId: new ObjectId(ctx.session.user.id),
        billId: billOid,
        occurrenceDate: toOccurrenceKey(input.occurrenceDate),
      });
    }),
});
