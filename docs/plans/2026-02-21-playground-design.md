# Playground Feature Design

**Date:** 2026-02-21
**Status:** Approved

## Overview

A "what-if" scenario planner for existing authenticated users to simulate adding new expenses (e.g., a loan payment) and see how they would affect their budget—without modifying real data.

## Requirements

- **Users:** Existing authenticated users only
- **Purpose:** Experiment with hypothetical bills to assess affordability
- **Starting state:** User chooses "Start Fresh" (blank) or "Clone My Bills" (copy existing)
- **Analysis:** Reuse existing `FinancialSummaryCards` component
- **Persistence:** Session-only (cleared on page refresh)
- **Location:** Separate `/playground` route

## Architecture

### Approach: Client-Side State Only

All playground data lives in React state. No new API endpoints or database changes.

### Data Flow

1. User clicks "Playground" from dashboard nav
2. Lands on `/playground` with start screen offering two choices
3. "Start Fresh" → empty playground state
4. "Clone My Bills" → fetch via `api.bill.getAll`, copy to local state
5. All subsequent add/edit/delete operations modify local state only

### State Management

```typescript
// PlaygroundContext (React Context + useReducer)
interface PlaygroundState {
  bills: PlaygroundBill[];           // Local-only bill objects
  incomeProfile: IncomeProfile;      // Cloned from user's real profile (read-only)
  isInitialized: boolean;
}

// Actions: add, update, delete, reset
```

- `PlaygroundBill` matches `BillEvent` shape but uses local UUID instead of MongoDB ObjectId
- Income profile is always cloned from user's real profile (required for calculations)
- No API calls after initial clone

### Component Reuse

| Existing Component | Reuse Strategy |
|---|---|
| `FinancialSummaryCards` | Pass playground bills as prop |
| `CreateBillForm` | Add optional `onSubmit` prop override |
| `BillList` / `BillListCard` | Render from local state |
| `BillModal` | Add optional `onSave`/`onDelete` prop overrides |

## UI Design

### Page Layout

```
┌─────────────────────────────────────────────────────┐
│  Nav: [Dashboard] [Playground*] [+ New Bill]        │
├─────────────────────────────────────────────────────┤
│  Warning Banner: "Playground Mode - Won't be saved" │
├─────────────────────────────────────────────────────┤
│  FinancialSummaryCards (using playground bills)     │
├─────────────────────────────────────────────────────┤
│  Bills by Pay Period                 [+ Add Bill]   │
│  BillList (from playground state)                   │
├─────────────────────────────────────────────────────┤
│  [Reset Playground]                                 │
└─────────────────────────────────────────────────────┘
```

### Start Screen

```
┌─────────────────────────────────────────────────────┐
│           Financial Playground                      │
│                                                     │
│   Experiment with "what-if" scenarios.              │
│   Add hypothetical bills to see how they'd          │
│   affect your budget. Nothing is saved.             │
│                                                     │
│   [Start Fresh]        [Clone My Bills]             │
└─────────────────────────────────────────────────────┘
```

### Key UI Elements

1. **Persistent warning banner** - Amber styling, always visible
2. **"Add Bill" button** - Opens `CreateBillForm` dialog, submits to local state
3. **"Reset Playground" button** - Clears state, returns to start screen
4. **Nav highlight** - "Playground" shows active state

## File Structure

### New Files

```
src/app/playground/
├── page.tsx                    # Route entry point
└── layout.tsx                  # Uses AuthenticatedLayout

src/components/
├── playgroundPage.tsx          # Main page with start screen logic
├── playgroundContext.tsx       # React Context + useReducer
├── playgroundStartScreen.tsx   # Blank/Clone choice UI
├── playgroundWorkspace.tsx     # Active playground view
└── playgroundBanner.tsx        # Warning banner
```

### Modified Files

```
src/components/
├── authenticatedLayout.tsx     # Add "Playground" nav link
├── createBillForm.tsx          # Add optional onSubmit prop
└── billModal.tsx               # Add optional onSave/onDelete props
```

## Edge Cases

| Scenario | Behavior |
|---|---|
| No income profile | Redirect to dashboard with setup prompt |
| No bills + "Clone" | Start with empty array (same as "Start Fresh") |
| Navigate away | State lost, no confirmation needed |
| Page refresh | Returns to start screen |

## Constraints

1. No new API endpoints - uses existing `bill.getAll` and `income.getIncomeProfile`
2. No database writes - all mutations are local state
3. Playground bills use `crypto.randomUUID()` for IDs
4. Income profile is read-only in playground

## Out of Scope

- Saving/exporting scenarios
- Sharing scenarios via URL
- Side-by-side comparison view
- Modifying income profile in playground
- Undo/redo functionality
