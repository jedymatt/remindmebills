import type { ObjectId } from "mongodb";

// todo: follow the type of rrule.js
export interface Recurrence {
  type: "weekly" | "monthly";
  interval: number;
  bymonthday?: number[];
  dtstart?: Date;
  until?: Date;
  count?: number;
}

export type Single = {
  type: "single";
  date: Date;
};

export type Recurring = {
  type: "recurring";
  recurrence: Recurrence;
};

export type BillEvent = {
  _id: string;
  title: string;
  amount?: number;
  userId: ObjectId;
} & (Single | Recurring);

// PlaygroundBillData: bill fields without the local id.
// Defined as an explicit discriminated union — Omit<PlaygroundBill, "id">
// does NOT distribute over unions and collapses the discriminant.
export type PlaygroundBillData =
  | { title: string; amount?: number; type: "single"; date: Date }
  | { title: string; amount?: number; type: "recurring"; recurrence: Recurrence };

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
