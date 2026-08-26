import { TRPCError } from "@trpc/server";
import { ObjectId, type Db, type WithoutId } from "mongodb";
import { deriveStatementDtstart } from "~/lib/bnpl-utils";
import {
  CreateBnplAccountInputSchema,
  CreateBnplPurchaseInputSchema,
  DeleteBnplAccountInputSchema,
  DeleteBnplPurchaseInputSchema,
  UpdateBnplAccountInputSchema,
  UpdateBnplPurchaseInputSchema,
} from "~/schemas/bnpl";
import { deleteBillsWithPayments } from "../bill-cascade";
import { createTRPCRouter, protectedProcedure } from "../trpc";

// DB representation — ObjectId fields. See ~/types `BnplAccount` for the
// domain shape.
export type BnplAccountDoc = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  dueDay: number;
};

// Minimal shape of a purchase document this router reads back when rewriting
// schedules or resolving which bills belong to an account. Purchases are
// `bills` rows; see the bill router for the full type. `bnplAccountId` is
// typed here (rather than left to an untyped filter) so a typo in the field
// name fails the compiler instead of silently matching zero documents — every
// purchase query in this router filters on it.
type PurchaseDoc = {
  _id: ObjectId;
  bnplAccountId?: ObjectId;
  recurrence?: { dtstart?: Date };
};

/**
 * Confirms the account exists and belongs to the requesting user. Mirrors
 * `assertBillOwned` in the payment router. Returns the resolved ids so callers
 * don't re-parse them.
 */
export async function assertAccountOwned(
  ctx: { db: Db; session: { user: { id: string } } },
  accountId: string,
): Promise<{ accountOid: ObjectId; userOid: ObjectId; dueDay: number }> {
  if (!ObjectId.isValid(accountId)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
  }

  const accountOid = new ObjectId(accountId);
  const userOid = new ObjectId(ctx.session.user.id);
  const found = await ctx.db
    .collection<BnplAccountDoc>("bnpl_accounts")
    .findOne(
      { _id: accountOid, userId: userOid },
      { projection: { dueDay: 1 } },
    );

  if (!found) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
  }

  return { accountOid, userOid, dueDay: found.dueDay };
}

export const bnplRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    // Sorted by _id: ObjectIds are timestamp-prefixed, so this is a stable
    // creation-order sort with no `order` field to write or keep consistent.
    const cursor = ctx.db
      .collection<BnplAccountDoc>("bnpl_accounts")
      .find({ userId: new ObjectId(ctx.session.user.id) })
      .sort({ _id: 1 });
    const accounts = await cursor.toArray();
    await cursor.close();

    return accounts.map((a) => ({
      _id: a._id.toHexString(),
      userId: a.userId.toHexString(),
      name: a.name,
      dueDay: a.dueDay,
    }));
  }),

  create: protectedProcedure
    .input(CreateBnplAccountInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = new ObjectId(ctx.session.user.id);

      const result = await ctx.db
        .collection<WithoutId<BnplAccountDoc>>("bnpl_accounts")
        .insertOne({ userId, name: input.name, dueDay: input.dueDay });

      return {
        _id: result.insertedId.toHexString(),
        userId: userId.toHexString(),
        name: input.name,
        dueDay: input.dueDay,
      };
    }),

  update: protectedProcedure
    .input(UpdateBnplAccountInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { accountOid, userOid } = await assertAccountOwned(ctx, input.id);

      const updateFields: Partial<Pick<BnplAccountDoc, "name" | "dueDay">> = {};
      if (input.data.name !== undefined) updateFields.name = input.data.name;
      if (input.data.dueDay !== undefined)
        updateFields.dueDay = input.data.dueDay;

      if (Object.keys(updateFields).length === 0) return;

      await ctx.db
        .collection<BnplAccountDoc>("bnpl_accounts")
        .updateOne(
          { _id: accountOid, userId: userOid },
          { $set: updateFields },
        );

      // Hoisted before the early-return guard below so it stays a plain
      // `number` for the flatMap, rather than reaching for `input.data.dueDay!`
      // — `@typescript-eslint/no-non-null-assertion` forbids the assertion, and
      // this hoist is provably equivalent since nothing reassigns `input`.
      const nextDueDay = input.data.dueDay;
      if (nextDueDay === undefined) return;

      // A new due day must be applied to the purchases already under this
      // account, not just to future ones. Otherwise old purchases keep firing
      // on the previous day while new ones fire on the new day, and the account
      // silently splits into two statements a month — precisely what deriving
      // `dtstart` from the account exists to prevent.
      //
      // Each purchase keeps its own first *month*; only the day-of-month moves.
      const cursor = ctx.db
        .collection<PurchaseDoc>("bills")
        .find(
          { userId: userOid, bnplAccountId: accountOid },
          { projection: { "recurrence.dtstart": 1 } },
        );
      const purchases = await cursor.toArray();
      await cursor.close();

      const ops = purchases.flatMap((purchase) => {
        const dtstart = purchase.recurrence?.dtstart;
        if (!dtstart) return [];

        return [
          {
            updateOne: {
              filter: { _id: purchase._id, userId: userOid },
              update: {
                $set: {
                  "recurrence.dtstart": deriveStatementDtstart(
                    nextDueDay,
                    dtstart,
                  ),
                },
              },
            },
          },
        ];
      });

      if (ops.length > 0) {
        await ctx.db.collection("bills").bulkWrite(ops);
      }

      // Paid-markers are keyed on (billId, occurrenceDate), so moving dtstart
      // moves the occurrences they point at. Left alone, every paid installment
      // would revert to unpaid and the stale rows could never be cleared —
      // markUnpaid needs the occurrence rendered before it can be clicked.
      // Shift them by the same transform that moved dtstart: month kept, day
      // replaced. A bill has at most one occurrence per month, so two markers
      // for one bill always differ in month and can never collide on the new date.
      const billOids = purchases.map((purchase) => purchase._id);
      if (billOids.length > 0) {
        const markerCursor = ctx.db
          .collection<{
            _id: ObjectId;
            billId: ObjectId;
            occurrenceDate: Date;
          }>("payments")
          .find({ userId: userOid, billId: { $in: billOids } });
        const markers = await markerCursor.toArray();
        await markerCursor.close();

        const markerOps = markers.map((marker) => ({
          updateOne: {
            filter: { _id: marker._id, userId: userOid },
            update: {
              $set: {
                occurrenceDate: deriveStatementDtstart(
                  nextDueDay,
                  marker.occurrenceDate,
                ),
              },
            },
          },
        }));

        if (markerOps.length > 0) {
          await ctx.db.collection("payments").bulkWrite(markerOps);
        }
      }
    }),

  delete: protectedProcedure
    .input(DeleteBnplAccountInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { accountOid, userOid } = await assertAccountOwned(ctx, input.id);

      if (input.purchases === "delete") {
        const cursor = ctx.db
          .collection<PurchaseDoc>("bills")
          .find(
            { userId: userOid, bnplAccountId: accountOid },
            { projection: { _id: 1 } },
          );
        const purchases = await cursor.toArray();
        await cursor.close();

        await deleteBillsWithPayments(
          ctx.db,
          userOid,
          purchases.map((p) => p._id),
        );
      } else {
        // Keep: drop only the account reference, so each purchase becomes an
        // ordinary monthly recurring bill. Its `count` still ends it at the
        // close of its tenure.
        //
        // `payments` is deliberately untouched — the bill ids don't change, so
        // every existing paid-marker stays valid and correctly attached.
        await ctx.db
          .collection("bills")
          .updateMany(
            { userId: userOid, bnplAccountId: accountOid },
            { $unset: { bnplAccountId: "" } },
          );
      }

      // Purchases are handled first so a failure here can be retried without
      // having already orphaned them — the same ordering as `group.delete`.
      await ctx.db
        .collection<BnplAccountDoc>("bnpl_accounts")
        .deleteOne({ _id: accountOid, userId: userOid });
    }),

  createPurchase: protectedProcedure
    .input(CreateBnplPurchaseInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { accountOid, userOid, dueDay } = await assertAccountOwned(
        ctx,
        input.accountId,
      );

      await ctx.db.collection("bills").insertOne({
        userId: userOid,
        bnplAccountId: accountOid,
        title: input.title,
        amount: input.amount,
        type: "recurring",
        recurrence: {
          type: "monthly",
          interval: 1,
          // Derived, never client-supplied: the account owns the day.
          dtstart: deriveStatementDtstart(dueDay, input.firstDueMonth),
          count: input.tenureMonths,
        },
      });
    }),

  updatePurchase: protectedProcedure
    .input(UpdateBnplPurchaseInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ObjectId.isValid(input.id)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Purchase not found",
        });
      }

      const userOid = new ObjectId(ctx.session.user.id);
      const purchase = await ctx.db
        .collection<{
          _id: ObjectId;
          bnplAccountId?: ObjectId;
          recurrence?: { dtstart: Date; count?: number };
        }>("bills")
        .findOne(
          { _id: new ObjectId(input.id), userId: userOid },
          {
            projection: {
              bnplAccountId: 1,
              "recurrence.dtstart": 1,
              "recurrence.count": 1,
            },
          },
        );

      // Guard on bnplAccountId, not just existence: this endpoint must not be
      // usable to reshape an ordinary bill into an installment.
      if (!purchase?.bnplAccountId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Purchase not found",
        });
      }

      const { dueDay } = await assertAccountOwned(
        ctx,
        purchase.bnplAccountId.toHexString(),
      );

      const previousDtstart = purchase.recurrence?.dtstart;
      const previousCount = purchase.recurrence?.count;
      const nextDtstart = deriveStatementDtstart(
        dueDay,
        input.data.firstDueMonth,
      );
      const nextCount = input.data.tenureMonths;

      await ctx.db.collection("bills").updateOne(
        { _id: purchase._id, userId: userOid },
        {
          $set: {
            title: input.data.title,
            amount: input.data.amount,
            type: "recurring",
            recurrence: {
              type: "monthly",
              interval: 1,
              dtstart: nextDtstart,
              count: nextCount,
            },
          },
        },
      );

      // Reconcile paid-markers against the new schedule. Markers are keyed on
      // (billId, occurrenceDate); if the schedule they point at no longer
      // produces that occurrence, they become unrenderable and thus
      // unclearable (see edge case 6 in the design doc).
      if (
        previousDtstart &&
        previousDtstart.getTime() !== nextDtstart.getTime()
      ) {
        // The first month moved, not just the day-of-month. Unlike the
        // due-day path (which only shifts the day and keeps every marker's
        // month, so shifting markers the same way preserves them), a
        // first-month change redefines which month is installment 1 — a
        // marker for "March" would silently become a marker for whatever
        // installment now falls in March. There is no correct shift, so
        // every marker for this bill is deleted rather than moved: the
        // schedule was redefined and prior paid records no longer correspond
        // to anything the user can see.
        await ctx.db
          .collection("payments")
          .deleteMany({ userId: userOid, billId: purchase._id });
      } else if (previousCount !== undefined && nextCount < previousCount) {
        // Only the tenure shrank. Markers for installments that still exist
        // stay valid; only markers past the new final occurrence are stale.
        // Reuse the tested statement-derivation helper (with the same
        // month-end clamping the generator applies) rather than hand-rolling
        // the month arithmetic.
        const finalMonth = new Date(
          Date.UTC(
            nextDtstart.getUTCFullYear(),
            nextDtstart.getUTCMonth() + nextCount - 1,
            1,
          ),
        );
        const newFinalOccurrence = deriveStatementDtstart(dueDay, finalMonth);

        await ctx.db.collection("payments").deleteMany({
          userId: userOid,
          billId: purchase._id,
          occurrenceDate: { $gt: newFinalOccurrence },
        });
      }
      // Otherwise (title/amount only, or a tenure increase): no schedule
      // change reaches an existing occurrence, so markers stay untouched.
    }),

  deletePurchase: protectedProcedure
    .input(DeleteBnplPurchaseInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ObjectId.isValid(input.id)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Purchase not found",
        });
      }

      const deleted = await deleteBillsWithPayments(
        ctx.db,
        new ObjectId(ctx.session.user.id),
        [new ObjectId(input.id)],
      );

      if (deleted === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Purchase not found",
        });
      }
    }),
});
