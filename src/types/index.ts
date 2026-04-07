import type z from "zod";
import type { RecurringBillSchema, SingleBillSchema } from "~/server/api/routers/bill";

// todo: follow the type of rrule.js
export type Single = z.infer<typeof SingleBillSchema>;

export type Recurring = z.infer<typeof RecurringBillSchema>
type Recurrence = Recurring["recurrence"];

export type BillEvent = {
  _id: string;
  title: string;
  amount?: number;
  userId: string;
} & (Single | Recurring);

// PlaygroundBillData: bill fields without the local id.
// Defined as an explicit discriminated union — Omit<PlaygroundBill, "id">
// does NOT distribute over unions and collapses the discriminant.
export type PlaygroundBillData =
  | { title: string; amount?: number; type: "single"; date: Date }
  | {
      title: string;
      amount?: number;
      type: "recurring";
      recurrence: Recurrence;
    };

export type PlaygroundBill =
  | { id: string; title: string; amount?: number; type: "single"; date: Date }
  | {
      id: string;
      title: string;
      amount?: number;
      type: "recurring";
      recurrence: Recurrence;
    };

export interface IncomeProfile {
  payFrequency: "weekly" | "fortnightly" | "monthly";
  startDate: Date;
  amount?: number;
}
