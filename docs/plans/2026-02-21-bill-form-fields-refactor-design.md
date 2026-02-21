# Design: Extract BillFormFields Component

**Date:** 2026-02-21
**Status:** Approved

## Problem

`createBillForm.tsx` (397 lines) and `playgroundBillFormDialog.tsx` (370 lines) contain:
- Identical Zod schemas (`BaseBillFormValues`, `SingleBillFormValues`, `RecurringBillFormValues`, `BillFormValuesSchema`)
- ~280 lines of identical form field JSX (title, amount, single/recurring tabs, recurrence fields, "Ends..." radio group)

Additionally, `createBillForm` has a subtle bug: it does not clear the opposing recurrence field values (`count`/`until`) when switching "Ends..." mode. The playground component does this correctly.

## Solution

Extract a shared `BillFormFields` component and shared Zod schemas into `src/components/billFormFields.tsx`.

## Component Design

### `BillFormFields` Props

```ts
interface BillFormFieldsProps {
  form: UseFormReturn<BillFormValues>;
  recurringEndsWith: "never" | "until" | "count";
  onRecurringEndsWithChange: (value: "never" | "until" | "count") => void;
}
```

The component renders everything from the Title field through the Tabs (Once/Repeating) and all recurrence sub-fields. It is a pure presentational component — no submission logic, no routing, no tRPC.

### Shared exports from `billFormFields.tsx`

- `BillFormValuesSchema` (Zod schema, replaces both local copies)
- `BillFormValues` (inferred type)
- `BillFormFields` (React component)

## Updated Consumers

### `createBillForm.tsx`
- Remove local schema definitions
- Import `BillFormValuesSchema`, `BillFormValues`, `BillFormFields` from `~/components/billFormFields`
- Extract `recurringEndsWith` state and `handleRecurringEndsWithChange` (with field-clearing) — keep locally
- Replace the body of `<CardContent>` form JSX with `<BillFormFields ... />`

### `playgroundBillFormDialog.tsx`
- Remove local schema definitions
- Import `BillFormValuesSchema`, `BillFormValues`, `BillFormFields` from `~/components/billFormFields`
- Keep: Dialog wrapper, `useForm` init, UUID generation, `onSubmit` prop, `handleOpenChange`
- Replace the `<Form>` body JSX with `<BillFormFields ... />`

## Side Effect: Bug Fix

The canonical `onRecurringEndsWithChange` implementation (from playground) clears opposing field values. This will also apply to `createBillForm`, fixing the silent bug where stale `count`/`until` values were sent on submit.

## What Does NOT Change

- No changes to tRPC routers, MongoDB, or the bill schema on the server
- No changes to `PlaygroundContext`, `PlaygroundBillModal`, or any other components
- File naming: `billFormFields.tsx` (camelCase, matching project convention)
- Card and Dialog wrappers remain in their respective component files
