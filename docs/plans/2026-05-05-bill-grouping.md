# Bill Grouping Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users put bills into groups (destination bank, savings account, etc.), manage groups on a dedicated `/groups` page, and render the dashboard's pay-period cards sectioned by group with per-section subtotals.

**Architecture:** New MongoDB `groups` collection (`{ _id, userId, name, order }`) + optional `groupId` on each bill. Group color is **derived** from `order` against a fixed 8-color palette (not stored). New `group` tRPC router for CRUD/reorder. `BillFormValuesSchema` extended with `groupId`. Dashboard's `BillListCard` sections bills by group (custom order, ungrouped last) with per-section subtotals.

**Tech Stack:** Next.js 16 (App Router), TypeScript (strict), MongoDB (native driver), tRPC 11, React Hook Form + Zod, Shadcn/ui, `@dnd-kit/core` + `@dnd-kit/sortable` (new deps).

**Design doc:** `docs/plans/2026-05-05-bill-grouping-design.md`

**Project context:**
- No test framework — verify each task with `pnpm check` (lint + typecheck) and a manual smoke test at the end.
- Path alias `~/` → `src/`.
- Bills router pattern (`src/server/api/routers/bill.ts`) is the reference for the new group router.
- Existing forms use React Hook Form + Zod via shared `BillFormFields`.

---

### Task 1: Foundation — color helper, Zod schemas, types

**Files:**
- Create: `src/lib/group-colors.ts`
- Create: `src/schemas/group.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Create the color palette helper**

Create `src/lib/group-colors.ts`:

```ts
// Fixed palette, ordered. Index 0..7 maps to a Tailwind-derived hex.
// Group color is derived from `order % palette.length` (no DB writes).
export const GROUP_COLOR_PALETTE = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
  "#f97316", // orange-500
] as const;

export const UNGROUPED_COLOR = "#94a3b8"; // slate-400 — neutral muted

export function colorForOrder(order: number): string {
  const len = GROUP_COLOR_PALETTE.length;
  const idx = ((order % len) + len) % len; // safe for negative
  return GROUP_COLOR_PALETTE[idx]!;
}
```

- [ ] **Step 2: Create the Zod input schemas**

Create `src/schemas/group.ts`:

```ts
import { z } from "zod";

export const CreateGroupInputSchema = z.object({
  name: z.string().trim().min(1, { message: "Name is required" }).max(50),
});

export const UpdateGroupInputSchema = z.object({
  id: z.string(),
  data: z.object({
    name: z.string().trim().min(1).max(50).optional(),
  }),
});

export const ReorderGroupsInputSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
});

export const DeleteGroupInputSchema = z.object({
  id: z.string(),
});

export type CreateGroupInput = z.infer<typeof CreateGroupInputSchema>;
export type UpdateGroupInput = z.infer<typeof UpdateGroupInputSchema>;
export type ReorderGroupsInput = z.infer<typeof ReorderGroupsInputSchema>;
```

- [ ] **Step 3: Add `Group` type and `groupId` on `BillEvent`**

Modify `src/types/index.ts`. Replace its full contents with:

```ts
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
```

`PlaygroundBill` is intentionally **not** extended with `groupId` (playground is out of scope).

- [ ] **Step 4: Verify typecheck**

Run: `pnpm typecheck`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/group-colors.ts src/schemas/group.ts src/types/index.ts
git commit -m "feat: add group color helper, schemas, and types"
```

---

### Task 2: Group tRPC router

**Files:**
- Create: `src/server/api/routers/group.ts`
- Modify: `src/server/api/root.ts`

- [ ] **Step 1: Create the group router**

Create `src/server/api/routers/group.ts`:

```ts
import { TRPCError } from "@trpc/server";
import { ObjectId, type WithoutId } from "mongodb";
import { z } from "zod";
import {
  CreateGroupInputSchema,
  DeleteGroupInputSchema,
  ReorderGroupsInputSchema,
  UpdateGroupInputSchema,
} from "~/schemas/group";
import { createTRPCRouter, protectedProcedure } from "../trpc";

type GroupDoc = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  order: number;
};

export const groupRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const cursor = ctx.db
      .collection<GroupDoc>("groups")
      .find({ userId: new ObjectId(ctx.session.user.id) })
      .sort({ order: 1 });
    const groups = await cursor.toArray();
    await cursor.close();

    return groups.map((g) => ({
      _id: g._id.toHexString(),
      userId: g.userId.toHexString(),
      name: g.name,
      order: g.order,
    }));
  }),

  create: protectedProcedure
    .input(CreateGroupInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = new ObjectId(ctx.session.user.id);

      const last = await ctx.db
        .collection<GroupDoc>("groups")
        .find({ userId })
        .sort({ order: -1 })
        .limit(1)
        .toArray();
      const nextOrder = last[0] ? last[0].order + 1 : 0;

      const result = await ctx.db
        .collection<WithoutId<GroupDoc>>("groups")
        .insertOne({ userId, name: input.name, order: nextOrder });

      return {
        _id: result.insertedId.toHexString(),
        userId: userId.toHexString(),
        name: input.name,
        order: nextOrder,
      };
    }),

  update: protectedProcedure
    .input(UpdateGroupInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ObjectId.isValid(input.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }

      const updateFields: Partial<Pick<GroupDoc, "name">> = {};
      if (input.data.name !== undefined) updateFields.name = input.data.name;

      if (Object.keys(updateFields).length === 0) return;

      const result = await ctx.db
        .collection<GroupDoc>("groups")
        .updateOne(
          {
            _id: new ObjectId(input.id),
            userId: new ObjectId(ctx.session.user.id),
          },
          { $set: updateFields },
        );

      if (result.matchedCount === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }
    }),

  reorder: protectedProcedure
    .input(ReorderGroupsInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = new ObjectId(ctx.session.user.id);

      for (const id of input.orderedIds) {
        if (!ObjectId.isValid(id)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid group id",
          });
        }
      }

      const objectIds = input.orderedIds.map((id) => new ObjectId(id));

      // Validate the input set exactly matches the user's groups.
      const existing = await ctx.db
        .collection<GroupDoc>("groups")
        .find({ userId }, { projection: { _id: 1 } })
        .toArray();

      if (existing.length !== objectIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "orderedIds does not match the user's groups",
        });
      }
      const existingSet = new Set(existing.map((g) => g._id.toHexString()));
      for (const id of input.orderedIds) {
        if (!existingSet.has(id)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "orderedIds contains an unknown group id",
          });
        }
      }

      const ops = objectIds.map((oid, idx) => ({
        updateOne: {
          filter: { _id: oid, userId },
          update: { $set: { order: idx } },
        },
      }));

      if (ops.length > 0) {
        await ctx.db.collection<GroupDoc>("groups").bulkWrite(ops);
      }
    }),

  delete: protectedProcedure
    .input(DeleteGroupInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ObjectId.isValid(input.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }

      const userId = new ObjectId(ctx.session.user.id);
      const groupId = new ObjectId(input.id);

      // Step 1: unset groupId on all bills in this group.
      // Idempotent — safe to retry.
      await ctx.db
        .collection("bills")
        .updateMany({ userId, groupId }, { $unset: { groupId: "" } });

      // Step 2: delete the group itself.
      const result = await ctx.db
        .collection<GroupDoc>("groups")
        .deleteOne({ _id: groupId, userId });

      if (result.deletedCount === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }
    }),
});

// Silences "z is declared but never used" if z ends up unused after refactors.
// (Currently unused — left intentionally absent.)
void z;
```

Note: the trailing `void z;` is a hedge against z being imported-but-unused if later refactors trim it. If `pnpm lint` complains about the unused import, remove the `import { z } from "zod"` line and the `void z;` line together. Otherwise leave both in.

- [ ] **Step 2: Register the router in the app router**

Modify `src/server/api/root.ts`:

Replace the file with:

```ts
import { billRouter } from "~/server/api/routers/bill";
import { groupRouter } from "~/server/api/routers/group";
import { postRouter } from "~/server/api/routers/post";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { incomeRouter } from "./routers/income";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  bill: billRouter,
  group: groupRouter,
  income: incomeRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
```

- [ ] **Step 3: Verify typecheck and lint**

Run: `pnpm check`
Expected: No errors. If you see "z is defined but never used", delete the `import { z } from "zod";` line and the `void z;` line in `group.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/server/api/routers/group.ts src/server/api/root.ts
git commit -m "feat: add group tRPC router with CRUD and reorder"
```

---

### Task 3: Update bill router to accept and validate `groupId`

**Files:**
- Modify: `src/server/api/routers/bill.ts`

- [ ] **Step 1: Replace the bill router with the groupId-aware version**

Replace the entire contents of `src/server/api/routers/bill.ts` with:

```ts
import { TRPCError } from "@trpc/server";
import { ObjectId, type WithoutId } from "mongodb";
import type { Simplify } from "type-fest";
import { z } from "zod";
import { RecurringBillSchema, SingleBillSchema } from "~/schemas/bill";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const InputBillSchema = z
  .object({
    title: z.string().trim().min(1, { message: "Title is required" }),
    amount: z.number().min(1).optional(),
    groupId: z.string().nullish(),
  })
  .and(z.discriminatedUnion("type", [SingleBillSchema, RecurringBillSchema]));

type InputBill = z.infer<typeof InputBillSchema>;

type BillEvent = Simplify<
  {
    _id: ObjectId;
    userId: ObjectId;
    groupId?: ObjectId | null;
  } & Omit<InputBill, "groupId">
>;

type GroupDoc = {
  _id: ObjectId;
  userId: ObjectId;
};

// Resolves a groupId string from input into an ObjectId after checking the
// group belongs to the requesting user. Returns null if input is null/empty.
async function resolveGroupId(
  ctx: { db: import("mongodb").Db; session: { user: { id: string } } },
  rawGroupId: string | null | undefined,
): Promise<ObjectId | null> {
  if (rawGroupId == null || rawGroupId === "") return null;

  if (!ObjectId.isValid(rawGroupId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid groupId" });
  }

  const groupOid = new ObjectId(rawGroupId);
  const userOid = new ObjectId(ctx.session.user.id);
  const found = await ctx.db
    .collection<GroupDoc>("groups")
    .findOne({ _id: groupOid, userId: userOid }, { projection: { _id: 1 } });

  if (!found) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Group not found" });
  }

  return groupOid;
}

function serializeBill(bill: BillEvent) {
  return {
    ...bill,
    _id: bill._id.toHexString(),
    userId: bill.userId.toHexString(),
    groupId: bill.groupId ? bill.groupId.toHexString() : null,
  };
}

export const billRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const billsCursor = ctx.db.collection<BillEvent>("bills").find({
      userId: new ObjectId(ctx.session.user.id),
    });
    const bills = await billsCursor.toArray();
    await billsCursor.close();

    return bills.map(serializeBill);
  }),
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ObjectId.isValid(input.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }

      const bill = await ctx.db.collection<BillEvent>("bills").findOne({
        _id: new ObjectId(input.id),
        userId: new ObjectId(ctx.session.user.id),
      });

      if (!bill) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }

      return serializeBill(bill);
    }),
  update: protectedProcedure
    .input(z.object({ id: z.string(), data: InputBillSchema }))
    .mutation(async ({ ctx, input }) => {
      if (!ObjectId.isValid(input.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }

      const groupOid = await resolveGroupId(ctx, input.data.groupId);
      const { groupId: _ignored, ...rest } = input.data;
      const update: Record<string, unknown> = { ...rest };
      if (groupOid !== null) update.groupId = groupOid;

      const setOps: Record<string, unknown> = { $set: update };
      if (groupOid === null) {
        // Use $unset for the null case so the field doesn't sit as null forever.
        setOps.$unset = { groupId: "" };
      }

      const result = await ctx.db.collection<BillEvent>("bills").updateOne(
        {
          _id: new ObjectId(input.id),
          userId: new ObjectId(ctx.session.user.id),
        },
        setOps,
      );

      if (result.matchedCount === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ObjectId.isValid(input.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }

      const result = await ctx.db.collection("bills").deleteOne({
        _id: new ObjectId(input.id),
        userId: new ObjectId(ctx.session.user.id),
      });

      if (result.deletedCount === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }
    }),
  create: protectedProcedure
    .input(InputBillSchema)
    .mutation(async ({ ctx, input }) => {
      const groupOid = await resolveGroupId(ctx, input.groupId);
      const { groupId: _ignored, ...rest } = input;

      await ctx.db.collection<WithoutId<BillEvent>>("bills").insertOne({
        ...rest,
        userId: new ObjectId(ctx.session.user.id),
        ...(groupOid !== null ? { groupId: groupOid } : {}),
      });
    }),
});
```

Notes:
- `resolveGroupId` is called on every `create`/`update` and validates ownership.
- On update, `groupOid === null` triggers a `$unset` so we don't leave a `null` value in the document.
- `serializeBill` returns `groupId: null` when absent or null in DB (matching the design's serialization rule).

- [ ] **Step 2: Verify typecheck and lint**

Run: `pnpm check`
Expected: No errors. The unused `_ignored` destructured names should not trigger ESLint with the project's config; if they do, rename to `groupId: _gid`.

- [ ] **Step 3: Commit**

```bash
git add src/server/api/routers/bill.ts
git commit -m "feat: accept and validate groupId on bill create/update"
```

---

### Task 4: Add Group field to `BillFormFields`

**Files:**
- Modify: `src/components/billFormFields.tsx`

- [ ] **Step 1: Add `groupId` to the form schema**

In `src/components/billFormFields.tsx`, modify `BaseBillFormValues` to include `groupId`:

Replace the existing `BaseBillFormValues` definition with:

```ts
const BaseBillFormValues = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  amount: z.coerce.number<number>().min(0).optional(),
  groupId: z.string().nullish(),
});
```

`SingleBillFormValues` and `RecurringBillFormValues` already extend `BaseBillFormValues`, so they pick up `groupId` automatically.

- [ ] **Step 2: Add group select rendering inside `BillFormFields`**

Add a group `Select` field below the amount input and above the `<Separator />`. Replace the existing amount `<FormField>` block (the one for `name="amount"`) **and** the `<Separator />` that follows it with this combined block:

```tsx
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
<FormField
  control={form.control}
  name="groupId"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Group (optional)</FormLabel>
      <Select
        onValueChange={(value) =>
          field.onChange(value === "__none__" ? null : value)
        }
        value={field.value ?? "__none__"}
      >
        <FormControl>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="No group" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="__none__">No group</SelectItem>
          {groups.map((g) => (
            <SelectItem key={g._id} value={g._id}>
              <span className="flex items-center gap-2">
                <span
                  className="inline-block size-3 rounded-full"
                  style={{ backgroundColor: colorForOrder(g.order) }}
                />
                {g.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
<Separator />
```

The `__none__` sentinel is needed because Radix `<SelectItem>` cannot have an empty-string value.

- [ ] **Step 3: Add the `groups` query and required imports**

At the top of the file, add the imports below the existing ones:

```tsx
import { api } from "~/trpc/react";
import { colorForOrder } from "~/lib/group-colors";
```

Inside the `BillFormFields` component, **above** the `useWatch` call, add:

```tsx
const { data: groupsData } = api.group.getAll.useQuery();
const groups = groupsData ?? [];
```

- [ ] **Step 4: Verify typecheck and lint**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/billFormFields.tsx
git commit -m "feat: add Group field to BillFormFields"
```

---

### Task 5: Wire `groupId` defaults through CreateBillForm and BillEditMode

**Files:**
- Modify: `src/components/createBillForm.tsx`
- Modify: `src/components/billModal.tsx`

- [ ] **Step 1: Default `groupId` to `null` in `CreateBillForm`**

In `src/components/createBillForm.tsx`, change the `useForm` `defaultValues` block from:

```tsx
defaultValues: {
  title: "",
  type: "single",
},
```

To:

```tsx
defaultValues: {
  title: "",
  type: "single",
  groupId: null,
},
```

- [ ] **Step 2: Forward `bill.groupId` in `BillEditMode`**

In `src/components/billModal.tsx`, find `BillEditMode`'s `useForm` call and update its `defaultValues` to include `groupId`:

Replace this block:

```tsx
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
```

With:

```tsx
defaultValues: {
  title: bill.title,
  amount: bill.amount,
  groupId: bill.groupId ?? null,
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
```

The `BillFormFields` component already reads/writes `groupId` from the form (Task 4), so no further wiring is needed.

`PlaygroundBillModal` and `PlaygroundBillFormDialog` are intentionally **not** modified (playground is out of scope). However, since their `BillFormValues` is the same shared type, the `groupId` field will appear in the playground form too.

- [ ] **Step 3: Hide the Group field in playground forms**

To keep the playground clean, add a prop to `BillFormFields` to optionally hide the group select.

In `src/components/billFormFields.tsx`, change the `BillFormFieldsProps` interface to add an optional flag:

```tsx
interface BillFormFieldsProps {
  form: UseFormReturn<BillFormValues>;
  recurringEndsWith: "never" | "until" | "count";
  onRecurringEndsWithChange: (value: "never" | "until" | "count") => void;
  formId: string;
  onSubmit: (data: BillFormValues) => void | Promise<void>;
  titlePlaceholder?: string;
  showGroupField?: boolean;
}
```

And update the destructure to default it to `true`:

```tsx
export function BillFormFields({
  form,
  recurringEndsWith,
  onRecurringEndsWithChange,
  formId,
  onSubmit,
  titlePlaceholder = "Title",
  showGroupField = true,
}: BillFormFieldsProps) {
```

Wrap the new group `<FormField>` block (added in Task 4 Step 2) with:

```tsx
{showGroupField && (
  <FormField
    control={form.control}
    name="groupId"
    render={...}
  />
)}
```

In `src/components/playgroundBillFormDialog.tsx` and `src/components/playgroundBillModal.tsx`, find each `<BillFormFields ... />` usage and add `showGroupField={false}`. Example:

```tsx
<BillFormFields
  form={form}
  recurringEndsWith={recurringEndsWith}
  onRecurringEndsWithChange={handleRecurringEndsWithChange}
  formId="..."
  onSubmit={handleSubmit}
  showGroupField={false}
/>
```

- [ ] **Step 4: Verify typecheck and lint**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/createBillForm.tsx src/components/billModal.tsx src/components/billFormFields.tsx src/components/playgroundBillFormDialog.tsx src/components/playgroundBillModal.tsx
git commit -m "feat: wire groupId defaults; hide group field in playground"
```

---

### Task 6: Display group in `BillViewMode`

**Files:**
- Modify: `src/components/billViewMode.tsx`

- [ ] **Step 1: Fetch groups and render the group row**

Replace `src/components/billViewMode.tsx` with:

```tsx
"use client";

import { format } from "date-fns";
import { Calendar, Repeat } from "lucide-react";
import { colorForOrder } from "~/lib/group-colors";
import { api } from "~/trpc/react";
import type { BillEvent } from "~/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

interface BillViewModeProps {
  bill: BillEvent;
  onEdit: () => void;
  onDelete: () => void;
}

export function BillViewMode({ bill, onEdit, onDelete }: BillViewModeProps) {
  const { data: groups } = api.group.getAll.useQuery(undefined, {
    enabled: !!bill.groupId,
  });
  const group = bill.groupId
    ? groups?.find((g) => g._id === bill.groupId)
    : null;

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

        {group && (
          <div>
            <label className="text-muted-foreground text-sm">Group</label>
            <div className="flex items-center gap-2">
              <span
                className="inline-block size-3 rounded-full"
                style={{ backgroundColor: colorForOrder(group.order) }}
              />
              <p className="font-medium">{group.name}</p>
            </div>
          </div>
        )}

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

            {bill.recurrence.dtstart && (
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
            )}

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

- [ ] **Step 2: Verify typecheck and lint**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/billViewMode.tsx
git commit -m "feat: show group in BillViewMode when present"
```

---

### Task 7: Install DnD deps and create the group management page

**Files:**
- Modify: `package.json` (via pnpm)
- Create: `src/app/groups/page.tsx`
- Create: `src/components/groupManager.tsx`

- [ ] **Step 1: Install `@dnd-kit/core` and `@dnd-kit/sortable`**

Run:

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable
```

Expected: both packages added; pnpm-lock.yaml updated.

- [ ] **Step 2: Create the protected page shell**

Create `src/app/groups/page.tsx`:

```tsx
import { GroupManager } from "~/components/groupManager";

export const dynamic = "force-dynamic";

export default function GroupsPage() {
  return <GroupManager />;
}
```

- [ ] **Step 3: Create the `GroupManager` component**

Create `src/components/groupManager.tsx`:

```tsx
"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { zodResolver } from "@hookform/resolvers/zod";
import { GripVertical, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { colorForOrder } from "~/lib/group-colors";
import { api } from "~/trpc/react";
import type { Group } from "~/types";
import { AuthenticatedLayout } from "./authenticatedLayout";
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
  DialogFooter,
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
import { Skeleton } from "./ui/skeleton";

const GroupFormSchema = z.object({
  name: z.string().trim().min(1, { message: "Name is required" }).max(50),
});
type GroupFormValues = z.infer<typeof GroupFormSchema>;

function GroupFormDialog({
  open,
  onOpenChange,
  initialName,
  onSubmit,
  isPending,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onSubmit: (values: GroupFormValues) => void | Promise<void>;
  isPending: boolean;
  title: string;
}) {
  const form = useForm<GroupFormValues>({
    resolver: zodResolver(GroupFormSchema),
    defaultValues: { name: initialName },
  });

  // Re-sync default when dialog re-opens with a different group.
  useEffect(() => {
    if (open) form.reset({ name: initialName });
  }, [open, initialName, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            id="group-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="e.g., BPI Savings"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form="group-form" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortableRow({
  group,
  billCount,
  onEdit,
  onDelete,
}: {
  group: Group;
  billCount: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group._id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="bg-background flex items-center gap-3 rounded-md border p-3"
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground cursor-grab touch-none"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <span
        className="inline-block size-4 rounded-full"
        style={{ backgroundColor: colorForOrder(group.order) }}
      />
      <span className="flex-1 truncate font-medium">{group.name}</span>
      <span className="text-muted-foreground text-xs">
        {billCount} {billCount === 1 ? "bill" : "bills"}
      </span>
      <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit">
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        aria-label="Delete"
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}

export function GroupManager() {
  const utils = api.useUtils();
  const { data: groups, isLoading } = api.group.getAll.useQuery();
  const { data: bills } = api.bill.getAll.useQuery();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState<Group | null>(null);

  // Local copy used to drive optimistic reorder. Reset whenever the
  // server data changes.
  const [orderedGroups, setOrderedGroups] = useState<Group[]>([]);
  useEffect(() => {
    if (groups) setOrderedGroups(groups);
  }, [groups]);

  const billCountByGroup = (groupId: string) =>
    (bills ?? []).filter((b) => b.groupId === groupId).length;

  const createMut = api.group.create.useMutation({
    onSuccess: async () => {
      await utils.group.getAll.invalidate();
      toast.success("Group created");
      setCreateOpen(false);
    },
    onError: (e) => toast.error(e.message || "Failed to create group"),
  });

  const updateMut = api.group.update.useMutation({
    onSuccess: async () => {
      await utils.group.getAll.invalidate();
      toast.success("Group updated");
      setEditing(null);
    },
    onError: (e) => toast.error(e.message || "Failed to update group"),
  });

  const deleteMut = api.group.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.group.getAll.invalidate(),
        utils.bill.getAll.invalidate(),
      ]);
      toast.success("Group deleted");
      setDeleting(null);
    },
    onError: (e) => toast.error(e.message || "Failed to delete group"),
  });

  const reorderMut = api.group.reorder.useMutation({
    onSuccess: async () => {
      await utils.group.getAll.invalidate();
    },
    onError: (e) => {
      toast.error(e.message || "Failed to reorder");
      // Roll back to server state.
      if (groups) setOrderedGroups(groups);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedGroups.findIndex((g) => g._id === active.id);
    const newIndex = orderedGroups.findIndex((g) => g._id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(orderedGroups, oldIndex, newIndex);
    setOrderedGroups(next);
    reorderMut.mutate({ orderedIds: next.map((g) => g._id) });
  };

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Groups</h1>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 size-4" />
            New group
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : orderedGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <p className="text-muted-foreground">No groups yet.</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 size-4" />
              Create your first group
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedGroups.map((g) => g._id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-2">
                {orderedGroups.map((g) => (
                  <SortableRow
                    key={g._id}
                    group={g}
                    billCount={billCountByGroup(g._id)}
                    onEdit={() => setEditing(g)}
                    onDelete={() => setDeleting(g)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <GroupFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          initialName=""
          isPending={createMut.isPending}
          title="New group"
          onSubmit={async (values) => {
            await createMut.mutateAsync(values);
          }}
        />

        <GroupFormDialog
          open={editing !== null}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          initialName={editing?.name ?? ""}
          isPending={updateMut.isPending}
          title="Edit group"
          onSubmit={async (values) => {
            if (!editing) return;
            await updateMut.mutateAsync({
              id: editing._id,
              data: { name: values.name },
            });
          }}
        />

        <AlertDialog
          open={deleting !== null}
          onOpenChange={(open) => {
            if (!open) setDeleting(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete group</AlertDialogTitle>
              <AlertDialogDescription>
                {deleting && (
                  <>
                    Delete &lsquo;{deleting.name}&rsquo;? This will remove the
                    group from {billCountByGroup(deleting._id)}{" "}
                    {billCountByGroup(deleting._id) === 1 ? "bill" : "bills"}.
                    The bills will not be deleted.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMut.isPending}
                onClick={async () => {
                  if (deleting) {
                    await deleteMut.mutateAsync({ id: deleting._id });
                  }
                }}
              >
                {deleteMut.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AuthenticatedLayout>
  );
}
```

- [ ] **Step 4: Verify typecheck and lint**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/app/groups/page.tsx src/components/groupManager.tsx
git commit -m "feat: add /groups management page with DnD reorder"
```

---

### Task 8: Add `/groups` to middleware matcher and nav link

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/components/authenticatedLayout.tsx`

- [ ] **Step 1: Protect `/groups` in the proxy**

In `src/proxy.ts`, change the `matcher` from:

```ts
matcher: ["/dashboard", "/playground"],
```

To:

```ts
matcher: ["/dashboard", "/playground", "/groups"],
```

- [ ] **Step 2: Add the Groups nav link**

In `src/components/authenticatedLayout.tsx`, add a new icon import and a new `<Link>`.

Change the lucide import line:

```tsx
import { FlaskConical, Receipt } from "lucide-react";
```

To:

```tsx
import { FlaskConical, FolderTree, Receipt } from "lucide-react";
```

Then add a new `<Link>` inside the `<nav>` block, between the Dashboard link and the Playground link:

```tsx
<Link
  href="/groups"
  className={`flex items-center gap-1 text-sm font-medium transition-colors hover:text-foreground ${
    pathname === "/groups"
      ? "text-foreground"
      : "text-muted-foreground"
  }`}
>
  <FolderTree className="size-3.5" />
  Groups
</Link>
```

The final `<nav>` block should have, in order: Dashboard, Groups, Playground.

- [ ] **Step 3: Verify typecheck and lint**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/proxy.ts src/components/authenticatedLayout.tsx
git commit -m "feat: protect /groups route and add nav link"
```

---

### Task 9: Section bills by group in the dashboard cards

**Files:**
- Modify: `src/app/_components/billList.tsx`

- [ ] **Step 1: Replace the entire file with the sectioned version**

Replace `src/app/_components/billList.tsx` with:

```tsx
"use client";

import { formatDate, isEqual, subDays } from "date-fns";
import { sumBy } from "lodash";
import { ChevronDown, ChevronUp, EyeClosedIcon, EyeIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { BillModal } from "~/components/billModal";
import { getBillsByPayPeriod } from "~/lib/bill-utils";
import { UNGROUPED_COLOR, colorForOrder } from "~/lib/group-colors";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import type { BillEvent, Group } from "~/types";

function formatPHP(value: number, signDisplay?: "always") {
  return value.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    signDisplay,
  });
}

type BillRow = BillEvent & { date: Date };

type Section = {
  group: Group | null;
  bills: BillRow[];
};

function buildSections(bills: BillRow[], groups: Group[]): Section[] {
  const groupSections: Section[] = groups.map((g) => ({
    group: g,
    bills: bills.filter((b) => b.groupId === g._id),
  }));
  const ungrouped: Section = {
    group: null,
    bills: bills.filter((b) => !b.groupId),
  };
  return [...groupSections, ungrouped].filter((s) => s.bills.length > 0);
}

function BillRowItem({
  bill,
  payDate,
  isExcluded,
  onClick,
  onToggleExclude,
}: {
  bill: BillRow;
  payDate: Date;
  isExcluded: boolean;
  onClick: () => void;
  onToggleExclude: () => void;
}) {
  return (
    <li
      className={cn(
        "flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50 -mx-5",
        isEqual(bill.date, payDate) && "text-yellow-700 dark:text-yellow-500",
        isExcluded && "opacity-40",
      )}
      onClick={onClick}
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onToggleExclude();
        }}
      >
        {isExcluded ? (
          <EyeClosedIcon className="size-4" />
        ) : (
          <EyeIcon className="size-4" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{bill.title}</div>
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
}

function BillListCard({
  bills,
  groups,
  payDate,
  after,
  isCurrent,
  ingoing,
  onBillClick,
}: {
  bills: BillRow[];
  groups: Group[];
  payDate: Date;
  after: Date | null;
  isCurrent: boolean;
  ingoing: number;
  onBillClick: (billId: string) => void;
}) {
  const [excludedBills, setExcludedBills] = useState<string[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const sections = useMemo(
    () => buildSections(bills, groups),
    [bills, groups],
  );

  const outgoing = useMemo(
    () =>
      sumBy(
        bills.filter((bill) => !excludedBills.includes(bill._id)),
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

  const subtotalFor = (sectionBills: BillRow[]) =>
    sumBy(
      sectionBills.filter((b) => !excludedBills.includes(b._id)),
      (b) => b.amount ?? 0,
    );

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

      {/* Sections */}
      <div className="flex-1 px-5 py-2">
        {bills.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No bills this period
          </p>
        ) : (
          <div className="space-y-3">
            {sections.map((section) => {
              const subtotal = subtotalFor(section.bills);
              const swatchColor = section.group
                ? colorForOrder(section.group.order)
                : UNGROUPED_COLOR;
              const label = section.group ? section.group.name : "Ungrouped";
              return (
                <div key={section.group?._id ?? "__ungrouped__"}>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ backgroundColor: swatchColor }}
                      />
                      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        {label}
                      </span>
                    </div>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {formatPHP(subtotal)}
                    </span>
                  </div>
                  <ul className="divide-y">
                    {section.bills.map((bill) => (
                      <BillRowItem
                        key={bill._id}
                        bill={bill}
                        payDate={payDate}
                        isExcluded={excludedBills.includes(bill._id)}
                        onClick={() => onBillClick(bill._id)}
                        onToggleExclude={() => toggleExclude(bill._id)}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
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

export function BillList() {
  const { data: bills } = api.bill.getAll.useQuery();
  const { data: incomeProfile } = api.income.getIncomeProfile.useQuery();
  const { data: groups } = api.group.getAll.useQuery();
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  if (!incomeProfile || !bills || !groups) return null;

  const billsInPayPeriod = getBillsByPayPeriod(bills, incomeProfile);
  const ingoing = incomeProfile.amount ?? 0;

  const handleBillClick = (billId: string) => {
    setSelectedBillId(billId);
    setModalOpen(true);
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {billsInPayPeriod.map(({ payDate, bills, after }, index) => (
          <BillListCard
            key={index}
            payDate={payDate}
            bills={bills}
            groups={groups}
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
}
```

Note: `getBillsByPayPeriod` already returns bills typed as `BillRow` (BillEvent & { date: Date }). The new `groupId` field flows through automatically because `BillEvent` was extended in Task 1.

- [ ] **Step 2: Verify typecheck and lint**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/billList.tsx
git commit -m "feat: section bills by group in dashboard pay-period cards"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run full check**

Run: `pnpm check`
Expected: No lint or type errors anywhere.

- [ ] **Step 2: Recommended manual database step (one-time, optional)**

Connect to your MongoDB and create the index for ordered group queries:

```js
db.groups.createIndex({ userId: 1, order: 1 });
```

This is optional (queries will work without it on small datasets) but matches the design's index recommendation.

- [ ] **Step 3: Manual smoke test**

Start the dev server:

```bash
pnpm dev
```

Then walk through:

1. **Empty state.** Navigate to `/groups`. Empty-state CTA visible. Click "Create your first group".
2. **Create.** Create a group named `BPI Savings`. Toast appears, dialog closes, the group shows in the list with a colored swatch.
3. **Create more.** Add two more groups: `Cash`, `Credit Card`. They get successive palette colors.
4. **Reorder.** Drag `Credit Card` to the top. After drop, the row order reflects the new order (and after a reload, persists).
5. **Edit.** Click the pencil icon on `Cash`. Rename to `GCash`. Save. Toast appears, list updates.
6. **Assign at create.** Go to `/bills/create`. The Group select shows the three groups (with swatches). Pick `BPI Savings`, fill the rest, submit. You're redirected to `/dashboard`.
7. **Section view.** On the dashboard, the new bill appears under a `BPI Savings` heading inside its pay-period card. Subtotal matches the bill's amount.
8. **Edit & reassign.** Click the bill on the dashboard. The detail view shows the group row. Click Edit, change the group to `GCash`, Save. Dashboard re-renders with the bill under the new section.
9. **Ungrouped.** Edit the bill again, select `No group`, Save. The bill now appears under an `Ungrouped` section at the bottom of the card with a neutral swatch.
10. **Delete-with-bills.** On `/groups`, delete `GCash`. The confirm copy reads "Delete 'GCash'? This will remove the group from N bills...". Confirm. The group disappears; any bills previously in it become ungrouped on the dashboard (no orphaned references).
11. **Playground untouched.** Open `/playground`, open a bill form. Verify there is **no** Group field.
12. **Existing bills unaffected.** Any bills created before this feature should display in the `Ungrouped` section.

- [ ] **Step 4: Push the branch (optional, not required for plan completion)**

If everything looks good:

```bash
git push -u origin HEAD
```

---

## Self-review (already completed)

- **Spec coverage:** All design sections mapped to tasks — data model (Task 1), color helper (Task 1), group router (Task 2), bill router updates (Task 3), bill form Group field (Task 4), default-value plumbing (Task 5), bill detail view (Task 6), management page incl. DnD reorder & delete confirm (Task 7), middleware + nav link (Task 8), dashboard sectioning + subtotals (Task 9). The spec's "Filtering bills" / "Bulk reassign" / "Playground groups" non-goals are honored.
- **Placeholder scan:** No "TBD"/"TODO"/"similar to" left. All code blocks are complete.
- **Type consistency:** `Group` shape is identical across `src/types/index.ts`, `src/server/api/routers/group.ts` (`GroupDoc`), and the `GroupManager` component. `groupId` is `string | null` on the client and `ObjectId | null | undefined` server-side, with `serializeBill` bridging the two consistently.
