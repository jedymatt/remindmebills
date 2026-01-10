import { ObjectId } from "mongodb";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import type { IncomeProfile } from "~/types";
import { z } from "zod/v3";

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
});
