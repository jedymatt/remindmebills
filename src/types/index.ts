import type { z } from "zod";
import type { RecurringBillSchema, SingleBillSchema } from "~/schemas/bill";

// todo: follow the type of rrule.js
export type Single = z.infer<typeof SingleBillSchema>;

export type Recurring = z.infer<typeof RecurringBillSchema>;
type Recurrence = Recurring["recurrence"];

export type BillEvent = {
  _id: string;
  title: string;
  amount?: number;
  userId: string;
  groupId?: string | null;
  // Present = this bill is a BNPL installment purchase, and names the account
  // it belongs to. Absent = an ordinary bill. Presence is the only
  // discriminator, which is why no migration was needed to introduce it.
  bnplAccountId?: string | null;
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

// A BNPL provider account (Shopee SPayLater, LazPayLater, …). The account owns
// the shared monthly `dueDay`: every purchase under it derives its schedule from
// that day, which is what makes one consolidated statement per month structural
// rather than a data-entry convention.
export interface BnplAccount {
  _id: string;
  userId: string;
  name: string;
  dueDay: number;
}

export interface IncomeProfile {
  payFrequency: "weekly" | "fortnightly" | "monthly";
  startDate: Date;
  amount?: number;
}

export interface Group {
  _id: string;
  userId: string;
  name: string;
  order: number;
}

// A settled occurrence of a bill. `occurrenceDate` is the UTC-midnight day-key
// that lines up with a scheduler-generated occurrence (see date-utils.ts).
export interface Payment {
  _id: string;
  userId: string;
  billId: string;
  occurrenceDate: Date;
  paidAt: Date;
}
