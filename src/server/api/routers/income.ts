import { ObjectId } from "mongodb";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import type { IncomeProfile } from "~/types";
import { roundToUtcDateOnly } from "~/lib/date-utils";
import {
  PayDaysSchema,
  PayFrequencySchema,
  refineIncomeFields,
} from "~/schemas/income";
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
    // A discriminated union rather than an optional `payDays`, so the shape the
    // caller must send matches the `IncomeProfile` union it becomes and the
    // handler needs no assertion to know `payDays` is there.
    .input(
      z.discriminatedUnion("payFrequency", [
        z.object({
          payFrequency: z.enum(["weekly", "fortnightly", "monthly"]),
          startDate: z.date(),
        }),
        z.object({
          payFrequency: z.literal("semimonthly"),
          payDays: PayDaysSchema,
          startDate: z.date(),
        }),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      const identity = {
        userId: new ObjectId(ctx.session.user.id),
        startDate: roundToUtcDateOnly(input.startDate),
      };

      const incomeProfile =
        input.payFrequency === "semimonthly"
          ? {
              ...identity,
              payFrequency: input.payFrequency,
              payDays: input.payDays,
            }
          : { ...identity, payFrequency: input.payFrequency };

      await ctx.db
        .collection<IncomeProfile>("income_profiles")
        .insertOne(incomeProfile);
    }),

  updateIncomeProfile: protectedProcedure
    // Every field is optional here, so the discriminant cannot carry the
    // `payDays` requirement the way it does on create; the shared refinement
    // states it instead.
    .input(
      z
        .object({
          payFrequency: PayFrequencySchema.optional(),
          payDays: PayDaysSchema.optional(),
          startDate: z.date().optional(),
          amount: z.number().min(0).optional(),
        })
        .superRefine((values, ctx) => {
          if (values.payFrequency === undefined) return;
          refineIncomeFields(
            { ...values, payFrequency: values.payFrequency },
            ctx,
          );
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const updateFields: Record<string, unknown> = {};
      if (input.payFrequency !== undefined)
        updateFields.payFrequency = input.payFrequency;
      if (input.payDays !== undefined) updateFields.payDays = input.payDays;
      if (input.startDate !== undefined)
        updateFields.startDate = roundToUtcDateOnly(input.startDate);
      if (input.amount !== undefined) updateFields.amount = input.amount;

      // Moving off semi-monthly leaves paydays that no longer mean anything and
      // that the IncomeProfile union says cannot be there.
      const switchedAwayFromSemiMonthly =
        input.payFrequency !== undefined &&
        input.payFrequency !== "semimonthly";

      await ctx.db
        .collection<IncomeProfile>("income_profiles")
        .updateOne(
          { userId: new ObjectId(ctx.session.user.id) },
          switchedAwayFromSemiMonthly
            ? { $set: updateFields, $unset: { payDays: "" } }
            : { $set: updateFields },
        );
    }),
});
