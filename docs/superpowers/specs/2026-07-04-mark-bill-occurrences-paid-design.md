# Design: Mark bill occurrences as paid — Issue #34

- **Status:** Approved design (v1 scope)
- **Date:** 2026-07-04
- **Branch:** `feat/mark-bill-occurrences-paid`
- **Issue:** #34 — *feat: mark bill occurrences as paid + payment history*

## Problem

There is no concept of a bill being **paid**. A `BillEvent` is purely a
*schedule*; the dashboard sums every projected occurrence and assumes all of
them are still owed. The moment a user pays anything mid-period, the "remaining"
balance and per-period totals are wrong.

## Scope

**In (v1 — the core loop):**

- Mark each **occurrence** paid / unpaid (a monthly bill has one occurrence per
  month, each settled independently).
- The dashboard's *remaining* balance (and per-period card balances) exclude
  paid occurrences.
- Paid state persists per occurrence across sessions and devices.

**Out (deferred to follow-ups):**

- Overdue state (unpaid + past-due styling).
- `amountPaid` capture for variable bills.
- A dedicated payment-history view.
- The `/playground` — it is local-only guest state with no database, so payment
  tracking does not apply there. Untouched.

## Approach

**Chosen: a separate `payments` collection, joined to occurrences on the
client.**

Occurrences are not stored — the dashboard generates them client-side from each
bill's recurrence rule (`getPayPeriodsByCount` / `computeBillsInPeriod` inside
`useMemo`). So paid-state cannot be a flag on an occurrence row; it is a sparse
**side-set** keyed by `(billId, occurrenceDate)`, and the join happens in memory
where the occurrences already exist.

Alternatives rejected:

- **Embed `paidOccurrences: Date[]` on the bill doc** — marking paid becomes a
  read-modify-write on the shared bill document (lost-update risk on rapid
  toggles), the array grows unbounded on long-lived recurring bills, and it does
  not extend cleanly to `amountPaid` later.
- **Move occurrence expansion to the server** — a large architectural inversion
  of the current client-side generation, far beyond this feature's needs.

## Data model

New collection **`payments`**, one document per settled occurrence (sparse:
absence of a document = unpaid):

```
{
  _id:            ObjectId,
  userId:         ObjectId,
  billId:         ObjectId,
  occurrenceDate: Date,   // UTC-midnight day-key, same frame as the scheduler
  paidAt:         Date,   // when marked; server clock
}
```

- Identity is the **`(userId, billId, occurrenceDate)`** triple.
- `occurrenceDate` is normalized to UTC midnight on write
  (`Date.UTC(y, m, d)`) so a stored marker lands in the exact frame that
  `monthlyOccurrencesInPeriod` and RRule generate occurrences in
  (see `src/lib/date-utils.ts`). This alignment is the feature's core
  correctness condition.
- No unique index in v1 — idempotency is handled at the query layer (below).
  A unique compound index on the triple is noted as future hardening.

## API — `paymentRouter`

New router at `src/server/api/routers/payment.ts`, registered in
`src/server/api/root.ts` as `payment`. Follows the existing `bill.ts` patterns
(ObjectId handling, ownership check, serialize helper). All procedures are
`protectedProcedure`.

- **`getAll` (query)** → `Payment[]` for the current user, serialized (ObjectIds
  → hex strings).
- **`markPaid({ billId, occurrenceDate })` (mutation)** → verifies the bill
  exists and is owned by the user, normalizes `occurrenceDate` to UTC midnight,
  then an **idempotent upsert** on the identity triple, refreshing `paidAt`.
  Marking the same occurrence twice yields one document.
- **`markUnpaid({ billId, occurrenceDate })` (mutation)** → ownership check, then
  **`deleteMany`** on the triple.

Both mutations are commands (return nothing); reads go through `getAll`.

**Why `deleteMany` (not `deleteOne`):** MongoDB upserts on a non-unique filter
have a known concurrent-insert race — a fast double-click could create two
documents for one occurrence. `deleteOne` would leave one behind and the user
could not un-pay. `deleteMany` makes unmark self-healing; combined with
disabling the checkbox while the mutation is in flight, duplicates are unlikely
and harmless.

## Client join — `src/lib/payment-utils.ts`

Pure module. Owns the single encoding both sides agree on:

- **`occurrenceKey(billId, date)`** → `` `${billId}:${date.getTime()}` ``.
  `getTime()` is the UTC-based epoch, so the key is timezone-stable. Reading
  local fields (`toDateString`, `getDate`) would shift the day across
  timezones — the date-only-as-instant trap.
- **`buildPaidLookup(payments)`** → `Set<string>` of those keys.
- **`isOccurrencePaid(paidKeys, billId, date)`** → `paidKeys.has(...)`.

## UI — dashboard bill list (`src/app/_components/billList.tsx`)

- `BillList` fetches `api.payment.getAll.useQuery()`, builds `paidKeys` once with
  `buildPaidLookup`, and threads it (plus an `onTogglePaid(billId, date)`
  handler) down through `BillListCard` → `BillRowItem`.
- **`BillRowItem`** gains a leading checkbox. Checked → row dimmed, amount
  struck-through, ✓ shown. Toggling fires `payment.markPaid` / `markUnpaid`; the
  checkbox is **disabled while the mutation is pending** and invalidates
  `payment.getAll` on success — mirroring the existing `assignGroup` mutation
  (disable-then-invalidate, `toast.error` on error). No optimistic-update
  machinery in v1; the per-row disable does not block ticking other rows.
- **Money math:** a paid occurrence is treated exactly like an existing
  *excluded* row — it drops out of the section `subtotalFor`, the card's
  `outgoing`, and therefore `balance`. This preserves the invariant that section
  subtotals sum to the card's outgoing total. Paid visual state takes precedence
  if a row is somehow both paid and excluded.

## UI — summary cards (`src/components/financialSummaryCards.tsx`)

Fetches `payment.getAll` (React Query dedupes the shared query — no extra
network). `totalBillAmount` sums only **unpaid** current-period occurrences, so
the **Balance** card shows true *remaining*. **Next Bill** skips paid
occurrences (period-scoped as today; not widened to look into the next period).

## Error handling

- Mutations surface failures via `toast.error(...)` (matching `assignGroup`).
- Ownership failures throw `TRPCError` `NOT_FOUND` (a payment can only attach to
  a bill the requester owns).
- Unmarking an already-unpaid occurrence and re-marking a paid one are both
  no-op-safe (delete-many of zero rows; idempotent upsert).

## Verification

No test framework is configured; verify per the `verify` skill.

1. `pnpm typecheck` + `eslint` clean; `SKIP_ENV_VALIDATION=1 pnpm build` succeeds.
2. Live (guest session): create a recurring bill → dashboard → check an
   occurrence paid → the row dims/strikes **and** that period's balance rises by
   the bill's amount → reload → still paid → uncheck → reverts.
3. Confirm whether the `/bills` route reuses `BillList` (gets the checkbox for
   free) or renders a flat bill-definition list (no occurrences → no checkbox,
   out of scope).

## Follow-ups (not this PR)

- Overdue state — pairs with #33 (reminders).
- `amountPaid` for variable bills.
- Payment-history view (the "+ payment history" in the issue title).
- Unique compound index on `(userId, billId, occurrenceDate)`.

## Files

- `src/server/api/routers/payment.ts` — new.
- `src/server/api/root.ts` — register `payment`.
- `src/types/index.ts` — add `Payment`.
- `src/lib/payment-utils.ts` — new (join helpers).
- `src/app/_components/billList.tsx` — checkbox, paid styling, money math, mutations.
- `src/components/financialSummaryCards.tsx` — unpaid balance, next-unpaid.

The uncommitted scaffolding on the branch already covers the data model, API,
and join module (with the `deleteOne` → `deleteMany` fix to apply); the bill-list
and summary-card UI is the unwritten part.
