import { ObjectId } from "mongodb";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import type { IncomeProfile } from "~/types";
import { roundToUtcDateOnly } from "~/lib/date-utils";
import { z } from "zod";

export const incomeRouter = createTRPCRouter({
  getIncomeProfile: protectedProcedure.query(async ({ ctx }) => {
    const incomeProfile = await ctx.db
      .collection<IncomeProfile>("income_profiles")
      .findOne({ userId: new ObjectId(ctx.session.user.id) });

    if (!incomeProfile) return incomeProfile;

    // Heal legacy rows stored at local midnight to the canonical UTC-midnight
    // date-only form so scheduling/rendering is timezone-stable. Idempotent for
    // already-canonical rows.
    return {
      ...incomeProfile,
      startDate: roundToUtcDateOnly(incomeProfile.startDate),
    };
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
        startDate: roundToUtcDateOnly(startDate),
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
        updateFields.startDate = roundToUtcDateOnly(input.startDate);
      if (input.amount !== undefined) updateFields.amount = input.amount;

      await ctx.db
        .collection<IncomeProfile>("income_profiles")
        .updateOne(
          { userId: new ObjectId(ctx.session.user.id) },
          { $set: updateFields },
        );
    }),
});
