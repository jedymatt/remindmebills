# Design: Extend BillFormFields to billModal and playgroundBillModal

**Date:** 2026-02-21
**Status:** Approved

## Problem

`billModal.tsx` (565 lines) and `playgroundBillModal.tsx` (548 lines) both contain:

- Identical Zod schemas (`BaseBillFormValues`, `SingleBillFormValues`, `RecurringBillFormValues`, `BillFormValuesSchema`) — already extracted to `billFormFields.tsx` but not yet consumed
- ~160–220 lines of identical form field JSX — already covered by `BillFormFields`

Additionally, `BillEditMode` in `billModal.tsx` has the field-clearing bug: the "Ends..." RadioGroup `onValueChange` only calls `setRecurringEndsWith` without clearing the opposing `count`/`until` field values. This is the same bug that `createBillForm` had before the previous refactor.

## Solution

Mirror the existing refactor pattern. In each edit-mode sub-component: remove local schemas, import from `billFormFields`, replace form JSX with `<BillFormFields />`, and fix the field-clearing bug in `BillEditMode`.

## Changes

### `billModal.tsx`

- Remove local schema definitions (`BaseBillFormValues`, `SingleBillFormValues`, `RecurringBillFormValues`, `BillFormValuesSchema`, `BillFormValues`)
- Import `BillFormValuesSchema`, `BillFormValues`, `BillFormFields` from `~/components/billFormFields`
- In `BillEditMode`:
  - Keep: `useForm` init, tRPC mutation, `recurringEndsWith` state, `handleSubmit`
  - Remove: `useWatch` (handled inside `BillFormFields`)
  - Add field-clearing to the RadioGroup handler: clear `recurrence.count` when switching away from `"count"`, clear `recurrence.until` when switching away from `"until"`
  - Replace the `<Form>` + `<form>` JSX body with `<BillFormFields form={form} recurringEndsWith={recurringEndsWith} onRecurringEndsWithChange={...} formId="edit-bill-form" onSubmit={handleSubmit} />`
- Remove now-unused imports: `z`, `useWatch`, and all form/input/select/tabs/separator/radio-group/label shadcn imports

### `playgroundBillModal.tsx`

- Remove local schema definitions (same set as above)
- Import `BillFormValuesSchema`, `BillFormValues`, `BillFormFields` from `~/components/billFormFields`
- In `PlaygroundBillEditMode`:
  - Keep: `useForm` init, `recurringEndsWith` state, `handleRecurringEndsWithChange` (already correct with field-clearing), `handleSubmit`
  - Remove: `useWatch` (handled inside `BillFormFields`)
  - Replace form JSX with `<BillFormFields form={form} recurringEndsWith={recurringEndsWith} onRecurringEndsWithChange={handleRecurringEndsWithChange} formId="edit-playground-bill-form" onSubmit={handleSubmit} />`
- Remove same unused imports

### `billFormFields.tsx`

No changes.

## Side Effect: Bug Fix

`BillEditMode` will gain correct field-clearing behavior on "Ends..." mode switch, consistent with create and playground flows.

## What Does NOT Change

- No changes to tRPC routers, MongoDB, or server schemas
- No changes to `BillViewMode`, `PlaygroundBillViewMode`, `BillModal`, `PlaygroundBillModal` wrappers
- The action buttons (Cancel / Save Changes) remain outside the form, linked via `form=` attribute — compatible with `BillFormFields`' `formId` prop
- File naming and project conventions unchanged
