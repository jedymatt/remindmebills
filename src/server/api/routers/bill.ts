import { ObjectId } from "mongodb";
import type { BillEvent } from "~/types";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";

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
