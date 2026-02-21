# Preserve "Recurring Ends With" Values Across Radio Switches

## Problem

When switching the "Ends..." radio group (Never / After / Until) in any bill form, user-entered values for count and until are cleared. Switching back to a previous option requires re-entering data.

Two root causes:
1. Every parent's `handleRecurringEndsWithChange` explicitly calls `form.setValue("recurrence.count", undefined)` and `form.setValue("recurrence.until", undefined)` when the selection changes.
2. React Hook Form nullifies field values when the Controller-level `disabled` prop changes to `true`.

## Solution

**Approach A: Input-level disabled + submit cleanup**

### BillFormFields changes
- Move `disabled` from `FormField` to `<Input>` for `recurrence.count` and `recurrence.until`. This makes disable visual-only; RHF preserves the value in form state.
- Add `handleInternalSubmit` wrapper that strips stale count/until based on `recurringEndsWith` before calling `onSubmit`. This ensures the API never receives contradictory data.

### Parent component changes
Simplify `handleRecurringEndsWithChange` in all 4 parents to just `setRecurringEndsWith(value)` (remove `form.setValue` clearing lines):
- `createBillForm.tsx`
- `billModal.tsx` (BillEditMode)
- `playgroundBillModal.tsx` (PlaygroundBillEditMode)
- `playgroundBillFormDialog.tsx`

## Files touched

| File | Change |
|------|--------|
| `src/components/billFormFields.tsx` | Move `disabled` to `<Input>`, add submit wrapper |
| `src/components/createBillForm.tsx` | Remove clearing from handler |
| `src/components/billModal.tsx` | Remove clearing from handler |
| `src/components/playgroundBillModal.tsx` | Remove clearing from handler |
| `src/components/playgroundBillFormDialog.tsx` | Remove clearing from handler |

## Alternatives considered

- **Shadow state**: Store count/until in separate `useState`. More state to manage, easy to desync.
- **Schema-level discriminator**: Add `recurringEndsWith` to Zod schema. Over-engineered, ripples to API.
