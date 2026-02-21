# Playground Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a "what-if" scenario planner allowing users to simulate adding hypothetical bills to assess affordability.

**Architecture:** Client-side only state management using React Context + useReducer. No new API endpoints. Reuse existing components with optional callback props for local state mutations.

**Tech Stack:** React Context, useReducer, TypeScript, existing Shadcn/ui components

**Note:** No test framework is configured in this project, so steps focus on implementation and manual verification.

---

### Task 1: Create PlaygroundBill Type

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add PlaygroundBill type**

Add below the existing `BillEvent` type:

```typescript
export type PlaygroundBill = Omit<BillEvent, "_id" | "userId"> & {
  id: string; // Local UUID instead of MongoDB ObjectId
};
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add PlaygroundBill type for local-only bills"
```

---

### Task 2: Create Playground Context

**Files:**
- Create: `src/components/playgroundContext.tsx`

**Step 1: Create the context file**

```typescript
"use client";

import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type PropsWithChildren,
} from "react";
import type { IncomeProfile, PlaygroundBill, BillEvent } from "~/types";

interface PlaygroundState {
  bills: PlaygroundBill[];
  incomeProfile: IncomeProfile | null;
  isInitialized: boolean;
}

type PlaygroundAction =
  | { type: "INIT_FRESH"; incomeProfile: IncomeProfile }
  | { type: "INIT_CLONE"; incomeProfile: IncomeProfile; bills: BillEvent[] }
  | { type: "ADD_BILL"; bill: PlaygroundBill }
  | { type: "UPDATE_BILL"; id: string; data: Omit<PlaygroundBill, "id"> }
  | { type: "DELETE_BILL"; id: string }
  | { type: "RESET" };

const initialState: PlaygroundState = {
  bills: [],
  incomeProfile: null,
  isInitialized: false,
};

function playgroundReducer(
  state: PlaygroundState,
  action: PlaygroundAction,
): PlaygroundState {
  switch (action.type) {
    case "INIT_FRESH":
      return {
        bills: [],
        incomeProfile: action.incomeProfile,
        isInitialized: true,
      };
    case "INIT_CLONE":
      return {
        bills: action.bills.map((bill) => ({
          ...bill,
          id: crypto.randomUUID(),
          // Remove MongoDB-specific fields
          _id: undefined,
          userId: undefined,
        })).map(({ _id, userId, ...rest }) => rest as PlaygroundBill),
        incomeProfile: action.incomeProfile,
        isInitialized: true,
      };
    case "ADD_BILL":
      return {
        ...state,
        bills: [...state.bills, action.bill],
      };
    case "UPDATE_BILL":
      return {
        ...state,
        bills: state.bills.map((bill) =>
          bill.id === action.id ? { ...action.data, id: action.id } : bill,
        ),
      };
    case "DELETE_BILL":
      return {
        ...state,
        bills: state.bills.filter((bill) => bill.id !== action.id),
      };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

const PlaygroundContext = createContext<PlaygroundState | null>(null);
const PlaygroundDispatchContext = createContext<Dispatch<PlaygroundAction> | null>(null);

export function PlaygroundProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(playgroundReducer, initialState);

  return (
    <PlaygroundContext.Provider value={state}>
      <PlaygroundDispatchContext.Provider value={dispatch}>
        {children}
      </PlaygroundDispatchContext.Provider>
    </PlaygroundContext.Provider>
  );
}

export function usePlayground() {
  const context = useContext(PlaygroundContext);
  if (!context) {
    throw new Error("usePlayground must be used within PlaygroundProvider");
  }
  return context;
}

export function usePlaygroundDispatch() {
  const context = useContext(PlaygroundDispatchContext);
  if (!context) {
    throw new Error("usePlaygroundDispatch must be used within PlaygroundProvider");
  }
  return context;
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/playgroundContext.tsx
git commit -m "feat: add PlaygroundContext for local state management"
```

---

### Task 3: Create Playground Banner Component

**Files:**
- Create: `src/components/playgroundBanner.tsx`

**Step 1: Create the banner component**

```typescript
import { AlertTriangle } from "lucide-react";

export function PlaygroundBanner() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <AlertTriangle className="size-4 shrink-0" />
      <p className="text-sm">
        <span className="font-medium">Playground Mode</span> — Changes are temporary and won&apos;t be saved.
      </p>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/playgroundBanner.tsx
git commit -m "feat: add PlaygroundBanner warning component"
```

---

### Task 4: Create Playground Start Screen

**Files:**
- Create: `src/components/playgroundStartScreen.tsx`

**Step 1: Create the start screen component**

```typescript
"use client";

import { FlaskConical, Copy, FileText } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { api } from "~/trpc/react";
import { usePlaygroundDispatch } from "./playgroundContext";
import type { IncomeProfile } from "~/types";

interface PlaygroundStartScreenProps {
  incomeProfile: IncomeProfile;
}

export function PlaygroundStartScreen({ incomeProfile }: PlaygroundStartScreenProps) {
  const dispatch = usePlaygroundDispatch();
  const { data: bills, isLoading: isBillsLoading } = api.bill.getAll.useQuery();

  const handleStartFresh = () => {
    dispatch({ type: "INIT_FRESH", incomeProfile });
  };

  const handleCloneBills = () => {
    dispatch({ type: "INIT_CLONE", incomeProfile, bills: bills ?? [] });
  };

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <FlaskConical className="text-muted-foreground mb-4 size-12" />
      <h1 className="text-2xl font-bold">Financial Playground</h1>
      <p className="text-muted-foreground mt-2 max-w-md text-center">
        Experiment with &quot;what-if&quot; scenarios. Add hypothetical bills to see how they&apos;d affect your budget. Nothing is saved.
      </p>

      <div className="mt-8 grid w-full max-w-lg gap-4 sm:grid-cols-2">
        <Card className="cursor-pointer transition-colors hover:border-primary" onClick={handleStartFresh}>
          <CardHeader className="pb-2">
            <FileText className="text-primary mb-2 size-8" />
            <CardTitle className="text-lg">Start Fresh</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Begin with a blank slate. Add only the bills you want to simulate.
            </CardDescription>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
          onClick={isBillsLoading ? undefined : handleCloneBills}
        >
          <CardHeader className="pb-2">
            <Copy className="text-primary mb-2 size-8" />
            <CardTitle className="text-lg">Clone My Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Start with a copy of your current bills, then add hypothetical expenses.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/playgroundStartScreen.tsx
git commit -m "feat: add PlaygroundStartScreen with fresh/clone options"
```

---

### Task 5: Create Playground Bill List Component

**Files:**
- Create: `src/components/playgroundBillList.tsx`

**Step 1: Create playground-specific bill list**

This is adapted from `src/app/_components/billList.tsx` but uses local state instead of tRPC queries:

```typescript
"use client";

import { formatDate, isEqual, subDays } from "date-fns";
import { sumBy } from "lodash";
import { ChevronDown, ChevronUp, EyeClosedIcon, EyeIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { getBillsByPayPeriod } from "~/lib/bill-utils";
import { cn } from "~/lib/utils";
import type { BillEvent, IncomeProfile, PlaygroundBill } from "~/types";

function formatPHP(value: number, signDisplay?: "always") {
  return value.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    signDisplay,
  });
}

interface PlaygroundBillListCardProps {
  bills: (PlaygroundBill & { date: Date })[];
  payDate: Date;
  after: Date | null;
  isCurrent: boolean;
  ingoing: number;
  onBillClick: (billId: string) => void;
}

function PlaygroundBillListCard({
  bills,
  payDate,
  after,
  isCurrent,
  ingoing,
  onBillClick,
}: PlaygroundBillListCardProps) {
  const [excludedBills, setExcludedBills] = useState<string[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const outgoing = useMemo(
    () =>
      sumBy(
        bills.filter((bill) => !excludedBills.includes(bill.id)),
        (bill) => bill.amount ?? 0,
      ),
    [bills, excludedBills],
  );

  const balance = ingoing - outgoing;

  const toggleExclude = (billId: string) => {
    setExcludedBills((prev) =>
      prev.includes(billId)
        ? prev.filter((id) => id !== billId)
        : [...prev, billId],
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border",
        isCurrent
          ? "ring-primary/20 border-primary/50 ring-2"
          : "border-border",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-5 py-3.5",
          isCurrent ? "bg-primary/5" : "bg-muted/30",
        )}
      >
        <div>
          <div className="text-sm font-semibold">
            {formatDate(payDate, "MMM d")}
            {after && <> – {formatDate(subDays(after, 1), "MMM d, yyyy")}</>}
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {bills.length} {bills.length === 1 ? "bill" : "bills"}
          </div>
        </div>
        {isCurrent && (
          <span className="bg-primary text-primary-foreground rounded-full px-2.5 py-0.5 text-[11px] font-medium">
            Current
          </span>
        )}
      </div>

      {/* Bill list */}
      <div className="flex-1 px-5 py-2">
        {bills.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No bills this period
          </p>
        ) : (
          <ul className="divide-y">
            {bills.map((bill) => {
              const isExcluded = excludedBills.includes(bill.id);
              return (
                <li
                  key={bill.id}
                  className={cn(
                    "flex items-center gap-3 py-3 cursor-pointer hover:bg-muted/50 -mx-5 px-5 transition-colors",
                    isEqual(bill.date, payDate) &&
                      "text-yellow-700 dark:text-yellow-500",
                    isExcluded && "opacity-40",
                  )}
                  onClick={() => onBillClick(bill.id)}
                >
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExclude(bill.id);
                    }}
                  >
                    {isExcluded ? (
                      <EyeClosedIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {bill.title}
                    </div>
                    {!isExcluded && (
                      <div className="text-muted-foreground text-xs">
                        Due {formatDate(bill.date, "MMM d")}
                      </div>
                    )}
                  </div>
                  {!isExcluded && (
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {bill.amount != null ? (
                        formatPHP(bill.amount)
                      ) : (
                        <span className="text-muted-foreground text-xs font-normal">
                          —
                        </span>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Summary footer */}
      {bills.length > 0 && (
        <div className="bg-muted/30 border-t px-5 py-3">
          <button
            type="button"
            className="flex w-full items-center justify-between"
            onClick={() => setShowBreakdown((prev) => !prev)}
          >
            <span className="text-muted-foreground text-xs">Balance</span>
            <span className="flex items-center gap-1">
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  balance > 0
                    ? "text-green-600 dark:text-green-400"
                    : balance < 0
                      ? "text-red-600 dark:text-red-400"
                      : "",
                )}
              >
                {formatPHP(balance, "always")}
              </span>
              {showBreakdown ? (
                <ChevronUp className="text-muted-foreground size-3.5" />
              ) : (
                <ChevronDown className="text-muted-foreground size-3.5" />
              )}
            </span>
          </button>
          {showBreakdown && (
            <div className="text-muted-foreground mt-2 space-y-1 border-t pt-2 text-xs">
              <div className="flex justify-between">
                <span>Income</span>
                <span className="tabular-nums">
                  {formatPHP(ingoing, "always")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Bills</span>
                <span className="tabular-nums">
                  {formatPHP(-outgoing, "always")}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface PlaygroundBillListProps {
  bills: PlaygroundBill[];
  incomeProfile: IncomeProfile;
  onBillClick: (billId: string) => void;
}

export function PlaygroundBillList({ bills, incomeProfile, onBillClick }: PlaygroundBillListProps) {
  // Convert PlaygroundBill[] to BillEvent[] shape for getBillsByPayPeriod
  const billsAsBillEvent = bills.map((bill) => ({
    ...bill,
    _id: bill.id, // Map id to _id for compatibility
  })) as unknown as BillEvent[];

  const billsInPayPeriod = getBillsByPayPeriod(billsAsBillEvent, incomeProfile);
  const ingoing = incomeProfile.amount ?? 0;

  // Map back to use `id` instead of `_id`
  const mappedPeriods = billsInPayPeriod.map((period) => ({
    ...period,
    bills: period.bills.map((bill) => ({
      ...bill,
      id: bill._id,
    })) as (PlaygroundBill & { date: Date })[],
  }));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {mappedPeriods.map(({ payDate, bills, after }, index) => (
        <PlaygroundBillListCard
          key={index}
          payDate={payDate}
          bills={bills}
          after={after}
          isCurrent={index === 0}
          ingoing={ingoing}
          onBillClick={onBillClick}
        />
      ))}
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/playgroundBillList.tsx
git commit -m "feat: add PlaygroundBillList using local state"
```

---

### Task 6: Create Playground Bill Form Dialog

**Files:**
- Create: `src/components/playgroundBillFormDialog.tsx`

**Step 1: Create the dialog component**

This wraps the bill form logic for adding bills in playground mode:

```typescript
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import type { PlaygroundBill } from "~/types";

const BaseBillFormValues = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  amount: z.coerce.number<number>().min(0).optional(),
});

const SingleBillFormValues = BaseBillFormValues.extend({
  type: z.literal("single"),
  date: z.coerce.date<Date>(),
});

const RecurringBillFormValues = BaseBillFormValues.extend({
  type: z.literal("recurring"),
  recurrence: z.object({
    type: z.enum(["weekly", "monthly"]),
    interval: z.coerce.number<number>().min(1),
    bymonthday: z.array(z.number()).optional(),
    dtstart: z.coerce.date<Date>(),
    until: z.coerce.date<Date>().optional(),
    count: z.coerce.number<number>().min(1).optional(),
  }),
});

const BillFormValuesSchema = z.discriminatedUnion("type", [
  SingleBillFormValues,
  RecurringBillFormValues,
]);

type BillFormValues = z.infer<typeof BillFormValuesSchema>;

interface PlaygroundBillFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (bill: PlaygroundBill) => void;
}

export function PlaygroundBillFormDialog({
  open,
  onOpenChange,
  onSubmit,
}: PlaygroundBillFormDialogProps) {
  const form = useForm<BillFormValues>({
    resolver: zodResolver(BillFormValuesSchema),
    defaultValues: {
      title: "",
      type: "single",
    },
  });

  const [recurringEndsWith, setRecurringEndsWith] = useState<
    "never" | "until" | "count"
  >("never");

  const [formType, formRecurrenceType] = useWatch({
    name: ["type", "recurrence.type"],
    control: form.control,
  });

  const handleSubmit = (data: BillFormValues) => {
    const bill: PlaygroundBill = {
      ...data,
      id: crypto.randomUUID(),
    };
    onSubmit(bill);
    form.reset();
    onOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Hypothetical Bill</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            id="playground-bill-form"
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="e.g., Car Loan" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Amount"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Separator />

            <Tabs
              value={formType}
              onValueChange={(value) =>
                form.setValue("type", value as BillFormValues["type"])
              }
            >
              <TabsList className="w-full">
                <TabsTrigger value="single">Once</TabsTrigger>
                <TabsTrigger value="recurring">Repeating</TabsTrigger>
              </TabsList>
              <TabsContent value="single" className="space-y-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          placeholder="Date"
                          {...field}
                          value={
                            field.value ? format(field.value, "yyyy-MM-dd") : ""
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
              <TabsContent value="recurring" className="space-y-4">
                <FormField
                  control={form.control}
                  name="recurrence.type"
                  defaultValue="monthly"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Every</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weekly">Week</SelectItem>
                          <SelectItem value="monthly">Month</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="recurrence.interval"
                  defaultValue={1}
                  rules={{ min: 1 }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Repeats every {Number(field.value) ?? 1}{" "}
                        {formRecurrenceType === "weekly"
                          ? "week" + (Number(field.value) !== 1 ? "s" : "")
                          : "month" + (Number(field.value) !== 1 ? "s" : "")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Interval"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="recurrence.dtstart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Start</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          placeholder="Date Start"
                          {...field}
                          value={
                            field.value ? format(field.value, "yyyy-MM-dd") : ""
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormLabel>Ends...</FormLabel>
                <RadioGroup
                  value={recurringEndsWith}
                  onValueChange={(value) =>
                    setRecurringEndsWith(value as typeof recurringEndsWith)
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="never" id="pg-never" />
                    <Label htmlFor="pg-never">Never</Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="count" id="pg-count" />
                    <FormField
                      control={form.control}
                      name="recurrence.count"
                      rules={{ min: 1 }}
                      defaultValue={1}
                      disabled={recurringEndsWith !== "count"}
                      render={({ field }) => (
                        <FormItem className="pt-0.5">
                          <FormLabel
                            onClick={() => setRecurringEndsWith("count")}
                          >
                            After
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="No. of terms"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="until" id="pg-until" />
                    <FormField
                      control={form.control}
                      name="recurrence.until"
                      disabled={recurringEndsWith !== "until"}
                      render={({ field }) => (
                        <FormItem className="pt-0.5">
                          <FormLabel
                            onClick={() => setRecurringEndsWith("until")}
                          >
                            Until
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              placeholder="Until"
                              {...field}
                              value={
                                field.value
                                  ? format(field.value, "yyyy-MM-dd")
                                  : ""
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </RadioGroup>
              </TabsContent>
            </Tabs>
          </form>
        </Form>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="playground-bill-form">
            Add Bill
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/playgroundBillFormDialog.tsx
git commit -m "feat: add PlaygroundBillFormDialog for adding hypothetical bills"
```

---

### Task 7: Create Playground Bill Modal

**Files:**
- Create: `src/components/playgroundBillModal.tsx`

**Step 1: Create the modal for viewing/editing/deleting playground bills**

```typescript
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type { PlaygroundBill } from "~/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

const BaseBillFormValues = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  amount: z.coerce.number<number>().min(0).optional(),
});

const SingleBillFormValues = BaseBillFormValues.extend({
  type: z.literal("single"),
  date: z.coerce.date<Date>(),
});

const RecurringBillFormValues = BaseBillFormValues.extend({
  type: z.literal("recurring"),
  recurrence: z.object({
    type: z.enum(["weekly", "monthly"]),
    interval: z.coerce.number<number>().min(1),
    bymonthday: z.array(z.number()).optional(),
    dtstart: z.coerce.date<Date>(),
    until: z.coerce.date<Date>().optional(),
    count: z.coerce.number<number>().min(1).optional(),
  }),
});

const BillFormValuesSchema = z.discriminatedUnion("type", [
  SingleBillFormValues,
  RecurringBillFormValues,
]);

type BillFormValues = z.infer<typeof BillFormValuesSchema>;

function formatPHP(value: number) {
  return value.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

function PlaygroundBillViewMode({
  bill,
  onEdit,
  onDelete,
}: {
  bill: PlaygroundBill;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-6">
      {bill.type === "recurring" && (
        <Badge variant="secondary">Recurring</Badge>
      )}

      <div className="space-y-4">
        <div>
          <p className="text-muted-foreground text-sm">Title</p>
          <p className="text-lg font-medium">{bill.title}</p>
        </div>

        <div>
          <p className="text-muted-foreground text-sm">Amount</p>
          <p className="text-lg font-medium">
            {bill.amount != null ? formatPHP(bill.amount) : "Not set"}
          </p>
        </div>

        {bill.type === "single" ? (
          <div>
            <p className="text-muted-foreground text-sm">Due Date</p>
            <p className="font-medium">{format(bill.date, "MMMM d, yyyy")}</p>
          </div>
        ) : (
          <div>
            <p className="text-muted-foreground text-sm">Schedule</p>
            <p className="font-medium">
              Every {bill.recurrence.interval}{" "}
              {bill.recurrence.type === "weekly" ? "week" : "month"}
              {bill.recurrence.interval !== 1 ? "s" : ""}
            </p>
            <p className="text-muted-foreground text-sm">
              Starting {format(bill.recurrence.dtstart!, "MMMM d, yyyy")}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onDelete}>
          <Trash2 className="mr-1 size-4" />
          Delete
        </Button>
        <Button size="sm" onClick={onEdit}>
          <Pencil className="mr-1 size-4" />
          Edit
        </Button>
      </div>
    </div>
  );
}

function PlaygroundBillEditMode({
  bill,
  onCancel,
  onSave,
}: {
  bill: PlaygroundBill;
  onCancel: () => void;
  onSave: (data: Omit<PlaygroundBill, "id">) => void;
}) {
  const form = useForm<BillFormValues>({
    resolver: zodResolver(BillFormValuesSchema),
    defaultValues: {
      title: bill.title,
      amount: bill.amount,
      type: bill.type,
      ...(bill.type === "single"
        ? { date: bill.date }
        : {
            recurrence: {
              type: bill.recurrence.type,
              interval: bill.recurrence.interval,
              bymonthday: bill.recurrence.bymonthday,
              dtstart: bill.recurrence.dtstart,
              until: bill.recurrence.until,
              count: bill.recurrence.count,
            },
          }),
    } as BillFormValues,
  });

  const [recurringEndsWith, setRecurringEndsWith] = useState<
    "never" | "until" | "count"
  >(
    bill.type === "recurring"
      ? bill.recurrence.count
        ? "count"
        : bill.recurrence.until
          ? "until"
          : "never"
      : "never",
  );

  const [formType, formRecurrenceType] = useWatch({
    name: ["type", "recurrence.type"],
    control: form.control,
  });

  const handleSubmit = (data: BillFormValues) => {
    onSave(data);
  };

  return (
    <div>
      <Form {...form}>
        <form
          id="edit-playground-bill-form"
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="Title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount (optional)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Amount"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator />

          <Tabs
            value={formType}
            onValueChange={(value) =>
              form.setValue("type", value as BillFormValues["type"])
            }
          >
            <TabsList className="w-full">
              <TabsTrigger value="single">Once</TabsTrigger>
              <TabsTrigger value="recurring">Repeating</TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="space-y-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        placeholder="Date"
                        {...field}
                        value={
                          field.value ? format(field.value, "yyyy-MM-dd") : ""
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>

            <TabsContent value="recurring" className="space-y-4">
              <FormField
                control={form.control}
                name="recurrence.type"
                defaultValue="monthly"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Every</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">Week</SelectItem>
                        <SelectItem value="monthly">Month</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recurrence.interval"
                defaultValue={1}
                rules={{ min: 1 }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Repeats every {Number(field.value) ?? 1}{" "}
                      {formRecurrenceType === "weekly"
                        ? "week" + (Number(field.value) !== 1 ? "s" : "")
                        : "month" + (Number(field.value) !== 1 ? "s" : "")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Interval"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recurrence.dtstart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date Start</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        placeholder="Date Start"
                        {...field}
                        value={
                          field.value ? format(field.value, "yyyy-MM-dd") : ""
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormLabel>Ends...</FormLabel>
              <RadioGroup
                value={recurringEndsWith}
                onValueChange={(value) =>
                  setRecurringEndsWith(value as typeof recurringEndsWith)
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="never" id="pg-edit-never" />
                  <Label htmlFor="pg-edit-never">Never</Label>
                </div>

                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="count" id="pg-edit-count" />
                  <FormField
                    control={form.control}
                    name="recurrence.count"
                    rules={{ min: 1 }}
                    defaultValue={1}
                    disabled={recurringEndsWith !== "count"}
                    render={({ field }) => (
                      <FormItem className="pt-0.5">
                        <FormLabel
                          onClick={() => setRecurringEndsWith("count")}
                        >
                          After
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="No. of terms"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="until" id="pg-edit-until" />
                  <FormField
                    control={form.control}
                    name="recurrence.until"
                    disabled={recurringEndsWith !== "until"}
                    render={({ field }) => (
                      <FormItem className="pt-0.5">
                        <FormLabel
                          onClick={() => setRecurringEndsWith("until")}
                        >
                          Until
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            placeholder="Until"
                            {...field}
                            value={
                              field.value
                                ? format(field.value, "yyyy-MM-dd")
                                : ""
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </RadioGroup>
            </TabsContent>
          </Tabs>
        </form>
      </Form>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" form="edit-playground-bill-form">
          Save Changes
        </Button>
      </div>
    </div>
  );
}

interface PlaygroundBillModalProps {
  bill: PlaygroundBill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, data: Omit<PlaygroundBill, "id">) => void;
  onDelete: (id: string) => void;
}

export function PlaygroundBillModal({
  bill,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: PlaygroundBillModalProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setMode("view");
      setShowDeleteDialog(false);
    }
    onOpenChange(open);
  };

  const handleEdit = () => {
    setMode("edit");
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleCancelEdit = () => {
    setMode("view");
  };

  const handleSave = (data: Omit<PlaygroundBill, "id">) => {
    if (bill) {
      onUpdate(bill.id, data);
      setMode("view");
    }
  };

  const handleConfirmDelete = () => {
    if (bill) {
      onDelete(bill.id);
      onOpenChange(false);
    }
  };

  if (!bill) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {mode === "view" ? "Bill Details" : "Edit Bill"}
            </DialogTitle>
          </DialogHeader>

          {mode === "view" ? (
            <PlaygroundBillViewMode
              bill={bill}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ) : (
            <PlaygroundBillEditMode
              bill={bill}
              onCancel={handleCancelEdit}
              onSave={handleSave}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bill</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &quot;{bill.title}&quot; from the playground?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/playgroundBillModal.tsx
git commit -m "feat: add PlaygroundBillModal for view/edit/delete"
```

---

### Task 8: Create Playground Workspace Component

**Files:**
- Create: `src/components/playgroundWorkspace.tsx`

**Step 1: Create the active playground workspace**

```typescript
"use client";

import { CalendarPlus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { FinancialSummaryCards } from "~/components/financialSummaryCards";
import type { BillEvent, PlaygroundBill } from "~/types";
import { PlaygroundBanner } from "./playgroundBanner";
import { PlaygroundBillFormDialog } from "./playgroundBillFormDialog";
import { PlaygroundBillList } from "./playgroundBillList";
import { PlaygroundBillModal } from "./playgroundBillModal";
import { usePlayground, usePlaygroundDispatch } from "./playgroundContext";
import { Button } from "./ui/button";

export function PlaygroundWorkspace() {
  const { bills, incomeProfile } = usePlayground();
  const dispatch = usePlaygroundDispatch();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<PlaygroundBill | null>(null);
  const [billModalOpen, setBillModalOpen] = useState(false);

  if (!incomeProfile) return null;

  // Convert PlaygroundBill[] to BillEvent[] for FinancialSummaryCards
  const billsAsBillEvent = bills.map((bill) => ({
    ...bill,
    _id: bill.id,
    userId: null as any, // Not used by FinancialSummaryCards
  })) as unknown as BillEvent[];

  const handleAddBill = (bill: PlaygroundBill) => {
    dispatch({ type: "ADD_BILL", bill });
  };

  const handleBillClick = (billId: string) => {
    const bill = bills.find((b) => b.id === billId);
    if (bill) {
      setSelectedBill(bill);
      setBillModalOpen(true);
    }
  };

  const handleUpdateBill = (id: string, data: Omit<PlaygroundBill, "id">) => {
    dispatch({ type: "UPDATE_BILL", id, data });
    // Update selected bill reference
    setSelectedBill({ ...data, id });
  };

  const handleDeleteBill = (id: string) => {
    dispatch({ type: "DELETE_BILL", id });
  };

  const handleReset = () => {
    dispatch({ type: "RESET" });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PlaygroundBanner />

      <FinancialSummaryCards
        incomeProfile={incomeProfile}
        bills={billsAsBillEvent}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Bills by Pay Period</h2>
        <Button size="sm" onClick={() => setAddDialogOpen(true)}>
          Add Bill <CalendarPlus className="ml-1 size-4" />
        </Button>
      </div>

      {bills.length > 0 ? (
        <PlaygroundBillList
          bills={bills}
          incomeProfile={incomeProfile}
          onBillClick={handleBillClick}
        />
      ) : (
        <div className="flex flex-col items-center rounded-lg border border-dashed py-12">
          <CalendarPlus className="text-muted-foreground mb-3 size-10" />
          <h3 className="text-lg font-medium">No bills yet</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Add a hypothetical bill to see how it affects your budget.
          </p>
          <Button className="mt-4" onClick={() => setAddDialogOpen(true)}>
            Add Bill <CalendarPlus className="ml-1 size-4" />
          </Button>
        </div>
      )}

      <div className="flex justify-center pt-4">
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="mr-2 size-4" />
          Reset Playground
        </Button>
      </div>

      <PlaygroundBillFormDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAddBill}
      />

      <PlaygroundBillModal
        bill={selectedBill}
        open={billModalOpen}
        onOpenChange={setBillModalOpen}
        onUpdate={handleUpdateBill}
        onDelete={handleDeleteBill}
      />
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/playgroundWorkspace.tsx
git commit -m "feat: add PlaygroundWorkspace with summary cards and bill list"
```

---

### Task 9: Create Playground Page Component

**Files:**
- Create: `src/components/playgroundPage.tsx`

**Step 1: Create the main page component**

```typescript
"use client";

import { Receipt } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { AuthenticatedLayout } from "./authenticatedLayout";
import { PlaygroundProvider, usePlayground } from "./playgroundContext";
import { PlaygroundStartScreen } from "./playgroundStartScreen";
import { PlaygroundWorkspace } from "./playgroundWorkspace";
import { Skeleton } from "./ui/skeleton";
import { Card, CardContent } from "./ui/card";

function PlaygroundSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-2 p-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Content skeleton */}
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

function NoIncomeProfileState() {
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="flex flex-col items-center justify-center py-16">
        <Receipt className="text-muted-foreground mb-4 size-12" />
        <h2 className="text-2xl font-bold">Set Up Your Income First</h2>
        <p className="text-muted-foreground mt-1 max-w-md text-center">
          To use the playground, you need to set up your income profile on the dashboard first.
        </p>
        <a
          href="/dashboard"
          className="text-primary mt-4 text-sm font-medium hover:underline"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}

function PlaygroundContent() {
  const { isInitialized, incomeProfile } = usePlayground();

  if (!isInitialized) {
    return <PlaygroundStartScreen incomeProfile={incomeProfile!} />;
  }

  return <PlaygroundWorkspace />;
}

function PlaygroundPageInner() {
  const { data: incomeProfile, isLoading } = api.income.getIncomeProfile.useQuery();

  if (isLoading) {
    return <PlaygroundSkeleton />;
  }

  if (!incomeProfile) {
    return <NoIncomeProfileState />;
  }

  return (
    <PlaygroundProvider>
      <PlaygroundContent />
    </PlaygroundProvider>
  );
}

export function PlaygroundPage() {
  return (
    <AuthenticatedLayout>
      <PlaygroundPageInner />
    </AuthenticatedLayout>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/playgroundPage.tsx
git commit -m "feat: add PlaygroundPage with loading and no-income states"
```

---

### Task 10: Create Playground Route

**Files:**
- Create: `src/app/playground/page.tsx`
- Create: `src/app/playground/layout.tsx`

**Step 1: Create the layout file**

```typescript
import type { PropsWithChildren } from "react";

export default function PlaygroundLayout({ children }: PropsWithChildren) {
  return children;
}
```

**Step 2: Create the page file**

```typescript
import { PlaygroundPage } from "~/components/playgroundPage";

export const dynamic = "force-dynamic";

export default function Playground() {
  return <PlaygroundPage />;
}
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/playground/
git commit -m "feat: add /playground route"
```

---

### Task 11: Add Playground Nav Link

**Files:**
- Modify: `src/components/authenticatedLayout.tsx`

**Step 1: Update the header to include Playground link**

Add import for `FlaskConical` and `usePathname`:

```typescript
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type PropsWithChildren } from "react";
import { FlaskConical, Receipt } from "lucide-react";
```

**Step 2: Update the header section**

Replace the header section with navigation links:

```typescript
export function AuthenticatedLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background/80 sticky top-0 z-50 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Receipt className="size-5" />
              <span>Remind Me Bills</span>
            </Link>
            <nav className="hidden items-center gap-4 sm:flex">
              <Link
                href="/dashboard"
                className={`text-sm font-medium transition-colors hover:text-foreground ${
                  pathname === "/dashboard"
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/playground"
                className={`flex items-center gap-1 text-sm font-medium transition-colors hover:text-foreground ${
                  pathname === "/playground"
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <FlaskConical className="size-3.5" />
                Playground
              </Link>
            </nav>
          </div>
          <UserNav />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t px-4 py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 text-sm">
          <Receipt className="text-muted-foreground size-4" />
          <span className="text-muted-foreground">
            Remind Me Bills &copy; {new Date().getFullYear()}
          </span>
        </div>
      </footer>
    </div>
  );
}
```

**Step 3: Verify the app runs**

Run: `pnpm dev`
Expected: App starts, playground link appears in nav

**Step 4: Commit**

```bash
git add src/components/authenticatedLayout.tsx
git commit -m "feat: add Playground nav link to authenticated layout"
```

---

### Task 12: Fix PlaygroundContext INIT_CLONE Logic

**Files:**
- Modify: `src/components/playgroundContext.tsx`

**Step 1: Fix the INIT_CLONE case to properly map bills**

The current logic has an issue with how it removes MongoDB fields. Update the INIT_CLONE case:

```typescript
case "INIT_CLONE":
  return {
    bills: action.bills.map((bill): PlaygroundBill => {
      const { _id, userId, ...rest } = bill as any;
      return {
        ...rest,
        id: crypto.randomUUID(),
      };
    }),
    incomeProfile: action.incomeProfile,
    isInitialized: true,
  };
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/playgroundContext.tsx
git commit -m "fix: correct INIT_CLONE bill mapping in PlaygroundContext"
```

---

### Task 13: Fix PlaygroundStartScreen Missing Income Profile

**Files:**
- Modify: `src/components/playgroundPage.tsx`

**Step 1: Pass incomeProfile to PlaygroundProvider initial context**

The current implementation has an issue - PlaygroundStartScreen needs incomeProfile from tRPC, but PlaygroundContext doesn't have it until INIT is called. Update PlaygroundPageInner:

```typescript
function PlaygroundPageInner() {
  const { data: incomeProfile, isLoading } = api.income.getIncomeProfile.useQuery();

  if (isLoading) {
    return <PlaygroundSkeleton />;
  }

  if (!incomeProfile) {
    return <NoIncomeProfileState />;
  }

  return (
    <PlaygroundProvider>
      <PlaygroundContentWithProfile incomeProfile={incomeProfile} />
    </PlaygroundProvider>
  );
}

function PlaygroundContentWithProfile({ incomeProfile }: { incomeProfile: IncomeProfile }) {
  const { isInitialized } = usePlayground();

  if (!isInitialized) {
    return <PlaygroundStartScreen incomeProfile={incomeProfile} />;
  }

  return <PlaygroundWorkspace />;
}
```

Add import for IncomeProfile type:

```typescript
import type { IncomeProfile } from "~/types";
```

**Step 2: Remove the incomeProfile check from PlaygroundContent (delete the old function)**

**Step 3: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/playgroundPage.tsx
git commit -m "fix: pass incomeProfile from query to PlaygroundStartScreen"
```

---

### Task 14: Manual Verification

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Verify playground flow**

1. Navigate to `/playground`
2. If no income profile → should redirect message to dashboard
3. If income profile exists → should see start screen with "Start Fresh" and "Clone My Bills"
4. Click "Start Fresh" → empty playground workspace
5. Add a hypothetical bill → verify it appears in list
6. Click on bill → view/edit/delete modal works
7. Click "Reset Playground" → returns to start screen
8. Click "Clone My Bills" → should copy existing bills

**Step 3: Run checks**

Run: `pnpm check`
Expected: No lint or type errors

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete playground feature implementation"
```

---

### Task 15: Create Summary Commit (Optional)

If you want a clean single commit for the feature branch:

```bash
git log --oneline main..HEAD  # Review commits
# If desired, squash into single commit before PR
```
