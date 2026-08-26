import { z } from "zod";

// `dueDay` accepts 1–31 even though short months lack 29–31. The day is clamped
// backward when a statement date is derived (see `deriveStatementDtstart`), so
// storing the user's intent verbatim is correct — rejecting 31 would stop them
// modelling a real end-of-month cycle.
const dueDaySchema = z.number().int().min(1).max(31);
const accountNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Name is required" })
  .max(50);

export const CreateBnplAccountInputSchema = z.object({
  name: accountNameSchema,
  dueDay: dueDaySchema,
});

export const UpdateBnplAccountInputSchema = z.object({
  id: z.string(),
  data: z.object({
    name: accountNameSchema.optional(),
    dueDay: dueDaySchema.optional(),
  }),
});

// `purchases` has no default on purpose: deleting an account is destructive in
// one direction and merely untidy in the other, so the caller must state which
// it wants rather than inheriting a choice made here.
export const DeleteBnplAccountInputSchema = z.object({
  id: z.string(),
  purchases: z.enum(["delete", "keep"]),
});

export type CreateBnplAccountInput = z.infer<
  typeof CreateBnplAccountInputSchema
>;
export type UpdateBnplAccountInput = z.infer<
  typeof UpdateBnplAccountInputSchema
>;
