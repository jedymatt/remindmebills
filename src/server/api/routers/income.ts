import { ObjectId } from "mongodb";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import type { IncomeProfile } from "~/types";

export const incomeRouter = createTRPCRouter({
  getIncomeProfile: protectedProcedure.query(async ({ ctx }) => {
    const incomeProfile = await ctx.db
      .collection<IncomeProfile>("income_profiles")
      .findOne({ userId: new ObjectId(ctx.session.user.id) });

    return incomeProfile
      ? { ...incomeProfile, _id: incomeProfile._id.toString() }
      : null;
  }),
});
