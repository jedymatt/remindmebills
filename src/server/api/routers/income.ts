import { ObjectId } from "mongodb";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import type { IncomeProfile } from "~/types";
import { z } from "zod";

export const incomeRouter = createTRPCRouter({
  getIncomeProfile: protectedProcedure.query(async ({ ctx }) => {
    const incomeProfile = await ctx.db
      .collection<IncomeProfile>("income_profiles")
      .findOne({ userId: new ObjectId(ctx.session.user.id) });

    return incomeProfile;
  }),

  createIncomeProfile: protectedProcedure
    .input(
      z.object({
        payFrequency: z.enum(["weekly", "fortnightly", "monthly"]),
        startDate: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { payFrequency, startDate } = input;

      const incomeProfile = {
        userId: new ObjectId(ctx.session.user.id),
        payFrequency,
        startDate,
      };

      await ctx.db
        .collection<IncomeProfile>("income_profiles")
        .insertOne(incomeProfile);
    }),

  updateIncomeProfile: protectedProcedure
    .input(
      z.object({
        payFrequency: z.enum(["weekly", "fortnightly", "monthly"]).optional(),
        startDate: z.date().optional(),
        amount: z.number().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updateFields: Record<string, unknown> = {};
      if (input.payFrequency !== undefined)
        updateFields.payFrequency = input.payFrequency;
      if (input.startDate !== undefined)
        updateFields.startDate = input.startDate;
      if (input.amount !== undefined) updateFields.amount = input.amount;

      await ctx.db
        .collection<IncomeProfile>("income_profiles")
        .updateOne(
          { userId: new ObjectId(ctx.session.user.id) },
          { $set: updateFields },
        );
    }),
});
