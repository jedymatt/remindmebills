import { TRPCError } from "@trpc/server";
import { ObjectId, type Db, type WithoutId } from "mongodb";
import { omit } from "radashi";
import type { Simplify } from "type-fest";
import { z } from "zod";
import { RecurringBillSchema, SingleBillSchema } from "~/schemas/bill";
import type { BillEvent as SerializedBillEvent } from "~/types";
import { deleteBillsWithPayments } from "../bill-cascade";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const InputBillSchema = z
  .object({
    title: z.string().trim().min(1, { message: "Title is required" }),
    amount: z.number().min(1).optional(),
    groupId: z.string().nullish(),
  })
  .and(z.discriminatedUnion("type", [SingleBillSchema, RecurringBillSchema]));

type InputBill = z.infer<typeof InputBillSchema>;

type BillEvent = Simplify<
  {
    _id: ObjectId;
    userId: ObjectId;
    groupId?: ObjectId | null;
    // Present only on BNPL purchases (see `bnplRouter`); typed here so the
    // `update` mutation's filter can exclude them without an `as` cast.
    bnplAccountId?: ObjectId;
  } & Omit<InputBill, "groupId">
>;

/**
 * "This row is an ordinary bill, not a BNPL purchase" — the server-side spelling
 * of the discriminator `partitionBills` applies on the client, and its exact
 * complement `IS_PURCHASE`. Every mutation that must not reshape a purchase
 * filters on this one constant rather than inlining its own predicate.
 *
 * Matches a missing field, an explicit `null`, and `""` — all three of which
 * `BillEvent.bnplAccountId` (`?: string | null`) admits and `partitionBills`
 * treats as ordinary. A bare `$exists: false` would call a null-valued row a
 * purchase, leaving a bill that renders and opens normally but can never be
 * saved.
 */
export const NOT_A_PURCHASE = {
  bnplAccountId: { $not: { $type: "objectId" } },
} as const;

/** A BNPL purchase row: `bnplAccountId` holds a real account ObjectId. */
export const IS_PURCHASE = {
  bnplAccountId: { $type: "objectId" },
} as const;

type GroupDoc = {
  _id: ObjectId;
  userId: ObjectId;
};

// Resolves a groupId string from input into an ObjectId after checking the
// group belongs to the requesting user. Returns null if input is null/empty.
async function resolveGroupId(
  ctx: { db: Db; session: { user: { id: string } } },
  rawGroupId: string | null | undefined,
): Promise<ObjectId | null> {
  if (rawGroupId == null || rawGroupId === "") return null;

  if (!ObjectId.isValid(rawGroupId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid groupId" });
  }

  const groupOid = new ObjectId(rawGroupId);
  const userOid = new ObjectId(ctx.session.user.id);
  const found = await ctx.db
    .collection<GroupDoc>("groups")
    .findOne({ _id: groupOid, userId: userOid }, { projection: { _id: 1 } });

  if (!found) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Group not found" });
  }

  return groupOid;
}

function serializeBill(bill: BillEvent): SerializedBillEvent {
  return {
    ...bill,
    _id: bill._id.toHexString(),
    userId: bill.userId.toHexString(),
    groupId: bill.groupId ? bill.groupId.toHexString() : null,
  } as SerializedBillEvent;
}

export const billRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const billsCursor = ctx.db.collection<BillEvent>("bills").find({
      userId: new ObjectId(ctx.session.user.id),
    });
    const bills = await billsCursor.toArray();
    await billsCursor.close();

    return bills.map(serializeBill);
  }),
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ObjectId.isValid(input.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }

      const bill = await ctx.db.collection<BillEvent>("bills").findOne({
        _id: new ObjectId(input.id),
        userId: new ObjectId(ctx.session.user.id),
      });

      if (!bill) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }

      return serializeBill(bill);
    }),
  update: protectedProcedure
    .input(z.object({ id: z.string(), data: InputBillSchema }))
    .mutation(async ({ ctx, input }) => {
      if (!ObjectId.isValid(input.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }

      const groupOid = await resolveGroupId(ctx, input.data.groupId);
      const update: Record<string, unknown> = {
        ...omit(input.data, ["groupId"]),
      };
      if (groupOid !== null) update.groupId = groupOid;

      const setOps: Record<string, unknown> = { $set: update };
      if (groupOid === null) {
        // Use $unset for the null case so the field doesn't sit as null forever.
        setOps.$unset = { groupId: "" };
      }

      const result = await ctx.db.collection<BillEvent>("bills").updateOne(
        {
          _id: new ObjectId(input.id),
          userId: new ObjectId(ctx.session.user.id),
          // This mutation accepts a client-supplied `recurrence`, including
          // `dtstart` — a BNPL purchase's `dtstart` must only ever be derived
          // server-side from its account's due day, since that derivation is
          // what makes a split statement unrepresentable. Excluding purchases
          // from the filter (rather than checking after the fact) makes a
          // purchase id read as the existing "Bill not found"; purchase edits
          // belong to `bnpl.updatePurchase`.
          ...NOT_A_PURCHASE,
        },
        setOps,
      );

      if (result.matchedCount === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ObjectId.isValid(input.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }

      // Purchase deletion belongs to `bnpl.deletePurchase`, which is the only
      // endpoint that knows a purchase is one member of a statement. Excluding
      // them here keeps this mutation symmetric with `update`/`assignGroup`
      // rather than being a second, undocumented way to delete one.
      const userOid = new ObjectId(ctx.session.user.id);
      const ordinary = await ctx.db
        .collection<BillEvent>("bills")
        .findOne(
          { _id: new ObjectId(input.id), userId: userOid, ...NOT_A_PURCHASE },
          { projection: { _id: 1 } },
        );

      if (!ordinary) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }

      const deleted = await deleteBillsWithPayments(ctx.db, userOid, [
        ordinary._id,
      ]);

      if (deleted === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }
    }),
  create: protectedProcedure
    .input(InputBillSchema)
    .mutation(async ({ ctx, input }) => {
      const groupOid = await resolveGroupId(ctx, input.groupId);

      await ctx.db.collection<WithoutId<BillEvent>>("bills").insertOne({
        ...omit(input, ["groupId"]),
        userId: new ObjectId(ctx.session.user.id),
        ...(groupOid !== null ? { groupId: groupOid } : {}),
      });
    }),
  assignGroup: protectedProcedure
    .input(z.object({ id: z.string(), groupId: z.string().nullish() }))
    .mutation(async ({ ctx, input }) => {
      if (!ObjectId.isValid(input.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }

      const groupOid = await resolveGroupId(ctx, input.groupId);
      const setOps: Record<string, unknown> =
        groupOid !== null
          ? { $set: { groupId: groupOid } }
          : { $unset: { groupId: "" } };

      const result = await ctx.db.collection<BillEvent>("bills").updateOne(
        {
          _id: new ObjectId(input.id),
          userId: new ObjectId(ctx.session.user.id),
          // Same exclusion as `update`: a BNPL purchase has no place in a group.
          // `partitionBills` routes it out of every group section, so a groupId
          // stamped here would never render but would still inflate the group's
          // bill count on /groups.
          ...NOT_A_PURCHASE,
        },
        setOps,
      );

      if (result.matchedCount === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }
    }),
});
