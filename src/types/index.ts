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

export type SPayLater = {
  type: "spaylater";
  spaylater: {
    principalAmount: number;
    installmentMonths: 3 | 6 | 12;
    interestRate: number; // percentage (e.g., 0 for 0%, 1.5 for 1.5%)
    monthlyPayment: number; // calculated amount
    dtstart: Date;
  };
};

export type BillEvent = {
  _id: string;
  title: string;
  amount?: number;
  userId: ObjectId;
} & (Single | Recurring | SPayLater);

export interface IncomeProfile {
  payFrequency: "weekly" | "fortnightly" | "monthly";
  startDate: Date;
  amount?: number;
}
