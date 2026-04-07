import { TRPCError } from "@trpc/server";
import { ObjectId, type WithoutId } from "mongodb";
import type { Simplify } from "type-fest";
import { z } from "zod";
import { RecurringBillSchema, SingleBillSchema } from "~/schemas/bill";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const InputBillSchema = z
  .object({
    title: z.string().trim().min(1, { message: "Title is required" }),
    amount: z.number().min(1).optional(),
  })
  .and(z.discriminatedUnion("type", [SingleBillSchema, RecurringBillSchema]));

type InputBill = z.infer<typeof InputBillSchema>;

type BillEvent = Simplify<
  {
    _id: ObjectId;
    userId: ObjectId;
  } & InputBill
>;

export const billRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const billsCursor = ctx.db.collection<BillEvent>("bills").find({
      userId: new ObjectId(ctx.session.user.id),
    });
    const bills = await billsCursor.toArray();
    await billsCursor.close();

    return bills.map((bill) => ({
      ...bill,
      _id: bill._id.toHexString(),
      userId: bill.userId.toHexString(),
    }));
  }),
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ObjectId.isValid(input.id)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bill not found",
        });
      }

      const bill = await ctx.db.collection<BillEvent>("bills").findOne({
        _id: new ObjectId(input.id),
        userId: new ObjectId(ctx.session.user.id),
      });

      if (!bill) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bill not found",
        });
      }

      return {
        ...bill,
        _id: bill._id.toHexString(),
        userId: bill.userId.toHexString(),
      };
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: InputBillSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ObjectId.isValid(input.id)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bill not found",
        });
      }

      const result = await ctx.db.collection<BillEvent>("bills").updateOne(
        {
          _id: new ObjectId(input.id),
          userId: new ObjectId(ctx.session.user.id),
        },
        { $set: input.data },
      );

      if (result.matchedCount === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bill not found",
        });
      }
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ObjectId.isValid(input.id)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bill not found",
        });
      }

      const result = await ctx.db.collection("bills").deleteOne({
        _id: new ObjectId(input.id),
        userId: new ObjectId(ctx.session.user.id),
      });

      if (result.deletedCount === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bill not found",
        });
      }
    }),
  create: protectedProcedure
    .input(InputBillSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.collection<WithoutId<BillEvent>>("bills").insertOne({
        ...input,
        userId: new ObjectId(ctx.session.user.id),
      });
    }),
});
