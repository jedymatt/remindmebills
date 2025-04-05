import type { ObjectId } from "mongodb";

export interface Recurrence {
  type: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  daysOfWeek?: number[];
  daysOfMonth?: number[];
  monthsOfYear?: number[];
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
