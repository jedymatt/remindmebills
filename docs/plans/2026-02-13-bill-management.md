# Bill Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add view, edit, and delete functionality for bills through a modal interface

**Architecture:** Modal-based UI that opens when clicking bills. Modal has view mode (read-only) and edit mode (reuses CreateBillForm). Template-only editing for recurring bills (affects entire series).

**Tech Stack:** Next.js 16, tRPC 11, React Hook Form, Zod, shadcn/ui Dialog & AlertDialog, Sonner toasts

---

## Task 1: Add tRPC bill procedures (getById, update, delete)

**Files:**
- Modify: `src/server/api/routers/bill.ts`

**Step 1: Add getById procedure**

Add after the `getAll` procedure:

```typescript
getById: protectedProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const bill = await ctx.db.collection<BillEvent>("bills").findOne({
      _id: new ObjectId(input.id),
      userId: new ObjectId(ctx.session.user.id),
    });

    if (!bill) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Bill not found",
      });
    }

    return bill;
  }),
```

**Step 2: Add update procedure**

Add after `getById`:

```typescript
update: protectedProcedure
  .input(
    z.object({
      id: z.string(),
      data: InputBillSchema,
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const result = await ctx.db.collection("bills").updateOne(
      {
        _id: new ObjectId(input.id),
        userId: new ObjectId(ctx.session.user.id),
      },
      { $set: input.data },
    );

    if (result.matchedCount === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Bill not found",
      });
    }
  }),
```

**Step 3: Add delete procedure**

Add after `update`:

```typescript
delete: protectedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const result = await ctx.db.collection("bills").deleteOne({
      _id: new ObjectId(input.id),
      userId: new ObjectId(ctx.session.user.id),
    });

    if (result.deletedCount === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Bill not found",
      });
    }
  }),
```

**Step 4: Add TRPCError import**

Add to imports at top of file:

```typescript
import { TRPCError } from "@trpc/server";
```

**Step 5: Verify types and commit**

Run: `pnpm typecheck`
Expected: No type errors

```bash
git add src/server/api/routers/bill.ts
git commit -m "feat(api): add getById, update, and delete procedures to bill router

- getById: fetch single bill by ID with user ownership check
- update: update bill with user ownership check
- delete: delete bill with user ownership check
- All procedures throw NOT_FOUND error if bill doesn't exist

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add AlertDialog UI component

**Files:**
- Create: `src/components/ui/alert-dialog.tsx`

**Step 1: Install AlertDialog from shadcn/ui**

Run: `npx shadcn@latest add alert-dialog`
Expected: Component files created

**Step 2: Verify installation and commit**

Run: `ls src/components/ui/alert-dialog.tsx`
Expected: File exists

```bash
git add src/components/ui/alert-dialog.tsx
git commit -m "feat(ui): add AlertDialog component from shadcn/ui

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create BillViewMode component

**Files:**
- Create: `src/components/billViewMode.tsx`

**Step 1: Create BillViewMode component file**

Create file with complete implementation:

```typescript
"use client";

import { format } from "date-fns";
import { Calendar, Repeat } from "lucide-react";
import type { BillEvent } from "~/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

interface BillViewModeProps {
  bill: BillEvent;
  onEdit: () => void;
  onDelete: () => void;
}

export function BillViewMode({ bill, onEdit, onDelete }: BillViewModeProps) {
  return (
    <div className="space-y-6">
      {/* Bill Type Badge */}
      {bill.type === "recurring" && (
        <div>
          <Badge variant="secondary" className="gap-1">
            <Repeat className="size-3" />
            Recurring Bill
          </Badge>
        </div>
      )}

      {/* Bill Details */}
      <div className="space-y-4">
        <div>
          <label className="text-muted-foreground text-sm">Title</label>
          <p className="text-lg font-medium">{bill.title}</p>
        </div>

        <div>
          <label className="text-muted-foreground text-sm">Amount</label>
          <p className="text-lg font-medium">
            {bill.amount != null ? (
              <>
                ₱
                {bill.amount.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </>
            ) : (
              <span className="text-muted-foreground text-sm">Not set</span>
            )}
          </p>
        </div>

        {bill.type === "single" && (
          <div>
            <label className="text-muted-foreground text-sm">Due Date</label>
            <div className="flex items-center gap-2">
              <Calendar className="text-muted-foreground size-4" />
              <p className="font-medium">{format(bill.date, "PPP")}</p>
            </div>
          </div>
        )}

        {bill.type === "recurring" && (
          <div className="space-y-3">
            <div>
              <label className="text-muted-foreground text-sm">
                Recurrence Pattern
              </label>
              <p className="font-medium">
                Every {bill.recurrence.interval}{" "}
                {bill.recurrence.type === "weekly"
                  ? bill.recurrence.interval === 1
                    ? "week"
                    : "weeks"
                  : bill.recurrence.interval === 1
                    ? "month"
                    : "months"}
              </p>
            </div>

            <div>
              <label className="text-muted-foreground text-sm">
                Start Date
              </label>
              <div className="flex items-center gap-2">
                <Calendar className="text-muted-foreground size-4" />
                <p className="font-medium">
                  {format(bill.recurrence.dtstart, "PPP")}
                </p>
              </div>
            </div>

            {bill.recurrence.until && (
              <div>
                <label className="text-muted-foreground text-sm">
                  End Date
                </label>
                <div className="flex items-center gap-2">
                  <Calendar className="text-muted-foreground size-4" />
                  <p className="font-medium">
                    {format(bill.recurrence.until, "PPP")}
                  </p>
                </div>
              </div>
            )}

            {bill.recurrence.count && (
              <div>
                <label className="text-muted-foreground text-sm">
                  Occurrences
                </label>
                <p className="font-medium">
                  {bill.recurrence.count}{" "}
                  {bill.recurrence.count === 1 ? "time" : "times"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="destructive" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Add Badge component if missing**

Run: `npx shadcn@latest add badge`
Expected: Component added (if not already present)

**Step 3: Verify types and commit**

Run: `pnpm typecheck`
Expected: No type errors

```bash
git add src/components/billViewMode.tsx src/components/ui/badge.tsx
git commit -m "feat(ui): add BillViewMode component for read-only bill display

- Shows bill title, amount, and date/recurrence details
- Different layout for single vs recurring bills
- Edit and Delete action buttons
- Uses Badge for recurring bill indicator

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Create BillModal component

**Files:**
- Create: `src/components/billModal.tsx`

**Step 1: Create BillModal component file**

Create file with complete implementation:

```typescript
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "~/trpc/react";
import type { BillEvent } from "~/types";
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
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
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
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface BillModalProps {
  billId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

  const [formType, formRecurrenceType] = useWatch({
    name: ["type", "recurrence.type"],
    control: form.control,
  });

  async function handleSubmit(data: BillFormValues) {
    await updateBill.mutateAsync({
      id: bill._id,
      data,
    });
  }

  return (
    <div>
      <Form {...form}>
        <form
          id="edit-bill-form"
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
                rules={{
                  min: 1,
                }}
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
                  <RadioGroupItem value="never" id="never" />
                  <Label htmlFor="never">Never</Label>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="count" id="count" />
                  <FormField
                    control={form.control}
                    name="recurrence.count"
                    rules={{
                      min: 1,
                    }}
                    defaultValue={1}
                    disabled={recurringEndsWith !== "count"}
                    render={({ field }) => (
                      <FormItem className="pt-0.5">
                        <FormLabel onClick={() => setRecurringEndsWith("count")}>
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
                  <RadioGroupItem value="until" id="until" />
                  <FormField
                    control={form.control}
                    name="recurrence.until"
                    disabled={recurringEndsWith !== "until"}
                    render={({ field }) => (
                      <FormItem className="pt-0.5">
                        <FormLabel onClick={() => setRecurringEndsWith("until")}>
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

export function BillModal({ billId, open, onOpenChange }: BillModalProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: bill, isLoading } = api.bill.getById.useQuery(
    { id: billId! },
    { enabled: !!billId },
  );

  const utils = api.useUtils();
  const deleteBill = api.bill.delete.useMutation({
    onSuccess: async () => {
      await utils.bill.getAll.invalidate();
      toast.success("Bill deleted successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      if (error.data?.code === "NOT_FOUND") {
        toast.error("This bill no longer exists");
        onOpenChange(false);
      } else {
        toast.error(error.message || "Failed to delete bill");
      }
    },
  });

  // Reset mode when modal opens/closes
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

  const handleConfirmDelete = async () => {
    if (bill) {
      await deleteBill.mutateAsync({ id: bill._id });
    }
  };

  const handleCancelEdit = () => {
    setMode("view");
  };

  const handleSaveSuccess = () => {
    setMode("view");
  };

  if (!billId) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {mode === "view" ? "Bill Details" : "Edit Bill"}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-48" />
            </div>
          ) : bill ? (
            mode === "view" ? (
              <BillViewMode
                bill={bill}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ) : (
              <BillEditMode
                bill={bill}
                onCancel={handleCancelEdit}
                onSaveSuccess={handleSaveSuccess}
              />
            )
          ) : (
            <p className="text-muted-foreground text-center">Bill not found</p>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bill</AlertDialogTitle>
            <AlertDialogDescription>
              {bill?.type === "recurring"
                ? `Are you sure you want to delete "${bill.title}"? This will delete all occurrences of this recurring bill. This action cannot be undone.`
                : `Are you sure you want to delete "${bill?.title}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteBill.isPending}
            >
              {deleteBill.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

**Step 2: Verify types and commit**

Run: `pnpm typecheck`
Expected: No type errors

```bash
git add src/components/billModal.tsx
git commit -m "feat(ui): add BillModal component with view/edit modes and delete

- View mode: displays bill details with BillViewMode component
- Edit mode: reuses bill form with pre-populated data
- Delete confirmation: AlertDialog with different messages for single vs recurring
- Handles loading states, errors, and cache invalidation
- Mode resets when modal closes

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Make bills clickable in BillListCard

**Files:**
- Modify: `src/app/_components/billList.tsx`

**Step 1: Add state for selected bill and modal**

Import BillModal at top of file:

```typescript
import { BillModal } from "~/components/billModal";
```

Add state inside `BillList` component (after existing hooks):

```typescript
const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
const [modalOpen, setModalOpen] = useState(false);
```

Add import for useState:

```typescript
import { useMemo, useState } from "react";  // modify existing import
```

**Step 2: Add click handler to open modal**

Add function inside `BillList` component:

```typescript
const handleBillClick = (billId: string) => {
  setSelectedBillId(billId);
  setModalOpen(true);
};
```

**Step 3: Make bill list items clickable**

In the `BillListCard` component, modify the bill list item (`<li>` tag around line 98-140) to add click handler.

Find this line:
```typescript
<li
  key={bill._id}
  className={cn(
```

Replace the entire `<li>` element to add cursor and onClick. Change from:

```typescript
<li
  key={bill._id}
  className={cn(
    "flex items-center gap-3 py-3",
    isEqual(bill.date, payDate) &&
      "text-yellow-700 dark:text-yellow-500",
    isExcluded && "opacity-40",
  )}
>
```

To:

```typescript
<li
  key={bill._id}
  className={cn(
    "flex items-center gap-3 py-3 cursor-pointer hover:bg-muted/50 -mx-5 px-5 rounded-md transition-colors",
    isEqual(bill.date, payDate) &&
      "text-yellow-700 dark:text-yellow-500",
    isExcluded && "opacity-40",
  )}
  onClick={() => onBillClick?.(bill._id)}
>
```

**Step 4: Pass onBillClick prop to BillListCard**

Modify `BillListCard` function signature to accept `onBillClick`:

```typescript
function BillListCard({
  bills,
  payDate,
  after,
  isCurrent,
  ingoing,
  onBillClick,
}: {
  bills: (BillEvent & { date: Date })[];
  payDate: Date;
  after: Date | null;
  isCurrent: boolean;
  ingoing: number;
  onBillClick?: (billId: string) => void;
}) {
```

**Step 5: Pass handler to BillListCard instances**

In `BillList` component's return statement, modify the map to pass the handler:

```typescript
{billsInPayPeriod.map(({ payDate, bills, after }, index) => (
  <BillListCard
    key={index}
    payDate={payDate}
    bills={bills}
    after={after}
    isCurrent={index === 0}
    ingoing={ingoing}
    onBillClick={handleBillClick}
  />
))}
```

**Step 6: Add BillModal to BillList component**

Add at the end of the `BillList` return statement (after the closing `</div>` of the grid):

```typescript
<BillModal
  billId={selectedBillId}
  open={modalOpen}
  onOpenChange={setModalOpen}
/>
```

The full return should look like:

```typescript
return (
  <>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {billsInPayPeriod.map(({ payDate, bills, after }, index) => (
        <BillListCard
          key={index}
          payDate={payDate}
          bills={bills}
          after={after}
          isCurrent={index === 0}
          ingoing={ingoing}
          onBillClick={handleBillClick}
        />
      ))}
    </div>
    <BillModal
      billId={selectedBillId}
      open={modalOpen}
      onOpenChange={setModalOpen}
    />
  </>
);
```

**Step 7: Prevent eye icon click from opening modal**

Modify the eye icon button to stop propagation. Find the button (around line 107-116):

```typescript
<button
  type="button"
  className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
  onClick={() => toggleExclude(bill._id)}
>
```

Change to:

```typescript
<button
  type="button"
  className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
  onClick={(e) => {
    e.stopPropagation();
    toggleExclude(bill._id);
  }}
>
```

**Step 8: Verify types and commit**

Run: `pnpm typecheck`
Expected: No type errors

```bash
git add src/app/_components/billList.tsx
git commit -m "feat(ui): make bills clickable to open modal

- Bills in BillListCard are now clickable with hover effect
- Click opens BillModal with bill details
- Eye icon click stops propagation (doesn't open modal)
- Modal state managed in BillList component

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Manual Testing & Verification

**Files:**
- N/A (manual testing)

**Step 1: Start dev server**

Run: `pnpm dev`
Expected: Server starts on http://localhost:3000

**Step 2: Test bill viewing**

1. Navigate to `/dashboard`
2. Click on any bill in the list
3. Verify modal opens in view mode
4. Verify correct bill details are displayed
5. Verify "Recurring" badge shows for recurring bills
6. Close modal with X, ESC, or click outside

**Step 3: Test bill editing**

1. Open a bill modal
2. Click "Edit" button
3. Verify modal switches to edit mode
4. Modify the title and/or amount
5. Click "Save Changes"
6. Verify success toast appears
7. Verify modal switches back to view mode with updated data
8. Verify dashboard reflects the changes

**Step 4: Test edit cancellation**

1. Open a bill modal in edit mode
2. Make changes to the form
3. Click "Cancel"
4. Verify modal switches back to view mode without saving
5. Verify original data is preserved

**Step 5: Test bill deletion**

1. Open a bill modal
2. Click "Delete" button
3. Verify confirmation dialog appears
4. Click "Cancel" - verify dialog closes
5. Click "Delete" again
6. Click "Delete" in confirmation dialog
7. Verify success toast appears
8. Verify modal closes
9. Verify bill is removed from dashboard

**Step 6: Test recurring bill deletion message**

1. Open a recurring bill modal
2. Click "Delete" button
3. Verify confirmation message mentions "all occurrences"

**Step 7: Test error handling**

1. Disconnect from network (optional)
2. Try to edit a bill
3. Verify error toast appears
4. Reconnect and verify retry works

**Step 8: Test mobile responsiveness**

1. Resize browser to mobile width (< 640px)
2. Verify modal takes full screen
3. Verify form fields are usable on mobile
4. Verify scrolling works if content overflows

**Step 9: Run type checking**

Run: `pnpm check`
Expected: No errors (lint + typecheck pass)

**Step 10: Final commit (if needed)**

If any fixes were needed during testing:

```bash
git add .
git commit -m "fix: address issues found during manual testing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Summary

**Implementation complete!** The following features are now available:

✅ Click any bill to open modal with details
✅ View mode shows bill information (single vs recurring layouts)
✅ Edit mode reuses CreateBillForm with pre-populated data
✅ Delete with confirmation (different messages for single vs recurring)
✅ Template-only editing for recurring bills (affects entire series)
✅ Loading states, error handling, and cache invalidation
✅ Mobile responsive design

**New tRPC Procedures:**
- `bill.getById` - Fetch single bill by ID
- `bill.update` - Update bill data
- `bill.delete` - Delete bill

**New Components:**
- `BillViewMode` - Read-only bill display
- `BillModal` - Modal with view/edit modes and delete confirmation

**Modified Components:**
- `BillList` / `BillListCard` - Made bills clickable

**Future Enhancement Path:**
Ready to upgrade to Option 2 (per-instance editing) by adding exceptions collection and exdates field without breaking changes.
