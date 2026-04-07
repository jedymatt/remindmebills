import { z } from "zod";

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

