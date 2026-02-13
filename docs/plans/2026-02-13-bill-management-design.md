# Bill Management Design: View, Edit, Delete

**Date:** 2026-02-13
**Status:** Approved
**Scope:** Bills only (not income profiles)

## Overview

Add the ability to view, edit, and delete bills through a modal-based interface. Users click any bill in the dashboard to open a modal in view mode, then can switch to edit mode or delete the bill.

## User Flow

1. User clicks a bill in the dashboard → Modal opens in **view mode**
2. View mode shows: title, amount, type (single/recurring), date/recurrence details (read-only)
3. User clicks **"Edit"** → Modal switches to **edit mode** (reuses create bill form)
4. User clicks **"Delete"** → Confirmation dialog → If confirmed, deletes bill and closes modal
5. User clicks **"Save"** in edit mode → Updates bill, switches back to view mode
6. User clicks **"Cancel"** in edit mode → Discards changes, switches back to view mode

## Architecture

### Modal Component Structure
- Single `BillModal` component with `mode` state: `"view" | "edit"`
- Reuses existing `CreateBillForm` component from `/bills/create`
- View mode is a separate read-only display component

### State Management
- Modal open/close state lives in parent (`BillList` component)
- Selected bill ID passed as prop
- React Query handles data fetching and cache invalidation

### Routing
- No URL changes (modal-based, stays on `/dashboard`)
- Optional enhancement: Add query param like `?bill=<id>` for deep linking

### Recurring Bill Handling (Option 1: Template-Only)
- Any instance of a recurring bill opens the same parent bill in modal
- View mode clearly indicates "Recurring Bill" and shows recurrence rules
- **Edit/delete affects the entire series** (no per-instance modifications)
- Future enhancement: Can upgrade to Option 2 (Google Calendar-style per-instance edits) without breaking changes

## Components

### New Components

**1. `BillModal`** (`src/components/billModal.tsx`)
- Manages view/edit mode state
- Fetches bill data by ID using tRPC
- Handles modal open/close
- Coordinates transitions between view and edit modes

**2. `BillViewMode`** (`src/components/billViewMode.tsx`)
- Read-only display of bill details
- Shows different layouts for single vs recurring bills
- "Edit" and "Delete" action buttons

**3. `BillEditMode`** (inline in `BillModal`)
- Wraps the existing `CreateBillForm` component
- Pre-populates form with bill data
- Handles save (calls update mutation) and cancel

**4. `DeleteConfirmationDialog`** (uses shadcn/ui AlertDialog)
- "Are you sure you want to delete [Bill Title]?" message
- Different message for recurring: "This will delete all occurrences"

### Modified Components

**1. `BillList` / `BillListCard`** (existing)
- Make bill items clickable
- Add `onClick` handler to open modal with bill ID
- Pass selected bill ID to `BillModal`

## Data Flow & API

### New tRPC Procedures

Add to `src/server/api/routers/bill.ts`:

**1. `getById`** — Fetch a single bill
```typescript
getById: protectedProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const bill = await ctx.db.collection<BillEvent>("bills").findOne({
      _id: new ObjectId(input.id),
      userId: new ObjectId(ctx.session.user.id),
    });

    if (!bill) throw new TRPCError({ code: "NOT_FOUND" });
    return bill;
  })
```

**2. `update`** — Update a bill
```typescript
update: protectedProcedure
  .input(z.object({
    id: z.string(),
    data: InputBillSchema,  // reuse existing schema
  }))
  .mutation(async ({ ctx, input }) => {
    const result = await ctx.db.collection("bills").updateOne(
      {
        _id: new ObjectId(input.id),
        userId: new ObjectId(ctx.session.user.id),
      },
      { $set: input.data }
    );

    if (result.matchedCount === 0) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
  })
```

**3. `delete`** — Delete a bill
```typescript
delete: protectedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const result = await ctx.db.collection("bills").deleteOne({
      _id: new ObjectId(input.id),
      userId: new ObjectId(ctx.session.user.id),
    });

    if (result.deletedCount === 0) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
  })
```

### Request Flow

**Opening Modal (View Mode):**
1. User clicks bill → `BillModal` receives `billId` prop
2. `api.bill.getById.useQuery({ id: billId })` fetches bill data
3. Modal renders `BillViewMode` with bill data

**Editing:**
1. User clicks "Edit" → mode switches to `"edit"`
2. `BillEditMode` pre-populates `CreateBillForm` with current bill data
3. User modifies form → clicks "Save"
4. Calls `api.bill.update.useMutation()`
5. On success:
   - Invalidates `api.bill.getAll` query (refreshes dashboard)
   - Invalidates `api.bill.getById` query (refreshes modal)
   - Switches mode back to `"view"`

**Deleting:**
1. User clicks "Delete" → confirmation dialog appears
2. User confirms → calls `api.bill.delete.useMutation()`
3. On success:
   - Invalidates `api.bill.getAll` query (refreshes dashboard)
   - Closes modal
   - Shows success toast notification

### Cache Invalidation Strategy
- After update/delete: Invalidate both `getAll` and `getById` queries
- React Query automatically refetches active queries
- Dashboard updates immediately to reflect changes

## UI/UX Details

### View Mode
- **Header**: Bill title (truncate if long)
- **Content**:
  - Single bills: Date, amount (if set)
  - Recurring bills: Badge showing "Recurring", recurrence pattern in readable format (e.g., "Every 2 weeks starting Jan 1, 2026")
- **Footer**: "Edit" and "Delete" buttons (secondary and destructive variants)
- **Close**: X button in header, click outside, or ESC key

### Edit Mode
- **Header**: "Edit Bill"
- **Content**: Full form (reused from create page)
- **Footer**: "Cancel" (reverts to view) and "Save" buttons
- **Close**: Cancel button or ESC key (not click-outside, to prevent accidental data loss)
- **Unsaved changes**: Optional enhancement - warn if user tries to close with unsaved changes

### Delete Confirmation
- **Single bills**: "Delete [Bill Title]? This cannot be undone."
- **Recurring bills**: "Delete [Bill Title]? This will delete all occurrences of this recurring bill. This cannot be undone."
- **Buttons**: "Cancel" (default focus) and "Delete" (destructive)

### Loading States
- Modal shows skeleton while fetching bill data
- Save/Delete buttons show loading spinner while mutating

### Success Feedback
- **After save**: Toast notification "Bill updated successfully"
- **After delete**: Toast notification "Bill deleted successfully"
- **Auto-close**: Delete closes modal immediately

## Edge Cases

1. **Bill not found**: Show error toast "This bill no longer exists", close modal automatically
2. **Concurrent edits**: Last write wins (acceptable for single-user app)
3. **Empty amount**: View shows "—" or "Not set"
4. **Clicking different bill while modal open**: Switch to new bill (fetch new data)
5. **Mobile responsiveness**: Modal takes full screen on mobile

## Error Handling

- `NOT_FOUND` errors: Show "Bill not found" message, close modal
- Network errors: Show error toast, keep modal open
- Validation errors: Display in form (handled by React Hook Form + Zod)

## Accessibility

- Modal traps focus
- Proper ARIA labels for buttons
- Keyboard navigation (Tab, ESC, Enter)
- Delete confirmation focuses "Cancel" by default (safer)

## Future Enhancements

1. **Deep linking**: Add `?bill=<id>` query param for shareable links
2. **Recurring bill exceptions**: Upgrade to Option 2 (per-instance edits) if needed
3. **Unsaved changes warning**: Prompt before closing edit mode with unsaved changes
4. **Optimistic updates**: Show changes immediately before server confirmation
5. **Undo delete**: Brief toast with "Undo" button after deletion

## Migration Path to Option 2 (Per-Instance Edits)

If we later need Google Calendar-style per-instance edits:

1. Add exceptions collection to MongoDB
2. Add optional `exdates?: Date[]` field to recurring bills
3. Update bill resolution logic to merge exceptions
4. Update UI to show "Edit this/series" options
5. **No breaking changes** — existing bills continue to work as-is
