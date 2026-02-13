import { ObjectId } from "mongodb";
import type { BillEvent } from "~/types";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

const BaseBillSchema = z.object({
  title: z.string().trim().min(1, { message: "Title is required" }),
  amount: z.number().min(0).optional(),
});

const SingleBillSchema = BaseBillSchema.extend({
  type: z.literal("single"),
  date: z.date(),
});

const RecurringBillSchema = BaseBillSchema.extend({
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

const InputBillSchema = z.discriminatedUnion("type", [
  SingleBillSchema,
  RecurringBillSchema,
]);

export const billRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const billsCursor = ctx.db.collection<BillEvent>("bills").find({
      userId: new ObjectId(ctx.session.user.id),
    });
    const bills = await billsCursor.toArray();
    await billsCursor.close();

    return bills;
  }),
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bill = await ctx.db
        .collection<BillEvent>("bills")
        .findOne({
          _id: new ObjectId(input.id),
          userId: new ObjectId(ctx.session.user.id),
        } as any);

      if (!bill) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bill not found",
        });
      }

      return bill;
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: InputBillSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.collection("bills").updateOne(
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
      const bill: Omit<BillEvent, "_id"> = {
        ...input,
        userId: new ObjectId(ctx.session.user.id),
      };

      await ctx.db.collection("bills").insertOne(bill);
    }),
});
