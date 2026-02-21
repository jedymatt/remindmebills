# Bill Modal BillFormFields Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace duplicate Zod schemas and form JSX in `billModal.tsx` and `playgroundBillModal.tsx` with the shared `BillFormFields` component, and fix the field-clearing bug in `BillEditMode`.

**Architecture:** Both edit-mode sub-components (`BillEditMode`, `PlaygroundBillEditMode`) each own 28 lines of Zod schema definitions and ~160–220 lines of form JSX that are already extracted into `billFormFields.tsx`. This plan removes the local copies and substitutes `<BillFormFields />`. No API or server changes.

**Tech Stack:** Next.js 16, TypeScript (strict), React Hook Form, Zod, tRPC, Shadcn/ui

**Design doc:** `docs/plans/2026-02-21-bill-modal-bill-form-fields-refactor-design.md`

---

### Task 1: Refactor `billModal.tsx`

**Files:**
- Modify: `src/components/billModal.tsx`

**Step 1: Replace imports**

Replace the entire import block (lines 1–50) with:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import type { BillEvent } from "~/types";
import {
  BillFormFields,
  BillFormValuesSchema,
  type BillFormValues,
} from "~/components/billFormFields";
import { BillViewMode } from "./billViewMode";
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
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Skeleton } from "./ui/skeleton";
```

Removed: `z`, `format`, `useWatch`, `Form`/`FormControl`/`FormField`/`FormItem`/`FormLabel`/`FormMessage`, `Input`, `Label`, `RadioGroup`/`RadioGroupItem`, `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue`, `Separator`, `Tabs`/`TabsContent`/`TabsList`/`TabsTrigger`.

**Step 2: Remove local Zod schemas**

Delete lines 58–85 (the `BaseBillFormValues`, `SingleBillFormValues`, `RecurringBillFormValues`, `BillFormValuesSchema`, and `BillFormValues` definitions). These are now imported from `~/components/billFormFields`.

**Step 3: Replace `BillEditMode` body**

Replace the `BillEditMode` function (lines 87–407 in the original) with:

```tsx
function BillEditMode({
  bill,
  onCancel,
  onSaveSuccess,
}: {
  bill: BillEvent;
  onCancel: () => void;
  onSaveSuccess: () => void;
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

  const utils = api.useUtils();
  const updateBill = api.bill.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.bill.getAll.invalidate(),
        utils.bill.getById.invalidate({ id: bill._id }),
      ]);
      toast.success("Bill updated successfully");
      onSaveSuccess();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update bill");
    },
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

  const handleRecurringEndsWithChange = (
    value: "never" | "until" | "count",
  ) => {
    setRecurringEndsWith(value);
    if (value !== "count") form.setValue("recurrence.count", undefined);
    if (value !== "until") form.setValue("recurrence.until", undefined);
  };

  async function handleSubmit(data: BillFormValues) {
    await updateBill.mutateAsync({
      id: bill._id,
      data,
    });
  }

  return (
    <div>
      <BillFormFields
        form={form}
        recurringEndsWith={recurringEndsWith}
        onRecurringEndsWithChange={handleRecurringEndsWithChange}
        formId="edit-bill-form"
        onSubmit={handleSubmit}
      />

      <div className="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={updateBill.isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="edit-bill-form"
          disabled={updateBill.isPending}
        >
          {updateBill.isPending && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
```

Key changes vs original:
- `useWatch` call removed (handled inside `BillFormFields`)
- `handleRecurringEndsWithChange` added with field-clearing (bug fix)
- All form JSX replaced by `<BillFormFields />`

**Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors. If TypeScript complains about `BillFormValues` or `BillFormValuesSchema` not found, verify the import path is `~/components/billFormFields` (not `./billFormFields`).

**Step 5: Commit**

```bash
git add src/components/billModal.tsx
git commit -m "refactor: update BillEditMode to use BillFormFields"
```

---

### Task 2: Refactor `playgroundBillModal.tsx`

**Files:**
- Modify: `src/components/playgroundBillModal.tsx`

**Step 1: Replace imports**

Replace the import block (lines 1–48 in the original) with:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { PlaygroundBill, PlaygroundBillData } from "~/types";
import {
  BillFormFields,
  BillFormValuesSchema,
  type BillFormValues,
} from "~/components/billFormFields";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
```

Note: `format` stays — still used in `PlaygroundBillViewMode`.
Removed: `z`, `useWatch`, `Form`/`FormControl`/`FormField`/`FormItem`/`FormLabel`/`FormMessage`, `Input`, `Label`, `RadioGroup`/`RadioGroupItem`, `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue`, `Separator`, `Tabs`/`TabsContent`/`TabsList`/`TabsTrigger`.

**Step 2: Remove local Zod schemas**

Delete lines 50–77 (the `BaseBillFormValues`, `SingleBillFormValues`, `RecurringBillFormValues`, `BillFormValuesSchema`, and `BillFormValues` definitions).

**Step 3: Replace `PlaygroundBillEditMode` body**

Replace the `PlaygroundBillEditMode` function (lines 150–452 in the original) with:

```tsx
function PlaygroundBillEditMode({
  bill,
  onCancel,
  onSave,
}: {
  bill: PlaygroundBill;
  onCancel: () => void;
  onSave: (data: PlaygroundBillData) => void;
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

  const handleRecurringEndsWithChange = (
    value: "never" | "until" | "count",
  ) => {
    setRecurringEndsWith(value);
    if (value !== "count") form.setValue("recurrence.count", undefined);
    if (value !== "until") form.setValue("recurrence.until", undefined);
  };

  const handleSubmit = (data: BillFormValues) => {
    onSave(data);
  };

  return (
    <div>
      <BillFormFields
        form={form}
        recurringEndsWith={recurringEndsWith}
        onRecurringEndsWithChange={handleRecurringEndsWithChange}
        formId="edit-playground-bill-form"
        onSubmit={handleSubmit}
      />

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
```

Key change: `useWatch` call removed (handled inside `BillFormFields`). The `handleRecurringEndsWithChange` implementation was already correct with field-clearing.

**Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

**Step 5: Run lint check**

```bash
pnpm lint
```

Expected: no warnings or errors.

**Step 6: Commit**

```bash
git add src/components/playgroundBillModal.tsx
git commit -m "refactor: update PlaygroundBillEditMode to use BillFormFields"
```

---

### Task 3: Final check

**Step 1: Run full check**

```bash
pnpm check
```

Expected: lint + typecheck both pass with no errors.

**Step 2: Manual smoke test**

Start the dev server (`pnpm dev`) and verify:
- Open a bill from the dashboard → "Edit Bill" mode loads with all fields populated correctly
- Switching "Once" ↔ "Repeating" tabs works
- Switching "Ends..." radio options correctly clears the opposing field
- Saving an edit succeeds with a toast
- Open a playground bill → edit mode works identically
- Deleting a bill (both real and playground) still works
