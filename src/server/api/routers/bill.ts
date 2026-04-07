import { TRPCError } from "@trpc/server";
import { ObjectId, type WithoutId } from "mongodb";
import type { Simplify } from "type-fest";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const SingleBillSchema = z.object({
  type: z.literal("single"),
  date: z.date(),
});

export const RecurringBillSchema = z.object({
  type: z.literal("recurring"),
  recurrence: z.object({
    type: z.enum(["weekly", "monthly"]),
    interval: z.number().min(1),
    bymonthday: z.number().array().optional(),
    dtstart: z.date(),
    until: z.date().optional(),
    count: z.number().optional(),
  }),
});

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
