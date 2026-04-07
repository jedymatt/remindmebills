import { TRPCError } from "@trpc/server";
import { ObjectId, type WithoutId } from "mongodb";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const SingleBillSchema = z.object({
  type: z.literal("single"),
  date: z.date(),
});

const RecurringBillSchema = z.object({
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

const billEventSchema = z
  .object({
    _id: z.instanceof(ObjectId),
    userId: z.instanceof(ObjectId),
  })
  .and(InputBillSchema);

export type BillEvent = z.infer<typeof billEventSchema>;

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

      return bill;
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.instanceof(ObjectId),
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
          _id: input.id,
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
    .input(z.object({ id: z.instanceof(ObjectId) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.collection("bills").deleteOne({
        _id: input.id,
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
