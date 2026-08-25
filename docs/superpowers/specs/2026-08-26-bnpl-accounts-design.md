# BNPL Accounts — Design

Issue: [#44](https://github.com/jedymatt/remindmebills/issues/44) — "add separate section for managing shopee's spaylater items"

## Problem

Buy-now-pay-later purchases (Shopee SPayLater, Lazada LazPayLater, and similar)
can be entered today as ordinary recurring bills, but they clutter the
pay-period bill list. A single month can hold a dozen installment rows that the
user thinks of as one payment.

They also don't behave like ordinary bills. A BNPL provider **consolidates**:
every active purchase's installment for the month lands on one statement, with
one due date and one payment. Modelling each purchase as an independently
scheduled bill misrepresents both the schedule and the payment.

## Goals

- Manage BNPL purchases on their own page, out of the pay-period bill list.
- Keep their money in the dashboard's totals, so projections stay honest.
- Support multiple providers as first-class **accounts**, each with its own
  billing cycle, settled independently.

## Non-goals

Deliberately excluded from this pass, and listed so the omissions are on the
record rather than forgotten:

- Interest, fees, or processing charges; original purchase price; total payable.
- Payoff-progress reporting beyond a per-purchase "3 of 6" count.
- Credit limits and utilization.
- Provider presets (a curated list of BNPL brands with icons/colours).
- Reordering accounts, and per-account colour coding.
- Playground support — `PlaygroundBill` is local-only demo state and gains
  nothing from a second entity shape.

## Model

### `bnpl_accounts` (new collection)

Many per user, one document per provider account.

| Field    | Type       | Notes                                    |
| -------- | ---------- | ---------------------------------------- |
| `_id`    | `ObjectId` |                                          |
| `userId` | `ObjectId` |                                          |
| `name`   | `string`   | Free text, e.g. "SPayLater". 1–50 chars. |
| `dueDay` | `number`   | Day of month, 1–31.                      |

Accounts are listed in creation order via `.sort({ _id: 1 })`. There is
deliberately **no `order` field**: ObjectIds are timestamp-prefixed, so `_id`
already gives a stable insertion-order sort with nothing to write or keep
consistent. `groups` carries `order` because it earns two jobs there — the
drag-reorder mutation and `colorForOrder` swatch derivation — and neither
applies here. Should reordering ever land, adding `order` then is
migration-free: absent means "fall back to `_id` order", the same trick
`bnplAccountId` relies on.

### Purchases: `bills` documents with `bnplAccountId`

A BNPL purchase *is* a finite monthly recurring bill, so it reuses the existing
`bills` collection and the scheduler that already serves it. One new optional
field carries the whole distinction:

```ts
bnplAccountId?: ObjectId;   // present = BNPL installment, and says which account
```

Presence is the discriminator, so no separate `kind` enum is needed and the
account's identity is stored exactly once. An absent field means an ordinary
bill, so **existing documents need no migration**.

A purchase is stored as:

| Field        | Value                                                            |
| ------------ | ---------------------------------------------------------------- |
| `type`       | `"recurring"`                                                    |
| `recurrence` | `{ type: "monthly", interval: 1, dtstart, count: tenureMonths }` |
| `amount`     | The monthly installment. **Required** for purchases.             |
| `groupId`    | Never set. Group UI is not offered for purchases.                |

`amount` is optional on the shared bill schema but required by the purchase
input schema — an installment with no amount can't contribute to a statement.

### Consolidation is structural

`dtstart` is **derived server-side** from the account's `dueDay` plus the first
due month the user picks. The client never sends it.

This is the load-bearing decision in the design. If each purchase carried its
own `dtstart`, the one-statement-per-month invariant would hold only as long as
every entry was made carefully — a convention. Deriving it makes a split
statement unrepresentable.

Derivation clamps to month end, matching `monthlyOccurrencesInPeriod`: first
month February with `dueDay: 31` yields Feb 28, not a roll into March.

## Scheduling and money math

Because purchases live in `bills`, `computeBillsInPeriod` already generates
their occurrences on the shared due date and they are already inside the period
sums. "Counted but not listed" therefore needs **no new money plumbing** — only
a partition at render time.

```ts
// src/lib/bill-utils.ts
partitionBills<T extends { bnplAccountId?: string | null }>(
  rows: T[],
): { bills: T[]; installments: T[] }
```

Generic over the element type because two shapes need it: raw `BillEvent`s (the
summary cards) and generated occurrence rows (`BillEvent & { date: Date }`, the
bill list). One helper, destructured by every consumer rather than filtered ad
hoc. A polymorphic collection rots when the filter is spelled out at each call
site; this is the single narrow seam that prevents that.

### `billList.tsx`

`bills` feed the existing group sections. `installments` group by
**(accountId, dueDate)** and render as one non-expandable roll-up row per
account with a statement in that period:

```
Sep 15 – Sep 29                     +₱1,300
₱18,000 coming in, ₱16,700 going out

  Utilities (2)                       ₱3,500
    Meralco              Sep 20       ₱2,800
    Water                Sep 22         ₱700

  Ungrouped (2)                       ₱9,000
    Rent                 Sep 15       ₱8,000
    Netflix              Sep 18       ₱1,000

  SPayLater (3)          Sep 15       ₱4,200
  LazPayLater (1)        Sep 20         ₱900
```

This preserves the invariant the file documents today — *the sum of section
subtotals equals the card's outgoing total* — which would otherwise break the
moment a counted amount stopped being itemized. The statement amount is derived
from that month's active purchases, so it varies correctly as purchases finish.

Consolidation means a given account contributes at most one statement date per
month, so a fortnightly pay period holds zero or one roll-up row per account.

### `financialSummaryCards.tsx`

- **Total Bills** — each account's statement counts as **1**, not N purchases.
- **Remaining** — includes unpaid statements.
- **Next Bill** — a statement competes with ordinary bills on date; when one
  wins, the card shows the account name and the statement amount.

### Paid state

Paid is per **(account, statement date)**, not per purchase: you settle one
statement, so one toggle. Accounts settle independently.

New bulk procedures take an account id and a statement date and write (or
delete) a `payments` document for each of that account's purchases due then:

- `payment.markStatementPaid`
- `payment.markStatementUnpaid`

Both validate that the account belongs to the requesting user before writing,
mirroring `assertBillOwned` in the existing payment router. Bulk on the server
rather than N mutations from the client. A statement reads as paid when every
purchase due that date has a payment, which also yields exact per-purchase
progress on the page for free.

**Known behaviour:** adding a purchase to a month already marked paid makes that
statement read unpaid again. This is intended — more is genuinely owed — but it
is a decision, not an accident.

## Pages and components

Mirrors the Groups pattern (thin RSC page delegating to one client component),
split up front because `groupManager.tsx` is already 400+ lines.

| File                                        | Responsibility                                        |
| ------------------------------------------- | ----------------------------------------------------- |
| `src/app/bnpl/page.tsx`                     | RSC shell, `force-dynamic`, renders `<BnplManager />`  |
| `src/components/bnplManager.tsx`            | Account list, empty state, orchestration              |
| `src/components/bnplAccountCard.tsx`        | One account: header, current statement, its purchases |
| `src/components/bnplAccountFormDialog.tsx`  | Create/edit account (name, due day)                   |
| `src/components/bnplPurchaseFormDialog.tsx` | Create/edit purchase                                  |
| `src/server/api/routers/bnpl.ts`            | Account CRUD + purchase mutations                     |
| `src/schemas/bnpl.ts`                       | Zod inputs, mirroring `schemas/group.ts`              |

Route `/bnpl`; nav label **BNPL**, between Groups and Playground. No identifier
in the codebase names a specific provider — issue #44 is satisfied by SPayLater
being the first account the user creates.

An account card shows: name, `Due the 15th`, the committed total, the current
statement with its paid toggle, then its purchases with monthly amount and
`3 of 6` progress.

Two terms used above, defined once here:

- **Current statement** — the account's next unelapsed due date (today's date
  included), and the purchases with an installment falling on it.
- **Committed total** — the sum of `amount` across the purchases in the current
  statement. It is the statement's amount, and it shrinks as purchases finish.

The purchase form collects **title, monthly amount, tenure in months, and first
due month**. It never collects a day — that comes from the account.

Purchase mutations live in `bnplRouter`, **not** `billRouter`, even though they
write to `bills`. `bill.create` accepts a raw recurrence; a purchase must have
its `dtstart` derived. Keeping `billRouter`'s contract unchanged means it cannot
mint a BNPL item by accident.

Account ownership is validated on every write, following the existing
`resolveGroupId` pattern in `bill.ts`.

### Types

`src/types/index.ts` gains `BnplAccount`, and `BillEvent` gains
`bnplAccountId?: string | null`.

## Edge cases

### 1. Changing an account's due day rewrites its purchases

Say a SPayLater account has `dueDay: 15` and three purchases, each stored with
`dtstart` on the 15th. The due day then changes to 20 — the provider moved the
cycle, or the original value was a typo.

Updating only the account document leaves the three existing purchases
generating occurrences on the 15th while new ones generate on the 20th. The
dashboard would then show **two** SPayLater rows in the same month. That is the
split statement the derivation exists to prevent, so the mutation that changes
`dueDay` must also rewrite `dtstart` on every purchase belonging to that
account.

### 2. Deleting an account cascades

Deletion removes the account, its purchases, *and* their `payments` documents,
following the cascade already in `bill.delete`. A confirmation dialog names the
purchase count first.

Unsetting `bnplAccountId` instead would turn every installment into an ordinary
bill, which would then materialize as individual rows in the pay-period list —
the exact clutter this feature removes.

### 3. Due days 29–31 clamp to month end

`dueDay` may be 31, but not every month has a 31st. With `dueDay: 31` and
February as the first month, there is no Feb 31 to store. Rolling forward to
Mar 3 would place the statement in the wrong month and skip February entirely,
so derivation clamps backward instead: Feb 28, or Feb 29 in a leap year.

`monthlyOccurrencesInPeriod` already clamps the occurrences it generates. What
needs attention is that the **first** date — `dtstart` itself — is computed with
the same clamping, rather than assuming the generator will cover it.

### 4. Deleting a single purchase cascades its payments

Deleting an ordinary bill also deletes that bill's `payments` rows, or paid
markers would outlive the bill they point at. A purchase is a bill, so it needs
the same cleanup — but purchase mutations live in `bnplRouter` (keeping
`billRouter` unable to mint or manage BNPL items), so `bnplRouter` does not
inherit it.

Rather than duplicating the cascade in both routers, extract it into a **shared
helper** that both call, so the rule lives in one place.

### 5. Every `bill.getAll` consumer is accounted for

`bill.getAll` returns every bill, purchases included. Any consumer that assumes
"these are all ordinary bills" leaks purchases back into a list as individual
rows. The sweep is done, and two consumers deliberately need no change:

| Consumer                                   | Action                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `billList.tsx:354`                         | **Partition** — group rows vs roll-up row                                                               |
| `financialSummaryCards.tsx`                | **Partition** — a statement counts as 1                                                                 |
| `playgroundStartScreen.tsx:31`             | **Partition** — "clone my bills" would otherwise drag purchases into the playground as loose bills       |
| `dashboardPage.tsx:133`                    | **No change, deliberately** — `hasBills` must count purchases, or a BNPL-only user sees "No bills yet"   |
| `groupManager.tsx:232`                     | **No change** — already filters on `groupId`, which purchases never carry                                |
| `billModal`, `billViewMode`, `createBillForm` | **No change** — invalidation only; roll-up rows are not clickable                                     |

`playgroundStartScreen` is the subtle one: a purchase clones perfectly into the
playground *because* it is a structurally valid recurring bill, reappearing as
individual rows in the one surface declared out of scope.

### 6. Lesser cases

- A fully-elapsed purchase stops generating occurrences via `count`; it sorts
  last on the account card with a "Done" badge.
- An account with no purchases shows ₱0 committed and produces no roll-up row.

## Verification

The repo has no test framework. This feature introduces **Vitest** covering only
the pure helpers — the logic where manual clicking verifies worst:

- `dtstart` derivation, including month-end clamping (Feb + day 31, Apr + day
  31, day 28 in every month).
- `partitionBills`.
- Statement grouping by (account, date).

Adds `vitest` as a dev dependency, a config file, and a `test` script. UI is
verified by driving the running app (the project's `verify` skill).

Note: `pnpm check` and `pnpm lint` are unreliable under Next 16 (`next lint` is
removed) — run `tsc --noEmit` and `eslint` directly.

## Future direction

The non-goals fit this model without rework. Interest, purchase price, and
credit limits are all **account-level or purchase-level attributes**, so they
accumulate on `bnpl_accounts` documents or on the purchase input without the
bill schema learning about them, and without disturbing the money-math wiring
established here.
