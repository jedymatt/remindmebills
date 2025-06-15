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

export interface IncomeProfile {
  payFrequency: "weekly" | "fortnightly" | "monthly";
  startDate: Date;
}
