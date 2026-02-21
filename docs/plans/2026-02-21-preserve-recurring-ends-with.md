# Preserve "Recurring Ends With" Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stop clearing count/until form values when switching the "Ends..." radio option, so users can switch back without re-entering data.

**Architecture:** Move `disabled` from Controller-level (`FormField`) to visual-level (`Input`) so RHF preserves values. Remove explicit clearing from parent handlers. Add submit-time cleanup in `BillFormFields` to strip stale values before they reach the API.

**Tech Stack:** React Hook Form, Radix UI, Zod, Shadcn/ui

---

### Task 1: Move `disabled` from FormField to Input in BillFormFields

**Files:**
- Modify: `src/components/billFormFields.tsx:237-261` (count field)
- Modify: `src/components/billFormFields.tsx:265-292` (until field)

**Step 1: Move `disabled` on the count field**

In `src/components/billFormFields.tsx`, remove `disabled` from the `FormField` at line 242 and add it to the `Input` at line 254.

Before (line 237-261):
```tsx
<FormField
  control={form.control}
  name="recurrence.count"
  rules={{ min: 1 }}
  defaultValue={1}
  disabled={recurringEndsWith !== "count"}  // REMOVE this line
  render={({ field }) => (
    <FormItem className="pt-0.5">
      ...
      <FormControl>
        <Input
          type="number"
          placeholder="No. of terms"
          {...field}
                                                // ADD disabled here
          value={field.value ?? ""}
        />
```

After:
```tsx
<FormField
  control={form.control}
  name="recurrence.count"
  rules={{ min: 1 }}
  defaultValue={1}
  render={({ field }) => (
    <FormItem className="pt-0.5">
      ...
      <FormControl>
        <Input
          type="number"
          placeholder="No. of terms"
          {...field}
          disabled={recurringEndsWith !== "count"}
          value={field.value ?? ""}
        />
```

**Step 2: Move `disabled` on the until field**

Same pattern. Remove `disabled` from `FormField` at line 268 and add it to `Input` at line 280.

Before (line 265-292):
```tsx
<FormField
  control={form.control}
  name="recurrence.until"
  disabled={recurringEndsWith !== "until"}  // REMOVE this line
  render={({ field }) => (
    ...
        <Input
          type="date"
          placeholder="Until"
          {...field}
                                            // ADD disabled here
          value={
```

After:
```tsx
<FormField
  control={form.control}
  name="recurrence.until"
  render={({ field }) => (
    ...
        <Input
          type="date"
          placeholder="Until"
          {...field}
          disabled={recurringEndsWith !== "until"}
          value={
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/billFormFields.tsx
git commit -m "fix: move disabled from FormField to Input for count/until fields"
```

---

### Task 2: Add submit-time cleanup in BillFormFields

**Files:**
- Modify: `src/components/billFormFields.tsx:82-86`

**Step 1: Add `handleInternalSubmit` wrapper**

Before `return (` at line 82, add:

```tsx
const handleInternalSubmit = (data: BillFormValues) => {
  if (data.type === "recurring") {
    if (recurringEndsWith !== "count") data.recurrence.count = undefined;
    if (recurringEndsWith !== "until") data.recurrence.until = undefined;
  }
  return onSubmit(data);
};
```

Then change line 86 from:
```tsx
onSubmit={form.handleSubmit(onSubmit)}
```
to:
```tsx
onSubmit={form.handleSubmit(handleInternalSubmit)}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/billFormFields.tsx
git commit -m "fix: add submit-time cleanup for stale count/until values"
```

---

### Task 3: Remove explicit clearing from all parent handlers

**Files:**
- Modify: `src/components/createBillForm.tsx:42-48`
- Modify: `src/components/billModal.tsx:98-104`
- Modify: `src/components/playgroundBillModal.tsx:147-153`
- Modify: `src/components/playgroundBillFormDialog.tsx:40-46`

**Step 1: Simplify all 4 handlers**

In each file, change `handleRecurringEndsWithChange` from:
```tsx
const handleRecurringEndsWithChange = (
  value: "never" | "until" | "count",
) => {
  setRecurringEndsWith(value);
  if (value !== "count") form.setValue("recurrence.count", undefined);
  if (value !== "until") form.setValue("recurrence.until", undefined);
};
```

To:
```tsx
const handleRecurringEndsWithChange = (
  value: "never" | "until" | "count",
) => {
  setRecurringEndsWith(value);
};
```

Files and line numbers:
- `src/components/createBillForm.tsx` — lines 46-47 (remove 2 lines)
- `src/components/billModal.tsx` — lines 102-103 (remove 2 lines)
- `src/components/playgroundBillModal.tsx` — lines 151-152 (remove 2 lines)
- `src/components/playgroundBillFormDialog.tsx` — lines 44-45 (remove 2 lines)

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Run lint**

Run: `pnpm lint`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/createBillForm.tsx src/components/billModal.tsx src/components/playgroundBillModal.tsx src/components/playgroundBillFormDialog.tsx
git commit -m "fix: remove explicit clearing from recurringEndsWith handlers"
```

---

### Task 4: Final verification

**Step 1: Run full check**

Run: `pnpm check`
Expected: No lint or type errors

**Step 2: Manual test (playground)**

1. Run `pnpm dev`
2. Go to `/playground`, add a bill
3. Switch to "Repeating" tab
4. Select "After", enter count = 5
5. Switch to "Until" — verify count field is disabled but value preserved
6. Switch back to "After" — verify count still shows 5
7. Submit — verify the form submits correctly with count=5 and no until value
