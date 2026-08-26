import { TRPCError } from "@trpc/server";
import { ObjectId, type Db, type WithoutId } from "mongodb";
import { deriveStatementDtstart } from "~/lib/bnpl-utils";
import {
  CreateBnplAccountInputSchema,
  DeleteBnplAccountInputSchema,
  UpdateBnplAccountInputSchema,
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
// schedules. Purchases are `bills` rows; see the bill router for the full type.
type PurchaseDoc = {
  _id: ObjectId;
  recurrence?: { dtstart?: Date };
};

/**
 * Confirms the account exists and belongs to the requesting user. Mirrors
 * `resolveGroupId` in the bill router. Returns the resolved ids so callers
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
    }),

  delete: protectedProcedure
    .input(DeleteBnplAccountInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { accountOid, userOid } = await assertAccountOwned(ctx, input.id);

      if (input.purchases === "delete") {
        const cursor = ctx.db
          .collection<{ _id: ObjectId }>("bills")
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
});
