import { TRPCError } from "@trpc/server";
import { ObjectId, type WithoutId } from "mongodb";
import type { Simplify } from "type-fest";
import { z } from "zod";
import { RecurringBillSchema, SingleBillSchema } from "~/schemas/bill";
import type { BillEvent as SerializedBillEvent } from "~/types";
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
  } & Omit<InputBill, "groupId">
>;

type GroupDoc = {
  _id: ObjectId;
  userId: ObjectId;
};

// Resolves a groupId string from input into an ObjectId after checking the
// group belongs to the requesting user. Returns null if input is null/empty.
async function resolveGroupId(
  ctx: { db: import("mongodb").Db; session: { user: { id: string } } },
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
      const { groupId: _groupId, ...rest } = input.data;
      const update: Record<string, unknown> = { ...rest };
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

      const result = await ctx.db.collection("bills").deleteOne({
        _id: new ObjectId(input.id),
        userId: new ObjectId(ctx.session.user.id),
      });

      if (result.deletedCount === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }
    }),
  create: protectedProcedure
    .input(InputBillSchema)
    .mutation(async ({ ctx, input }) => {
      const groupOid = await resolveGroupId(ctx, input.groupId);
      const { groupId: _groupId, ...rest } = input;

      await ctx.db.collection<WithoutId<BillEvent>>("bills").insertOne({
        ...rest,
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
        },
        setOps,
      );

      if (result.matchedCount === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }
    }),
});
