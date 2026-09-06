import { z } from "zod";
import type { PayDay } from "~/types";

/**
 * A payday is a day number or the month's final day. Numbers up to 31 are
 * allowed because `createPayRule` clamps them — a 30th payday lands on Feb 28
 * rather than vanishing. `"last"` is a separate intent: it tracks the month's
 * length instead of naming a day, which is what "katapusan" means, and the two
 * differ in every 31-day month.
 */
export const PayDaySchema = z.union([
  z.number().int().min(1).max(31),
  z.literal("last"),
]);

export const PayDaysSchema = z.tuple([PayDaySchema, PayDaySchema]);

export const PayFrequencySchema = z.enum([
  "weekly",
  "fortnightly",
  "monthly",
  "semimonthly",
]);

export const LAST_DAY_VALUE = "last";

/** Turn a select's string value back into a `PayDay`. */
export function parsePayDay(value: string): PayDay {
  if (value === LAST_DAY_VALUE) return LAST_DAY_VALUE;
  return Number(value);
}

/**
 * Cross-field rules shared by both income-profile forms and the router, so the
 * three cannot disagree about what a valid semi-monthly profile is.
 *
 * TODO(jedymatt): decide the extra rules where marked below. The scheduler is
 * already safe without them — it sorts the pair and drops a duplicate when both
 * clamp onto the same date — so this is about what to *tell the user*, not
 * correctness.
 */
export function refineIncomeFields(
  values: { payFrequency: string; payDays?: [PayDay, PayDay] },
  ctx: z.RefinementCtx,
): void {
  if (values.payFrequency !== "semimonthly") return;

  if (!values.payDays) {
    ctx.addIssue({
      code: "custom",
      message: "Pick both paydays",
      path: ["payDays", 0],
    });
    return;
  }

  // TODO(jedymatt): your call on the rest. Open questions:
  //   - Reject [15, 15], or let it collapse to one payday a month?
  //   - Require ascending order, or accept ["last", 15] since it gets sorted?
  //   - Warn when a literal 29/30/31 pairs with "last"? They collide in
  //     February (30 and "last" are both Feb 28) but differ the rest of the year.
  // Report problems with:
  //   ctx.addIssue({ code: "custom", message: "…", path: ["payDays"] });
}
