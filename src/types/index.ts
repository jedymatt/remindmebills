import type { ObjectId } from "mongodb";

// todo: follow the type of rrule.js
export interface Recurrence {
  type: "weekly" | "monthly";
  interval: number;
  daysOfWeek?: number[];
  bymonthday?: number[];
  start?: Date;
  end?: Date;
  termInMonths?: number;
}

export type BillEvent = {
  _id: string;
  title: string;
  date?: Date;
  recurrence?: Recurrence;
  amount?: number;
  userId: ObjectId;
};

export interface IncomeProfile {
  payFrequency: "weekly" | "fortnightly" | "monthly";
  startDate: Date;
}
