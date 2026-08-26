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

// A purchase's schedule is not accepted from the client: only its first *month*
// is, and the day comes from the account. That's what makes one consolidated
// statement per month impossible to violate rather than merely discouraged.
const purchaseFieldsSchema = z.object({
  title: z.string().trim().min(1, { message: "Title is required" }),
  // Required, unlike the shared bill schema's optional amount — an installment
  // with no amount can't contribute to a statement total.
  amount: z.number().min(1, { message: "Amount is required" }),
  tenureMonths: z.number().int().min(1).max(60),
  firstDueMonth: z.date(),
});

export const CreateBnplPurchaseInputSchema = purchaseFieldsSchema.extend({
  accountId: z.string(),
});

export const UpdateBnplPurchaseInputSchema = z.object({
  id: z.string(),
  data: purchaseFieldsSchema,
});

export const DeleteBnplPurchaseInputSchema = z.object({ id: z.string() });

export type CreateBnplPurchaseInput = z.infer<
  typeof CreateBnplPurchaseInputSchema
>;
export type UpdateBnplPurchaseInput = z.infer<
  typeof UpdateBnplPurchaseInputSchema
>;
