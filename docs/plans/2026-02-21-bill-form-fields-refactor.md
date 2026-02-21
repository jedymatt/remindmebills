# BillFormFields Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the duplicated bill form schema and field JSX shared between `createBillForm.tsx` and `playgroundBillFormDialog.tsx` into a single reusable `BillFormFields` component.

**Architecture:** Create `src/components/billFormFields.tsx` exporting the shared Zod schemas and a `BillFormFields` component. Each consumer keeps its own container (Card / Dialog), form state, and submit handler. The shared component only renders fields. As a side effect, `createBillForm` gets the field-clearing bug fix from playground's implementation.

**Tech Stack:** Next.js 16 App Router, React Hook Form, Zod, Shadcn/ui, TypeScript strict mode (`~/` path alias → `src/`)

**Verification command:** `pnpm check` (runs ESLint + TypeScript — no test framework is configured)

---

### Task 1: Create `billFormFields.tsx` with shared schemas and component

**Files:**
- Create: `src/components/billFormFields.tsx`

**Context:** Both `createBillForm.tsx` and `playgroundBillFormDialog.tsx` define these identical Zod schemas locally:
- `BaseBillFormValues` — title + optional amount
- `SingleBillFormValues` — extends base with `type: "single"` + `date`
- `RecurringBillFormValues` — extends base with `type: "recurring"` + recurrence fields
- `BillFormValuesSchema` — discriminated union of the two

The `BillFormFields` component renders everything inside the `<Form>` tag from Title down through the Tabs (Once/Repeating and all recurrence sub-fields). It receives the `form` object, `recurringEndsWith` state, and a callback to change that state. It does NOT handle submission, routing, or tRPC.

The `onRecurringEndsWithChange` handler must clear opposing field values — this is the canonical (correct) version from `playgroundBillFormDialog`. It must call `form.setValue("recurrence.count", undefined)` when switching away from "count" and `form.setValue("recurrence.until", undefined)` when switching away from "until".

**Step 1: Create the file**

```tsx
"use client";

import { format } from "date-fns";
import { useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
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

// ── Shared Zod schemas ────────────────────────────────────────────────────────

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

export const BillFormValuesSchema = z.discriminatedUnion("type", [
  SingleBillFormValues,
  RecurringBillFormValues,
]);

export type BillFormValues = z.infer<typeof BillFormValuesSchema>;

// ── BillFormFields component ──────────────────────────────────────────────────

interface BillFormFieldsProps {
  form: UseFormReturn<BillFormValues>;
  recurringEndsWith: "never" | "until" | "count";
  onRecurringEndsWithChange: (value: "never" | "until" | "count") => void;
  formId: string;
  onSubmit: (data: BillFormValues) => void | Promise<void>;
}

export function BillFormFields({
  form,
  recurringEndsWith,
  onRecurringEndsWithChange,
  formId,
  onSubmit,
}: BillFormFieldsProps) {
  const [formType, formRecurrenceType] = useWatch({
    name: ["type", "recurrence.type"],
    control: form.control,
  });

  return (
    <Form {...form}>
      <form
        id={formId}
        onSubmit={form.handleSubmit(onSubmit)}
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
                onRecurringEndsWithChange(value as typeof recurringEndsWith)
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="never" id={`${formId}-never`} />
                <Label htmlFor={`${formId}-never`}>Never</Label>
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="count" id={`${formId}-count`} />
                <FormField
                  control={form.control}
                  name="recurrence.count"
                  rules={{ min: 1 }}
                  defaultValue={1}
                  disabled={recurringEndsWith !== "count"}
                  render={({ field }) => (
                    <FormItem className="pt-0.5">
                      <FormLabel
                        onClick={() => onRecurringEndsWithChange("count")}
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
                <RadioGroupItem value="until" id={`${formId}-until`} />
                <FormField
                  control={form.control}
                  name="recurrence.until"
                  disabled={recurringEndsWith !== "until"}
                  render={({ field }) => (
                    <FormItem className="pt-0.5">
                      <FormLabel
                        onClick={() => onRecurringEndsWithChange("until")}
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
  );
}
```

> **Note on radio button IDs:** The original files used hard-coded IDs (`never`, `count`, `until` in createBillForm; `pg-never`, `pg-count`, `pg-until` in playground). The shared component uses `${formId}-never` etc. to ensure uniqueness when both forms could theoretically exist on the same page. `formId` is `"create-bill-form"` and `"playground-bill-form"` respectively.

**Step 2: Verify types**

```bash
pnpm typecheck
```

Expected: No errors for `src/components/billFormFields.tsx`.

---

### Task 2: Refactor `createBillForm.tsx`

**Files:**
- Modify: `src/components/createBillForm.tsx`

**Context:** Replace the local schema definitions and ~280-line form JSX with imports from `billFormFields.tsx`. The component keeps its Card wrapper, `useForm` setup, tRPC mutation, and router navigation. Extract the `recurringEndsWith` state and the `handleRecurringEndsWithChange` function (with field-clearing, copied from playground's implementation — this fixes a bug).

**Step 1: Replace the file content**

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { BillFormFields, BillFormValuesSchema, type BillFormValues } from "./billFormFields";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";

export function CreateBillForm() {
  const router = useRouter();
  const form = useForm<BillFormValues>({
    resolver: zodResolver(BillFormValuesSchema),
    defaultValues: {
      title: "",
      type: "single",
    },
  });
  const utils = api.useUtils();
  const createBill = api.bill.create.useMutation({
    onSuccess: async () => {
      await utils.bill.getAll.invalidate();
      toast("Bill created successfully.");
      router.push("/dashboard");
    },
  });

  const [recurringEndsWith, setRecurringEndsWith] = useState<
    "never" | "until" | "count"
  >("never");

  const handleRecurringEndsWithChange = (
    value: "never" | "until" | "count",
  ) => {
    setRecurringEndsWith(value);
    if (value !== "count") form.setValue("recurrence.count", undefined);
    if (value !== "until") form.setValue("recurrence.until", undefined);
  };

  async function handleSubmit(data: BillFormValues) {
    await createBill.mutateAsync(data);
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Create a new bill</CardTitle>
        <CardDescription>
          Fill in the details of the bill you want to create.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BillFormFields
          form={form}
          recurringEndsWith={recurringEndsWith}
          onRecurringEndsWithChange={handleRecurringEndsWithChange}
          formId="create-bill-form"
          onSubmit={handleSubmit}
        />
      </CardContent>
      <CardFooter className="justify-between">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="create-bill-form"
          disabled={form.formState.isSubmitting}
        >
          Create
        </Button>
      </CardFooter>
    </Card>
  );
}
```

**Step 2: Verify**

```bash
pnpm check
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/billFormFields.tsx src/components/createBillForm.tsx
git commit -m "refactor: extract BillFormFields and update CreateBillForm"
```

---

### Task 3: Refactor `playgroundBillFormDialog.tsx`

**Files:**
- Modify: `src/components/playgroundBillFormDialog.tsx`

**Context:** Same as Task 2 — replace local schemas and form JSX with the shared component. The Dialog wrapper, UUID generation, `onSubmit` prop, and `handleOpenChange` all stay in this file.

**Step 1: Replace the file content**

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { BillFormFields, BillFormValuesSchema, type BillFormValues } from "./billFormFields";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import type { PlaygroundBill } from "~/types";

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

  const handleRecurringEndsWithChange = (
    value: "never" | "until" | "count",
  ) => {
    setRecurringEndsWith(value);
    if (value !== "count") form.setValue("recurrence.count", undefined);
    if (value !== "until") form.setValue("recurrence.until", undefined);
  };

  const handleSubmit = (data: BillFormValues) => {
    const bill: PlaygroundBill = {
      ...data,
      id: crypto.randomUUID(),
    };
    onSubmit(bill);
    form.reset();
    setRecurringEndsWith("never");
    onOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
      setRecurringEndsWith("never");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Hypothetical Bill</DialogTitle>
          <DialogDescription className="sr-only">
            Add a hypothetical bill to explore its impact on your budget.
          </DialogDescription>
        </DialogHeader>

        <BillFormFields
          form={form}
          recurringEndsWith={recurringEndsWith}
          onRecurringEndsWithChange={handleRecurringEndsWithChange}
          formId="playground-bill-form"
          onSubmit={handleSubmit}
        />

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

**Step 2: Verify**

```bash
pnpm check
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/playgroundBillFormDialog.tsx
git commit -m "refactor: update PlaygroundBillFormDialog to use BillFormFields"
```

---

### Task 4: Manual smoke test

**No automated tests exist.** Verify the app behaves correctly by running the dev server and testing both flows.

**Step 1: Start the dev server**

```bash
pnpm dev
```

**Step 2: Test CreateBillForm**

1. Navigate to `/bills/create`
2. Fill Title, select "Repeating" tab
3. Switch "Ends..." from Never → After → Never. Confirm the count field clears (this is the bug fix)
4. Fill in a valid form and submit — confirm bill is created and you're redirected to `/dashboard`

**Step 3: Test PlaygroundBillFormDialog**

1. Navigate to `/playground`
2. Initialize the playground (Fresh or Clone)
3. Click "Add Hypothetical Bill"
4. Switch recurrence "Ends..." modes — confirm fields clear correctly
5. Submit a bill — confirm it appears in the playground list
6. Close the dialog without submitting — confirm form resets on next open

**Step 4: Final check and commit if clean**

```bash
pnpm check
```

Expected: No errors. No final commit needed — all changes committed in Tasks 2 and 3.
