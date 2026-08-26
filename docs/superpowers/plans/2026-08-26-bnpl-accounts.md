# BNPL Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manage buy-now-pay-later purchases on a dedicated `/bnpl` page, grouped under provider accounts, so their installments leave the pay-period bill list while their money stays in the dashboard's totals.

**Architecture:** A BNPL purchase is stored as an ordinary `bills` document carrying a new optional `bnplAccountId`. Presence of that field is the only discriminator, so no migration is needed and the existing scheduler, occurrence generator, and `payments` join are reused verbatim. Provider accounts live in a new `bnpl_accounts` collection and own the shared monthly `dueDay`; each purchase's `dtstart` is derived server-side from that day, which makes a split statement unrepresentable. The dashboard partitions bills at render time and shows one roll-up row per account per period.

**Tech Stack:** Next.js 16 (App Router), tRPC 11, MongoDB native driver, Zod 4, React Hook Form, Shadcn/ui, Tailwind 4, date-fns, rrule, Vitest (introduced by this plan).

**Spec:** `docs/superpowers/specs/2026-08-26-bnpl-accounts-design.md`

## Global Constraints

- Path alias `~/` maps to `src/`. Use it for cross-directory imports.
- TypeScript is strict, with `noUncheckedIndexedAccess` (array/index access yields `T | undefined` — handle it) and `verbatimModuleSyntax` (type-only imports MUST use `import type`).
- Date-only values are canonical **UTC midnight**. Build them with `Date.UTC(...)`, format them with `formatUtcDate`, and floor them with `truncateToUtcDateOnly`. Never use local-time constructors for a stored date.
- Currency is PHP, rendered via `toLocaleString("en-PH", { style: "currency", currency: "PHP" })`.
- `pnpm check` and `pnpm lint` are unreliable under Next 16 (`next lint` was removed). Verify with `pnpm exec tsc --noEmit` and `pnpm exec eslint <paths>` directly.
- Package manager is **pnpm**.
- New tRPC routers must be registered in `src/server/api/root.ts`.
- No identifier, label, or comment in the codebase may name a specific provider (no "Shopee", no "SPayLater"). Providers are user-created account rows.
- Every mutation is a `protectedProcedure` and must scope its query by `userId`.

---

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `vitest.config.ts` | Vitest config with the `~` alias |
| `src/lib/bnpl-utils.ts` | Pure BNPL logic: dtstart derivation, statement grouping, installment progress |
| `src/lib/bnpl-utils.test.ts` | Tests for the above |
| `src/lib/bill-utils.test.ts` | Tests for `partitionBills` |
| `src/schemas/bnpl.ts` | Zod input schemas |
| `src/server/api/bill-cascade.ts` | Shared "delete bills + their payments" cascade |
| `src/server/api/routers/bnpl.ts` | Account CRUD + purchase mutations |
| `src/app/bnpl/page.tsx` | RSC shell |
| `src/components/bnplManager.tsx` | Account list, empty state, orchestration |
| `src/components/bnplAccountCard.tsx` | One account: statement, paid toggle, purchases |
| `src/components/bnplAccountFormDialog.tsx` | Create/edit account |
| `src/components/bnplPurchaseFormDialog.tsx` | Create/edit purchase |

**Modified:**

| File | Change |
| --- | --- |
| `package.json` | Add `vitest` dev dep, `test` scripts |
| `src/types/index.ts` | Add `BnplAccount`; add `bnplAccountId` to `BillEvent` |
| `src/lib/bill-utils.ts` | Add `partitionBills` |
| `src/server/api/routers/bill.ts` | `delete` uses the shared cascade |
| `src/server/api/routers/payment.ts` | Add statement-level paid mutations |
| `src/server/api/root.ts` | Register `bnplRouter` |
| `src/components/authenticatedLayout.tsx` | Add the BNPL nav link |
| `src/app/_components/billList.tsx` | Partition; render roll-up rows |
| `src/components/financialSummaryCards.tsx` | Partition; statement counts as 1 |
| `src/components/playgroundStartScreen.tsx` | Clone only ordinary bills |

---

## Task 1: Vitest setup and `dtstart` derivation

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/bnpl-utils.ts`
- Test: `src/lib/bnpl-utils.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `deriveStatementDtstart(dueDay: number, firstDueMonth: Date): Date` — the first statement date for a purchase, at UTC midnight, clamped back to month end. Tasks 4 and 5 call it.

- [ ] **Step 1: Install Vitest**

```bash
pnpm add -D vitest
```

- [ ] **Step 2: Add the Vitest config**

Create `vitest.config.ts`. The alias mirrors the `~/*` path in `tsconfig.json` so tests can import project modules; declaring it manually avoids adding a tsconfig-paths plugin.

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add test scripts**

In `package.json`, add to `"scripts"`:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 4: Write the failing test**

Create `src/lib/bnpl-utils.test.ts`. Vitest globals are not enabled, so the helpers are imported explicitly.

```ts
import { describe, expect, it } from "vitest";
import { deriveStatementDtstart } from "~/lib/bnpl-utils";

// Helper: a UTC-midnight date, for readable expectations.
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("deriveStatementDtstart", () => {
  it("uses the account's due day in the chosen month", () => {
    expect(deriveStatementDtstart(15, utc(2026, 9, 1))).toEqual(utc(2026, 9, 15));
  });

  it("ignores the day component of firstDueMonth", () => {
    // Only the year and month of the input matter; the day comes from dueDay.
    expect(deriveStatementDtstart(5, utc(2026, 9, 28))).toEqual(utc(2026, 9, 5));
  });

  it("clamps day 31 back to the end of a short month", () => {
    expect(deriveStatementDtstart(31, utc(2026, 2, 1))).toEqual(utc(2026, 2, 28));
    expect(deriveStatementDtstart(31, utc(2026, 4, 1))).toEqual(utc(2026, 4, 30));
  });

  it("clamps to Feb 29 in a leap year", () => {
    expect(deriveStatementDtstart(31, utc(2028, 2, 1))).toEqual(utc(2028, 2, 29));
  });

  it("leaves day 28 untouched in every month", () => {
    for (let month = 1; month <= 12; month++) {
      expect(deriveStatementDtstart(28, utc(2026, month, 1))).toEqual(
        utc(2026, month, 28),
      );
    }
  });

  it("returns exact UTC midnight", () => {
    const result = deriveStatementDtstart(15, utc(2026, 9, 1));
    expect(result.getUTCHours()).toBe(0);
    expect(result.getTime() % 86_400_000).toBe(0);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `~/lib/bnpl-utils`.

- [ ] **Step 6: Write the implementation**

Create `src/lib/bnpl-utils.ts`:

```ts
// Pure BNPL logic. A BNPL provider consolidates: every active purchase's
// installment for the month lands on one statement, with one due date and one
// payment. That invariant is enforced here — the account owns the day-of-month,
// and a purchase's schedule is derived from it rather than supplied alongside
// it, so a split statement can't be constructed.

/** Last day of the given UTC month (`month` is 0-indexed). */
function lastDayOfUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * First statement date for a purchase: the account's `dueDay` placed in the
 * month of `firstDueMonth`, at canonical UTC midnight.
 *
 * A `dueDay` of 29–31 doesn't exist in every month, so it clamps *backward* to
 * that month's last day — day 31 in February yields Feb 28 (Feb 29 in a leap
 * year). Rolling forward instead would push the statement into the wrong month
 * and skip the intended one. This matches the clamping that
 * `monthlyOccurrencesInPeriod` applies to every occurrence *after* the first;
 * doing it here keeps the anchor in the same frame as the series it seeds.
 *
 * Only the year and month of `firstDueMonth` are read — its day is irrelevant,
 * since the day always comes from the account.
 */
export function deriveStatementDtstart(
  dueDay: number,
  firstDueMonth: Date,
): Date {
  const year = firstDueMonth.getUTCFullYear();
  const month = firstDueMonth.getUTCMonth();
  const day = Math.min(dueDay, lastDayOfUtcMonth(year, month));
  return new Date(Date.UTC(year, month, day));
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS — 6 tests.

- [ ] **Step 8: Typecheck and lint**

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/lib/bnpl-utils.ts src/lib/bnpl-utils.test.ts vitest.config.ts
```

Expected: both clean.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts src/lib/bnpl-utils.ts src/lib/bnpl-utils.test.ts
git commit -m "feat: add Vitest and BNPL statement dtstart derivation (#44)"
```

---

## Task 2: `partitionBills`

**Files:**
- Modify: `src/lib/bill-utils.ts`
- Modify: `src/types/index.ts`
- Test: `src/lib/bill-utils.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `BillEvent` gains `bnplAccountId?: string | null`.
  - `partitionBills<T extends { bnplAccountId?: string | null }>(rows: T[]): { bills: T[]; installments: T[] }` — used by Tasks 9 and 10.

- [ ] **Step 1: Add `bnplAccountId` to `BillEvent`**

In `src/types/index.ts`, extend the `BillEvent` type. It currently reads:

```ts
export type BillEvent = {
  _id: string;
  title: string;
  amount?: number;
  userId: string;
  groupId?: string | null;
} & (Single | Recurring);
```

Add the field with a comment explaining the discriminator:

```ts
export type BillEvent = {
  _id: string;
  title: string;
  amount?: number;
  userId: string;
  groupId?: string | null;
  // Present = this bill is a BNPL installment purchase, and names the account
  // it belongs to. Absent = an ordinary bill. Presence is the only
  // discriminator, which is why no migration was needed to introduce it.
  bnplAccountId?: string | null;
} & (Single | Recurring);
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/bill-utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { partitionBills } from "~/lib/bill-utils";

describe("partitionBills", () => {
  it("splits installments from ordinary bills", () => {
    const rows = [
      { _id: "a" },
      { _id: "b", bnplAccountId: "acc1" },
      { _id: "c", bnplAccountId: null },
      { _id: "d", bnplAccountId: "acc2" },
    ];

    const { bills, installments } = partitionBills(rows);

    expect(bills.map((b) => b._id)).toEqual(["a", "c"]);
    expect(installments.map((b) => b._id)).toEqual(["b", "d"]);
  });

  it("treats an empty-string account id as an ordinary bill", () => {
    // Defensive: an empty string is not a usable ObjectId, so it must not be
    // routed into the installment bucket where it would be grouped by a
    // meaningless key.
    const { bills, installments } = partitionBills([
      { _id: "a", bnplAccountId: "" },
    ]);

    expect(bills.map((b) => b._id)).toEqual(["a"]);
    expect(installments).toEqual([]);
  });

  it("preserves input order within each bucket", () => {
    const rows = [
      { _id: "1", bnplAccountId: "x" },
      { _id: "2" },
      { _id: "3", bnplAccountId: "x" },
      { _id: "4" },
    ];

    const { bills, installments } = partitionBills(rows);

    expect(bills.map((b) => b._id)).toEqual(["2", "4"]);
    expect(installments.map((b) => b._id)).toEqual(["1", "3"]);
  });

  it("returns two empty buckets for empty input", () => {
    expect(partitionBills([])).toEqual({ bills: [], installments: [] });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test src/lib/bill-utils.test.ts`
Expected: FAIL — `partitionBills` is not exported.

- [ ] **Step 4: Write the implementation**

Append to `src/lib/bill-utils.ts`:

```ts
/**
 * Split rows into ordinary bills and BNPL installments.
 *
 * BNPL purchases share the `bills` collection, so `bill.getAll` returns both
 * kinds. This is the single place that filter is spelled: a polymorphic
 * collection rots when each call site writes its own predicate, and a missed
 * one leaks installments back into a list as individual rows — the exact
 * clutter the BNPL feature removes.
 *
 * Generic over the element type because two shapes need it: raw `BillEvent`s
 * (the summary cards) and generated occurrence rows (`BillEvent & { date: Date }`,
 * the bill list).
 */
export function partitionBills<T extends { bnplAccountId?: string | null }>(
  rows: T[],
): { bills: T[]; installments: T[] } {
  const bills: T[] = [];
  const installments: T[] = [];

  for (const row of rows) {
    if (row.bnplAccountId) {
      installments.push(row);
    } else {
      bills.push(row);
    }
  }

  return { bills, installments };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS — all tests from Tasks 1 and 2.

- [ ] **Step 6: Typecheck and lint**

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/lib/bill-utils.ts src/lib/bill-utils.test.ts src/types/index.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/bill-utils.ts src/lib/bill-utils.test.ts src/types/index.ts
git commit -m "feat: add partitionBills and bnplAccountId on BillEvent (#44)"
```

---

## Task 3: Statement grouping and installment progress

**Files:**
- Modify: `src/lib/bnpl-utils.ts`
- Modify: `src/lib/bnpl-utils.test.ts`
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes: `deriveStatementDtstart` (Task 1), `truncateToUtcDateOnly` from `~/lib/date-utils`.
- Produces:
  - `BnplAccount` type: `{ _id: string; userId: string; name: string; dueDay: number }`.
  - `Statement` type: `{ accountId: string; accountName: string; date: Date; amount: number; purchaseCount: number; billIds: string[] }`.
  - `groupStatements(installments, accounts): Statement[]` — used by Tasks 8 and 9.
  - `installmentProgress(dtstart: Date, count: number | undefined, asOf: Date): { elapsed: number; total: number }` — used by Task 8.

- [ ] **Step 1: Add the `BnplAccount` type**

Append to `src/types/index.ts`:

```ts
// A BNPL provider account (Shopee SPayLater, LazPayLater, …). The account owns
// the shared monthly `dueDay`: every purchase under it derives its schedule from
// that day, which is what makes one consolidated statement per month structural
// rather than a data-entry convention.
export interface BnplAccount {
  _id: string;
  userId: string;
  name: string;
  dueDay: number;
}
```

- [ ] **Step 2: Write the failing tests**

Append to `src/lib/bnpl-utils.test.ts`. Note the imports at the top of the file must be extended to include `groupStatements` and `installmentProgress`.

```ts
import type { BnplAccount } from "~/types";
import { groupStatements, installmentProgress } from "~/lib/bnpl-utils";

const account = (id: string, name: string, dueDay = 15): BnplAccount => ({
  _id: id,
  userId: "u1",
  name,
  dueDay,
});

describe("groupStatements", () => {
  it("sums one account's installments on the same date into one statement", () => {
    const result = groupStatements(
      [
        { _id: "b1", bnplAccountId: "a1", amount: 1250, date: utc(2026, 9, 15) },
        { _id: "b2", bnplAccountId: "a1", amount: 700, date: utc(2026, 9, 15) },
        { _id: "b3", bnplAccountId: "a1", amount: 2250, date: utc(2026, 9, 15) },
      ],
      [account("a1", "SPayLater")],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      accountId: "a1",
      accountName: "SPayLater",
      amount: 4200,
      purchaseCount: 3,
    });
    expect(result[0]?.billIds).toEqual(["b1", "b2", "b3"]);
  });

  it("keeps different accounts as separate statements", () => {
    const result = groupStatements(
      [
        { _id: "b1", bnplAccountId: "a1", amount: 1000, date: utc(2026, 9, 15) },
        { _id: "b2", bnplAccountId: "a2", amount: 900, date: utc(2026, 9, 20) },
      ],
      [account("a1", "SPayLater"), account("a2", "LazPayLater", 20)],
    );

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.accountName)).toEqual([
      "SPayLater",
      "LazPayLater",
    ]);
  });

  it("sorts by date, then by account name", () => {
    const result = groupStatements(
      [
        { _id: "b1", bnplAccountId: "a2", amount: 1, date: utc(2026, 9, 20) },
        { _id: "b2", bnplAccountId: "a1", amount: 1, date: utc(2026, 9, 15) },
        { _id: "b3", bnplAccountId: "a3", amount: 1, date: utc(2026, 9, 15) },
      ],
      [account("a1", "Bravo"), account("a2", "Alpha", 20), account("a3", "Alpha")],
    );

    expect(result.map((s) => [s.accountName, s.date.getUTCDate()])).toEqual([
      ["Alpha", 15],
      ["Bravo", 15],
      ["Alpha", 20],
    ]);
  });

  it("treats a missing amount as zero", () => {
    const result = groupStatements(
      [{ _id: "b1", bnplAccountId: "a1", date: utc(2026, 9, 15) }],
      [account("a1", "SPayLater")],
    );

    expect(result[0]?.amount).toBe(0);
    expect(result[0]?.purchaseCount).toBe(1);
  });

  it("keeps installments whose account is unknown, under a fallback name", () => {
    // Money must never silently vanish from the roll-up: the period's outgoing
    // total already includes this installment, so dropping it here would break
    // the "subtotals sum to the balance" invariant the bill list documents.
    const result = groupStatements(
      [{ _id: "b1", bnplAccountId: "gone", amount: 500, date: utc(2026, 9, 15) }],
      [],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ accountName: "BNPL", amount: 500 });
  });

  it("floors dates to their UTC day when grouping", () => {
    const result = groupStatements(
      [
        { _id: "b1", bnplAccountId: "a1", amount: 100, date: utc(2026, 9, 15) },
        {
          _id: "b2",
          bnplAccountId: "a1",
          amount: 100,
          date: new Date(Date.UTC(2026, 8, 15, 13, 30)),
        },
      ],
      [account("a1", "SPayLater")],
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.amount).toBe(200);
  });

  it("returns nothing for no installments", () => {
    expect(groupStatements([], [account("a1", "SPayLater")])).toEqual([]);
  });
});

describe("installmentProgress", () => {
  it("counts the first month as installment 1", () => {
    expect(installmentProgress(utc(2026, 9, 15), 6, utc(2026, 9, 15))).toEqual({
      elapsed: 1,
      total: 6,
    });
  });

  it("counts elapsed months inclusively", () => {
    expect(installmentProgress(utc(2026, 9, 15), 6, utc(2026, 11, 15))).toEqual({
      elapsed: 3,
      total: 6,
    });
  });

  it("counts across a year boundary", () => {
    expect(installmentProgress(utc(2026, 11, 15), 6, utc(2027, 2, 15))).toEqual({
      elapsed: 4,
      total: 6,
    });
  });

  it("never exceeds the total", () => {
    expect(installmentProgress(utc(2026, 9, 15), 6, utc(2028, 9, 15))).toEqual({
      elapsed: 6,
      total: 6,
    });
  });

  it("reports zero before the first installment", () => {
    expect(installmentProgress(utc(2026, 9, 15), 6, utc(2026, 8, 15))).toEqual({
      elapsed: 0,
      total: 6,
    });
  });

  it("treats a missing count as a single installment", () => {
    // A purchase always has a tenure, but `count` is optional on the shared
    // recurrence type, so the fallback must be defined rather than NaN.
    expect(installmentProgress(utc(2026, 9, 15), undefined, utc(2026, 9, 15)))
      .toEqual({ elapsed: 1, total: 1 });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test src/lib/bnpl-utils.test.ts`
Expected: FAIL — `groupStatements` and `installmentProgress` are not exported.

- [ ] **Step 4: Write the implementation**

Append to `src/lib/bnpl-utils.ts`:

```ts
import { truncateToUtcDateOnly } from "~/lib/date-utils";
import type { BnplAccount } from "~/types";

/** Shown when an installment references an account that no longer exists. */
const UNKNOWN_ACCOUNT_NAME = "BNPL";

/** One account's consolidated obligation on one date. */
export interface Statement {
  accountId: string;
  accountName: string;
  date: Date;
  amount: number;
  purchaseCount: number;
  billIds: string[];
}

/** The shape `groupStatements` needs from a generated occurrence row. */
interface InstallmentOccurrence {
  _id: string;
  bnplAccountId?: string | null;
  amount?: number;
  date: Date;
}

/**
 * Collapse installment occurrences into one statement per (account, date).
 *
 * This is what a BNPL provider actually bills: not N separate purchases, but a
 * single consolidated payment per account per month. The amount is derived
 * rather than stored, so it shrinks on its own as purchases finish their tenure.
 *
 * An installment whose account has vanished is kept under a fallback name
 * instead of being dropped. The enclosing period's outgoing total already counts
 * it, so discarding it here would make the section subtotals stop summing to the
 * balance — the same reasoning behind the bill list's "Ungrouped" catch-all.
 */
export function groupStatements(
  installments: InstallmentOccurrence[],
  accounts: BnplAccount[],
): Statement[] {
  const nameById = new Map(accounts.map((a) => [a._id, a.name]));
  const byKey = new Map<string, Statement>();

  for (const row of installments) {
    const accountId = row.bnplAccountId;
    if (!accountId) continue;

    const date = truncateToUtcDateOnly(row.date);
    const key = `${accountId}:${date.getTime()}`;

    const existing = byKey.get(key);
    if (existing) {
      existing.amount += row.amount ?? 0;
      existing.purchaseCount += 1;
      existing.billIds.push(row._id);
      continue;
    }

    byKey.set(key, {
      accountId,
      accountName: nameById.get(accountId) ?? UNKNOWN_ACCOUNT_NAME,
      date,
      amount: row.amount ?? 0,
      purchaseCount: 1,
      billIds: [row._id],
    });
  }

  return [...byKey.values()].sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      a.accountName.localeCompare(b.accountName),
  );
}

/**
 * How far a purchase has advanced through its tenure as of a given statement
 * date — the "3 of 6" on an account card.
 *
 * Counted inclusively from `dtstart`, so the first statement reads 1 of N, and
 * clamped to `[0, total]` so a long-finished purchase reads N of N rather than
 * drifting past it. Month arithmetic uses UTC fields to stay in the same frame
 * as the stored anchor.
 */
export function installmentProgress(
  dtstart: Date,
  count: number | undefined,
  asOf: Date,
): { elapsed: number; total: number } {
  const total = count ?? 1;
  const monthsApart =
    (asOf.getUTCFullYear() - dtstart.getUTCFullYear()) * 12 +
    (asOf.getUTCMonth() - dtstart.getUTCMonth());
  const elapsed = Math.min(Math.max(monthsApart + 1, 0), total);

  return { elapsed, total };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS — all tests from Tasks 1–3.

- [ ] **Step 6: Typecheck and lint**

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/lib/bnpl-utils.ts src/lib/bnpl-utils.test.ts src/types/index.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/bnpl-utils.ts src/lib/bnpl-utils.test.ts src/types/index.ts
git commit -m "feat: add BNPL statement grouping and installment progress (#44)"
```

---

## Task 4: BNPL account router

**Files:**
- Create: `src/schemas/bnpl.ts`
- Create: `src/server/api/bill-cascade.ts`
- Create: `src/server/api/routers/bnpl.ts`
- Modify: `src/server/api/root.ts`

**Interfaces:**
- Consumes: `deriveStatementDtstart` (Task 1), `BnplAccount` (Task 3).
- Produces:
  - `deleteBillsWithPayments(db, userOid, billOids): Promise<number>` — used again in Task 5.
  - `bnpl.getAll` → `BnplAccount[]`, sorted by `_id`.
  - `bnpl.create({ name, dueDay })` → `BnplAccount`.
  - `bnpl.update({ id, data: { name?, dueDay? } })` → `void`.
  - `bnpl.delete({ id, purchases: "delete" | "keep" })` → `void`.
  - Exported from `bnpl.ts` for Task 5: `type BnplAccountDoc`, `assertAccountOwned(ctx, accountId)`.
  - Zod schemas in `src/schemas/bnpl.ts`, extended in Task 5.

- [ ] **Step 1: Write the account schemas**

Create `src/schemas/bnpl.ts`, mirroring the style of `src/schemas/group.ts`:

```ts
import { z } from "zod";

// `dueDay` accepts 1–31 even though short months lack 29–31. The day is clamped
// backward when a statement date is derived (see `deriveStatementDtstart`), so
// storing the user's intent verbatim is correct — rejecting 31 would stop them
// modelling a real end-of-month cycle.
const dueDaySchema = z.number().int().min(1).max(31);
const accountNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Name is required" })
  .max(50);

export const CreateBnplAccountInputSchema = z.object({
  name: accountNameSchema,
  dueDay: dueDaySchema,
});

export const UpdateBnplAccountInputSchema = z.object({
  id: z.string(),
  data: z.object({
    name: accountNameSchema.optional(),
    dueDay: dueDaySchema.optional(),
  }),
});

// `purchases` has no default on purpose: deleting an account is destructive in
// one direction and merely untidy in the other, so the caller must state which
// it wants rather than inheriting a choice made here.
export const DeleteBnplAccountInputSchema = z.object({
  id: z.string(),
  purchases: z.enum(["delete", "keep"]),
});

export type CreateBnplAccountInput = z.infer<
  typeof CreateBnplAccountInputSchema
>;
export type UpdateBnplAccountInput = z.infer<
  typeof UpdateBnplAccountInputSchema
>;
```

- [ ] **Step 2: Create the shared cascade helper**

Create `src/server/api/bill-cascade.ts`. Both the account delete below and the
bill router (Task 5) need it, so it lands here rather than being written twice.

```ts
import type { Db, ObjectId } from "mongodb";

/**
 * Delete bills together with the paid-occurrence markers pointing at them.
 *
 * A `payments` document is a small marker meaning "this bill's occurrence on
 * this date is settled" — it carries no amount, only that pairing. Occurrences
 * are generated from a bill's recurrence rather than stored, so a marker is
 * only meaningful while its bill exists. Deleting a bill without its markers
 * leaves rows nothing can render and nothing can clear.
 *
 * Shared by the bill router and the BNPL router: purchases are `bills` rows,
 * but their mutations live in the BNPL router, so without this helper the same
 * rule would be written twice and remembered once.
 *
 * Returns the number of bills actually deleted, so callers can distinguish
 * "not found" from "deleted".
 */
export async function deleteBillsWithPayments(
  db: Db,
  userOid: ObjectId,
  billOids: ObjectId[],
): Promise<number> {
  if (billOids.length === 0) return 0;

  const result = await db
    .collection("bills")
    .deleteMany({ _id: { $in: billOids }, userId: userOid });

  await db
    .collection("payments")
    .deleteMany({ userId: userOid, billId: { $in: billOids } });

  return result.deletedCount;
}
```

- [ ] **Step 3: Write the router**

Create `src/server/api/routers/bnpl.ts`:

```ts
import { TRPCError } from "@trpc/server";
import { ObjectId, type Db, type WithoutId } from "mongodb";
import { deriveStatementDtstart } from "~/lib/bnpl-utils";
import {
  CreateBnplAccountInputSchema,
  DeleteBnplAccountInputSchema,
  UpdateBnplAccountInputSchema,
} from "~/schemas/bnpl";
import { deleteBillsWithPayments } from "../bill-cascade";
import { createTRPCRouter, protectedProcedure } from "../trpc";

// DB representation — ObjectId fields. See ~/types `BnplAccount` for the
// domain shape.
export type BnplAccountDoc = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  dueDay: number;
};

// Minimal shape of a purchase document this router reads back when rewriting
// schedules. Purchases are `bills` rows; see the bill router for the full type.
type PurchaseDoc = {
  _id: ObjectId;
  recurrence?: { dtstart?: Date };
};

/**
 * Confirms the account exists and belongs to the requesting user. Mirrors
 * `resolveGroupId` in the bill router. Returns the resolved ids so callers
 * don't re-parse them.
 */
export async function assertAccountOwned(
  ctx: { db: Db; session: { user: { id: string } } },
  accountId: string,
): Promise<{ accountOid: ObjectId; userOid: ObjectId; dueDay: number }> {
  if (!ObjectId.isValid(accountId)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
  }

  const accountOid = new ObjectId(accountId);
  const userOid = new ObjectId(ctx.session.user.id);
  const found = await ctx.db
    .collection<BnplAccountDoc>("bnpl_accounts")
    .findOne(
      { _id: accountOid, userId: userOid },
      { projection: { dueDay: 1 } },
    );

  if (!found) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
  }

  return { accountOid, userOid, dueDay: found.dueDay };
}

export const bnplRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    // Sorted by _id: ObjectIds are timestamp-prefixed, so this is a stable
    // creation-order sort with no `order` field to write or keep consistent.
    const cursor = ctx.db
      .collection<BnplAccountDoc>("bnpl_accounts")
      .find({ userId: new ObjectId(ctx.session.user.id) })
      .sort({ _id: 1 });
    const accounts = await cursor.toArray();
    await cursor.close();

    return accounts.map((a) => ({
      _id: a._id.toHexString(),
      userId: a.userId.toHexString(),
      name: a.name,
      dueDay: a.dueDay,
    }));
  }),

  create: protectedProcedure
    .input(CreateBnplAccountInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = new ObjectId(ctx.session.user.id);

      const result = await ctx.db
        .collection<WithoutId<BnplAccountDoc>>("bnpl_accounts")
        .insertOne({ userId, name: input.name, dueDay: input.dueDay });

      return {
        _id: result.insertedId.toHexString(),
        userId: userId.toHexString(),
        name: input.name,
        dueDay: input.dueDay,
      };
    }),

  update: protectedProcedure
    .input(UpdateBnplAccountInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { accountOid, userOid } = await assertAccountOwned(ctx, input.id);

      const updateFields: Partial<Pick<BnplAccountDoc, "name" | "dueDay">> = {};
      if (input.data.name !== undefined) updateFields.name = input.data.name;
      if (input.data.dueDay !== undefined)
        updateFields.dueDay = input.data.dueDay;

      if (Object.keys(updateFields).length === 0) return;

      await ctx.db
        .collection<BnplAccountDoc>("bnpl_accounts")
        .updateOne({ _id: accountOid, userId: userOid }, { $set: updateFields });

      if (input.data.dueDay === undefined) return;

      // A new due day must be applied to the purchases already under this
      // account, not just to future ones. Otherwise old purchases keep firing
      // on the previous day while new ones fire on the new day, and the account
      // silently splits into two statements a month — precisely what deriving
      // `dtstart` from the account exists to prevent.
      //
      // Each purchase keeps its own first *month*; only the day-of-month moves.
      const cursor = ctx.db
        .collection<PurchaseDoc>("bills")
        .find(
          { userId: userOid, bnplAccountId: accountOid },
          { projection: { "recurrence.dtstart": 1 } },
        );
      const purchases = await cursor.toArray();
      await cursor.close();

      const ops = purchases.flatMap((purchase) => {
        const dtstart = purchase.recurrence?.dtstart;
        if (!dtstart) return [];

        return [
          {
            updateOne: {
              filter: { _id: purchase._id, userId: userOid },
              update: {
                $set: {
                  "recurrence.dtstart": deriveStatementDtstart(
                    input.data.dueDay!,
                    dtstart,
                  ),
                },
              },
            },
          },
        ];
      });

      if (ops.length > 0) {
        await ctx.db.collection("bills").bulkWrite(ops);
      }
    }),

  delete: protectedProcedure
    .input(DeleteBnplAccountInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { accountOid, userOid } = await assertAccountOwned(ctx, input.id);

      if (input.purchases === "delete") {
        const cursor = ctx.db
          .collection<{ _id: ObjectId }>("bills")
          .find(
            { userId: userOid, bnplAccountId: accountOid },
            { projection: { _id: 1 } },
          );
        const purchases = await cursor.toArray();
        await cursor.close();

        await deleteBillsWithPayments(
          ctx.db,
          userOid,
          purchases.map((p) => p._id),
        );
      } else {
        // Keep: drop only the account reference, so each purchase becomes an
        // ordinary monthly recurring bill. Its `count` still ends it at the
        // close of its tenure.
        //
        // `payments` is deliberately untouched — the bill ids don't change, so
        // every existing paid-marker stays valid and correctly attached.
        await ctx.db
          .collection("bills")
          .updateMany(
            { userId: userOid, bnplAccountId: accountOid },
            { $unset: { bnplAccountId: "" } },
          );
      }

      // Purchases are handled first so a failure here can be retried without
      // having already orphaned them — the same ordering as `group.delete`.
      await ctx.db
        .collection<BnplAccountDoc>("bnpl_accounts")
        .deleteOne({ _id: accountOid, userId: userOid });
    }),
});
```

- [ ] **Step 4: Register the router**

In `src/server/api/root.ts`, add the import and the entry:

```ts
import { bnplRouter } from "~/server/api/routers/bnpl";
```

```ts
export const appRouter = createTRPCRouter({
  post: postRouter,
  bill: billRouter,
  bnpl: bnplRouter,
  group: groupRouter,
  income: incomeRouter,
  payment: paymentRouter,
});
```

- [ ] **Step 5: Typecheck and lint**

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/schemas/bnpl.ts src/server/api/bill-cascade.ts src/server/api/routers/bnpl.ts src/server/api/root.ts
```

Expected: both clean. The `input.data.dueDay!` non-null assertion inside the `flatMap` is guarded by the `undefined` early-return above it; if the lint config forbids `!`, hoist it instead: `const nextDueDay = input.data.dueDay;` before the early return, then use `nextDueDay`.

- [ ] **Step 6: Commit**

```bash
git add src/schemas/bnpl.ts src/server/api/bill-cascade.ts src/server/api/routers/bnpl.ts src/server/api/root.ts
git commit -m "feat: add BNPL account router with due-day schedule rewrite (#44)"
```

---

## Task 5: Purchase mutations

**Files:**
- Modify: `src/server/api/routers/bill.ts:120-146`
- Modify: `src/server/api/routers/bnpl.ts`
- Modify: `src/schemas/bnpl.ts`

**Interfaces:**
- Consumes: `assertAccountOwned`, `BnplAccountDoc`, `deleteBillsWithPayments` (Task 4), `deriveStatementDtstart` (Task 1).
- Produces:
  - `bnpl.createPurchase({ accountId, title, amount, tenureMonths, firstDueMonth })` → `void`.
  - `bnpl.updatePurchase({ id, data: { title, amount, tenureMonths, firstDueMonth } })` → `void`.
  - `bnpl.deletePurchase({ id })` → `void`.

- [ ] **Step 1: Use the shared cascade in the bill router**

In `src/server/api/routers/bill.ts`, add the import:

```ts
import { deleteBillsWithPayments } from "../bill-cascade";
```

Replace the body of the `delete` procedure (currently the `deleteOne` plus the trailing `payments` `deleteMany`) with:

```ts
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ObjectId.isValid(input.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }

      const deleted = await deleteBillsWithPayments(
        ctx.db,
        new ObjectId(ctx.session.user.id),
        [new ObjectId(input.id)],
      );

      if (deleted === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }
    }),
```

- [ ] **Step 2: Add the purchase schemas**

Append to `src/schemas/bnpl.ts`:

```ts
// A purchase's schedule is not accepted from the client: only its first *month*
// is, and the day comes from the account. That's what makes one consolidated
// statement per month impossible to violate rather than merely discouraged.
const purchaseFieldsSchema = z.object({
  title: z.string().trim().min(1, { message: "Title is required" }),
  // Required, unlike the shared bill schema's optional amount — an installment
  // with no amount can't contribute to a statement total.
  amount: z.number().min(1, { message: "Amount is required" }),
  tenureMonths: z.number().int().min(1).max(60),
  firstDueMonth: z.date(),
});

export const CreateBnplPurchaseInputSchema = purchaseFieldsSchema.extend({
  accountId: z.string(),
});

export const UpdateBnplPurchaseInputSchema = z.object({
  id: z.string(),
  data: purchaseFieldsSchema,
});

export const DeleteBnplPurchaseInputSchema = z.object({ id: z.string() });

export type CreateBnplPurchaseInput = z.infer<
  typeof CreateBnplPurchaseInputSchema
>;
export type UpdateBnplPurchaseInput = z.infer<
  typeof UpdateBnplPurchaseInputSchema
>;
```

- [ ] **Step 3: Add the purchase mutations**

In `src/server/api/routers/bnpl.ts`, extend the imports:

```ts
import {
  CreateBnplAccountInputSchema,
  CreateBnplPurchaseInputSchema,
  DeleteBnplAccountInputSchema,
  DeleteBnplPurchaseInputSchema,
  UpdateBnplAccountInputSchema,
  UpdateBnplPurchaseInputSchema,
} from "~/schemas/bnpl";
```

Add these procedures inside `bnplRouter`:

```ts
  createPurchase: protectedProcedure
    .input(CreateBnplPurchaseInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { accountOid, userOid, dueDay } = await assertAccountOwned(
        ctx,
        input.accountId,
      );

      await ctx.db.collection("bills").insertOne({
        userId: userOid,
        bnplAccountId: accountOid,
        title: input.title,
        amount: input.amount,
        type: "recurring",
        recurrence: {
          type: "monthly",
          interval: 1,
          // Derived, never client-supplied: the account owns the day.
          dtstart: deriveStatementDtstart(dueDay, input.firstDueMonth),
          count: input.tenureMonths,
        },
      });
    }),

  updatePurchase: protectedProcedure
    .input(UpdateBnplPurchaseInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ObjectId.isValid(input.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase not found" });
      }

      const userOid = new ObjectId(ctx.session.user.id);
      const purchase = await ctx.db
        .collection<{ _id: ObjectId; bnplAccountId?: ObjectId }>("bills")
        .findOne(
          { _id: new ObjectId(input.id), userId: userOid },
          { projection: { bnplAccountId: 1 } },
        );

      // Guard on bnplAccountId, not just existence: this endpoint must not be
      // usable to reshape an ordinary bill into an installment.
      if (!purchase?.bnplAccountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase not found" });
      }

      const { dueDay } = await assertAccountOwned(
        ctx,
        purchase.bnplAccountId.toHexString(),
      );

      await ctx.db.collection("bills").updateOne(
        { _id: purchase._id, userId: userOid },
        {
          $set: {
            title: input.data.title,
            amount: input.data.amount,
            type: "recurring",
            recurrence: {
              type: "monthly",
              interval: 1,
              dtstart: deriveStatementDtstart(dueDay, input.data.firstDueMonth),
              count: input.data.tenureMonths,
            },
          },
        },
      );
    }),

  deletePurchase: protectedProcedure
    .input(DeleteBnplPurchaseInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ObjectId.isValid(input.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase not found" });
      }

      const deleted = await deleteBillsWithPayments(
        ctx.db,
        new ObjectId(ctx.session.user.id),
        [new ObjectId(input.id)],
      );

      if (deleted === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Purchase not found" });
      }
    }),
```

- [ ] **Step 4: Typecheck and lint**

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/server/api/routers/bill.ts src/server/api/routers/bnpl.ts src/schemas/bnpl.ts
```

- [ ] **Step 5: Run the existing tests**

Run: `pnpm test`
Expected: PASS — nothing in Tasks 1–3 should be affected.

- [ ] **Step 6: Commit**

```bash
git add src/server/api/routers/bill.ts src/server/api/routers/bnpl.ts src/schemas/bnpl.ts
git commit -m "feat: add BNPL purchase mutations (#44)"
```

---

## Task 6: Statement-level paid mutations

**Files:**
- Modify: `src/server/api/routers/payment.ts`

**Interfaces:**
- Consumes: `assertAccountOwned` (Task 4), `truncateToUtcDateOnly`.
- Produces:
  - `payment.markStatementPaid({ accountId, statementDate, billIds })` → `void`.
  - `payment.markStatementUnpaid({ accountId, statementDate, billIds })` → `void`.

- [ ] **Step 1: Add the mutations**

In `src/server/api/routers/payment.ts`, extend the imports:

```ts
import { assertAccountOwned } from "./bnpl";
```

Add a shared validation helper above `paymentRouter`:

```ts
// A statement is settled as a unit, so its mutations act on a set of bill ids.
// Every id must belong to the requesting user *and* to the named account —
// otherwise this endpoint would be a way to write payments against arbitrary
// bills in bulk.
async function assertPurchasesInAccount(
  ctx: { db: Db; session: { user: { id: string } } },
  accountId: string,
  billIds: string[],
): Promise<{ billOids: ObjectId[]; userOid: ObjectId }> {
  const { accountOid, userOid } = await assertAccountOwned(ctx, accountId);

  if (billIds.some((id) => !ObjectId.isValid(id))) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Purchase not found" });
  }

  const billOids = billIds.map((id) => new ObjectId(id));
  const matched = await ctx.db.collection("bills").countDocuments({
    _id: { $in: billOids },
    userId: userOid,
    bnplAccountId: accountOid,
  });

  if (matched !== billOids.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Purchase not found" });
  }

  return { billOids, userOid };
}
```

Add the input schema and both procedures inside `paymentRouter`:

```ts
  markStatementPaid: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        statementDate: z.date(),
        billIds: z.array(z.string()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { billOids, userOid } = await assertPurchasesInAccount(
        ctx,
        input.accountId,
        input.billIds,
      );
      const occurrenceDate = truncateToUtcDateOnly(input.statementDate);

      // One bulkWrite rather than N client mutations: a statement is a single
      // user action and shouldn't be able to land half-applied because a
      // request in the middle failed.
      await ctx.db.collection("payments").bulkWrite(
        billOids.map((billId) => ({
          updateOne: {
            filter: { userId: userOid, billId, occurrenceDate },
            update: { $set: { paidAt: new Date() } },
            upsert: true,
          },
        })),
      );
    }),

  markStatementUnpaid: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        statementDate: z.date(),
        billIds: z.array(z.string()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { billOids, userOid } = await assertPurchasesInAccount(
        ctx,
        input.accountId,
        input.billIds,
      );

      // deleteMany, mirroring markUnpaid: self-heals any duplicate a concurrent
      // upsert race may have created.
      await ctx.db.collection("payments").deleteMany({
        userId: userOid,
        billId: { $in: billOids },
        occurrenceDate: truncateToUtcDateOnly(input.statementDate),
      });
    }),
```

- [ ] **Step 2: Typecheck and lint**

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/server/api/routers/payment.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/server/api/routers/payment.ts
git commit -m "feat: add statement-level paid mutations (#44)"
```

---

## Task 7: `/bnpl` page, account list, and nav

**Files:**
- Create: `src/app/bnpl/page.tsx`
- Create: `src/components/bnplManager.tsx`
- Create: `src/components/bnplAccountFormDialog.tsx`
- Modify: `src/components/authenticatedLayout.tsx:5-13,100-104`

**Interfaces:**
- Consumes: `bnpl.getAll`, `bnpl.create`, `bnpl.update`, `bnpl.delete` (Task 4); `BnplAccount` (Task 3).
- Produces: `<BnplManager />`; `<BnplAccountFormDialog open onOpenChange account? />` where `account?: BnplAccount` switches it between create and edit.

- [ ] **Step 1: Add the nav link**

In `src/components/authenticatedLayout.tsx`, add `CreditCard` to the `lucide-react` import list (keep it alphabetical: after `Receipt` is wrong — it goes first, before `FlaskConical`):

```ts
import {
  CreditCard,
  FlaskConical,
  FolderTree,
  LayoutDashboard,
  Menu,
  Receipt,
  type LucideIcon,
} from "lucide-react";
```

Then extend `navLinks`:

```ts
const navLinks: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/groups", label: "Groups", icon: FolderTree },
  { href: "/bnpl", label: "BNPL", icon: CreditCard },
  { href: "/playground", label: "Playground", icon: FlaskConical },
];
```

- [ ] **Step 2: Create the account form dialog**

Create `src/components/bnplAccountFormDialog.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { BnplAccount } from "~/types";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";

const AccountFormSchema = z.object({
  name: z.string().trim().min(1, { message: "Name is required" }).max(50),
  dueDay: z.coerce.number().int().min(1).max(31),
});

type AccountFormValues = z.infer<typeof AccountFormSchema>;

export function BnplAccountFormDialog({
  open,
  onOpenChange,
  account,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: BnplAccount;
  onSubmit: (values: AccountFormValues) => void;
  isPending: boolean;
}) {
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(AccountFormSchema),
    defaultValues: { name: "", dueDay: 15 },
  });

  // Reset on open so an edit shows the current values and a create starts clean.
  useEffect(() => {
    if (!open) return;
    form.reset(
      account
        ? { name: account.name, dueDay: account.dueDay }
        : { name: "", dueDay: 15 },
    );
  }, [open, account, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Edit account" : "New account"}</DialogTitle>
          <DialogDescription>
            A BNPL provider bills every purchase on one monthly statement.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            id="bnpl-account-form"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="SPayLater" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dueDay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statement due day</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={31} {...field} />
                  </FormControl>
                  <FormDescription>
                    Months without this day use their last day instead.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form="bnpl-account-form" disabled={isPending}>
            {isPending && <Loader2 className="mr-1 size-4 animate-spin" />}
            {account ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create the manager**

Create `src/components/bnplManager.tsx`. The account card itself arrives in Task 8; this task renders a placeholder row per account so the CRUD is verifiable on its own.

```tsx
"use client";

import { CreditCard, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import type { BnplAccount } from "~/types";
import { AuthenticatedLayout } from "./authenticatedLayout";
import { BnplAccountFormDialog } from "./bnplAccountFormDialog";
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
import { Skeleton } from "./ui/skeleton";

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="border-ledger-line flex flex-col items-center rounded-lg border border-dashed py-12">
      <span className="bg-ledger-accent-soft text-ledger-accent-strong mb-3 flex size-11 items-center justify-center rounded-2xl">
        <CreditCard className="size-5" />
      </span>
      <h3 className="text-ledger-ink font-display text-lg">No BNPL accounts</h3>
      <p className="text-ledger-muted mt-1 text-sm">
        Add an account to track its installments separately from your bills.
      </p>
      <Button className="mt-4" onClick={onAdd}>
        New Account <Plus className="ml-1 size-4" />
      </Button>
    </div>
  );
}

export function BnplManager() {
  const utils = api.useUtils();
  const { data: accounts, isLoading } = api.bnpl.getAll.useQuery();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BnplAccount | null>(null);
  const [deleting, setDeleting] = useState<BnplAccount | null>(null);

  // The delete dialog names the count so the consequence of each option is
  // concrete. Read from the shared bill list rather than a dedicated endpoint —
  // the page already needs those rows in Task 8.
  const { data: allBills } = api.bill.getAll.useQuery();
  const deletingPurchaseCount = deleting
    ? (allBills ?? []).filter((b) => b.bnplAccountId === deleting._id).length
    : 0;

  const invalidate = () =>
    Promise.all([
      utils.bnpl.getAll.invalidate(),
      utils.bill.getAll.invalidate(),
      utils.payment.getAll.invalidate(),
    ]);

  const createMut = api.bnpl.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Account created");
      setCreateOpen(false);
    },
    onError: (e) => toast.error(e.message || "Failed to create account"),
  });

  const updateMut = api.bnpl.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Account updated");
      setEditing(null);
    },
    onError: (e) => toast.error(e.message || "Failed to update account"),
  });

  const deleteMut = api.bnpl.delete.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Account deleted");
      setDeleting(null);
    },
    onError: (e) => toast.error(e.message || "Failed to delete account"),
  });

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-ledger-ink font-display text-xl">BNPL</h1>
          {accounts && accounts.length > 0 && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              New Account <Plus className="ml-1 size-4" />
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-3xl" />
            ))}
          </div>
        ) : !accounts || accounts.length === 0 ? (
          <EmptyState onAdd={() => setCreateOpen(true)} />
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <div
                key={account._id}
                className="border-border/40 bg-card flex items-center justify-between rounded-3xl border p-5"
              >
                <div>
                  <p className="text-foreground font-semibold">
                    {account.name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Due day {account.dueDay}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Edit account"
                    onClick={() => setEditing(account)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete account"
                    onClick={() => setDeleting(account)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BnplAccountFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(values) => createMut.mutate(values)}
        isPending={createMut.isPending}
      />

      <BnplAccountFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        account={editing ?? undefined}
        onSubmit={(values) => {
          if (!editing) return;
          updateMut.mutate({ id: editing._id, data: values });
        }}
        isPending={updateMut.isPending}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingPurchaseCount === 0
                ? "This account has no purchases."
                : `This account has ${deletingPurchaseCount} purchase${
                    deletingPurchaseCount === 1 ? "" : "s"
                  }. Choose what happens to them.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* Two outcomes rather than one default: deleting destroys purchase
              and payment history, while keeping destroys nothing and only puts
              those rows back in the bill list. Neither is obviously right, so
              the choice is made here, in view of the count. */}
          <AlertDialogFooter className="sm:flex-col sm:gap-2">
            <AlertDialogAction
              className="w-full"
              onClick={(e) => {
                e.preventDefault();
                if (deleting)
                  deleteMut.mutate({ id: deleting._id, purchases: "keep" });
              }}
              disabled={deleteMut.isPending || deletingPurchaseCount === 0}
            >
              Keep purchases as ordinary bills
            </AlertDialogAction>
            <AlertDialogAction
              className="w-full"
              onClick={(e) => {
                e.preventDefault();
                if (deleting)
                  deleteMut.mutate({ id: deleting._id, purchases: "delete" });
              }}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending && (
                <Loader2 className="mr-1 size-4 animate-spin" />
              )}
              {deletingPurchaseCount === 0
                ? "Delete account"
                : "Delete purchases too"}
            </AlertDialogAction>
            <AlertDialogCancel className="w-full" disabled={deleteMut.isPending}>
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AuthenticatedLayout>
  );
}
```

- [ ] **Step 4: Create the page**

Create `src/app/bnpl/page.tsx`, mirroring `src/app/groups/page.tsx`:

```tsx
import { BnplManager } from "~/components/bnplManager";

export const dynamic = "force-dynamic";

export default function BnplPage() {
  return <BnplManager />;
}
```

- [ ] **Step 5: Typecheck and lint**

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/app/bnpl/page.tsx src/components/bnplManager.tsx src/components/bnplAccountFormDialog.tsx src/components/authenticatedLayout.tsx
```

- [ ] **Step 6: Verify in the running app**

Run `pnpm dev`, sign in, and confirm:
1. **BNPL** appears in the nav and `/bnpl` loads.
2. With no accounts, the empty state shows and its button opens the dialog.
3. Creating an account named `SPayLater` with due day `15` lists it as "Due day 15".
4. Editing the name and due day persists after a reload.
5. Deleting an account with no purchases offers only "Delete account" and
   removes it; "Keep purchases as ordinary bills" is disabled.

- [ ] **Step 7: Commit**

```bash
git add src/app/bnpl src/components/bnplManager.tsx src/components/bnplAccountFormDialog.tsx src/components/authenticatedLayout.tsx
git commit -m "feat: add /bnpl page with account CRUD (#44)"
```

---

## Task 8: Account card — purchases, statement, paid toggle

**Files:**
- Create: `src/components/bnplAccountCard.tsx`
- Create: `src/components/bnplPurchaseFormDialog.tsx`
- Modify: `src/components/bnplManager.tsx`

**Interfaces:**
- Consumes: `partitionBills` (Task 2), `groupStatements` + `installmentProgress` (Task 3), `bnpl.createPurchase` / `updatePurchase` / `deletePurchase` (Task 5), `payment.markStatementPaid` / `markStatementUnpaid` (Task 6), `computeBillsInPeriod` from `~/lib/bill-utils`.
- Produces: `<BnplAccountCard account purchases statements paidKeys ... />`, replacing the placeholder row in `BnplManager`.

- [ ] **Step 1: Create the purchase form dialog**

Create `src/components/bnplPurchaseFormDialog.tsx`. The month field uses a native `<input type="month">`, whose value is `"yyyy-MM"`; parsing it as `new Date("2026-09")` yields UTC midnight on the 1st, which is exactly the canonical frame the server expects.

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { formatUtcDate } from "~/lib/date-utils";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";

const PurchaseFormSchema = z.object({
  title: z.string().trim().min(1, { message: "Title is required" }),
  amount: z.coerce.number().min(1, { message: "Amount is required" }),
  tenureMonths: z.coerce.number().int().min(1).max(60),
  firstDueMonth: z.date(),
});

export type PurchaseFormValues = z.infer<typeof PurchaseFormSchema>;

/** `"yyyy-MM"` → UTC midnight on the 1st, or undefined when cleared/invalid. */
function monthInputToUtc(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}-01`);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

export function BnplPurchaseFormDialog({
  open,
  onOpenChange,
  accountName,
  initialValues,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountName: string;
  initialValues?: PurchaseFormValues;
  onSubmit: (values: PurchaseFormValues) => void;
  isPending: boolean;
}) {
  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(PurchaseFormSchema),
    defaultValues: {
      title: "",
      amount: 0,
      tenureMonths: 6,
      firstDueMonth: new Date(
        Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
      ),
    },
  });

  useEffect(() => {
    if (!open) return;
    if (initialValues) form.reset(initialValues);
  }, [open, initialValues, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initialValues ? "Edit purchase" : "New purchase"}
          </DialogTitle>
          <DialogDescription>
            Billed on {accountName}&apos;s monthly statement.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            id="bnpl-purchase-form"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item</FormLabel>
                  <FormControl>
                    <Input placeholder="Airpods" {...field} />
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
                  <FormLabel>Monthly installment</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tenureMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Months</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={60} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="firstDueMonth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First statement month</FormLabel>
                  <FormControl>
                    <Input
                      type="month"
                      value={
                        field.value ? formatUtcDate(field.value, "yyyy-MM") : ""
                      }
                      onChange={(e) =>
                        field.onChange(monthInputToUtc(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    The day comes from the account&apos;s due day.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form="bnpl-purchase-form" disabled={isPending}>
            {isPending && <Loader2 className="mr-1 size-4 animate-spin" />}
            {initialValues ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create the account card**

Create `src/components/bnplAccountCard.tsx`:

```tsx
"use client";

import {
  Circle,
  CircleCheckBig,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { installmentProgress, type Statement } from "~/lib/bnpl-utils";
import { formatUtcDate } from "~/lib/date-utils";
import { cn } from "~/lib/utils";
import type { BillEvent, BnplAccount } from "~/types";
import { Button } from "./ui/button";

function formatPHP(value: number) {
  return value.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

export function BnplAccountCard({
  account,
  purchases,
  statement,
  isStatementPaid,
  isStatementPending,
  onToggleStatementPaid,
  onEditAccount,
  onDeleteAccount,
  onAddPurchase,
  onEditPurchase,
  onDeletePurchase,
}: {
  account: BnplAccount;
  purchases: BillEvent[];
  statement: Statement | null;
  isStatementPaid: boolean;
  isStatementPending: boolean;
  onToggleStatementPaid: () => void;
  onEditAccount: () => void;
  onDeleteAccount: () => void;
  onAddPurchase: () => void;
  onEditPurchase: (purchase: BillEvent) => void;
  onDeletePurchase: (purchase: BillEvent) => void;
}) {
  return (
    <div className="border-border/40 bg-card flex flex-col overflow-hidden rounded-3xl border">
      <div className="flex items-start justify-between px-5 pt-5 pb-3">
        <div>
          <p className="text-foreground font-semibold">{account.name}</p>
          <p className="text-muted-foreground font-mono text-xs tabular-nums">
            Due day {account.dueDay}
          </p>
          {statement ? (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className={cn(
                  "shrink-0 transition-colors disabled:opacity-50",
                  isStatementPaid
                    ? "text-ledger-accent-strong dark:text-ledger-accent"
                    : "text-muted-foreground/50 hover:text-muted-foreground",
                )}
                onClick={onToggleStatementPaid}
                disabled={isStatementPending}
                aria-label={
                  isStatementPaid ? "Mark statement unpaid" : "Mark statement paid"
                }
                aria-pressed={isStatementPaid}
              >
                {isStatementPaid ? (
                  <CircleCheckBig className="size-4" />
                ) : (
                  <Circle className="size-4" />
                )}
              </button>
              <span
                className={cn(
                  "font-mono text-2xl font-semibold tracking-tight tabular-nums",
                  isStatementPaid && "line-through opacity-50",
                )}
              >
                {formatPHP(statement.amount)}
              </span>
              <span className="text-muted-foreground text-xs">
                due {formatUtcDate(statement.date, "MMM d")}
              </span>
            </div>
          ) : (
            <p className="text-muted-foreground mt-3 text-sm">
              Nothing due — no active purchases.
            </p>
          )}
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Edit account"
            onClick={onEditAccount}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete account"
            onClick={onDeleteAccount}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="px-5 pb-5">
        <ul className="divide-border/40 divide-y">
          {purchases.map((purchase) => {
            if (purchase.type !== "recurring") return null;
            const { elapsed, total } = installmentProgress(
              purchase.recurrence.dtstart,
              purchase.recurrence.count,
              statement?.date ?? new Date(),
            );
            const isDone = elapsed >= total;

            return (
              <li
                key={purchase._id}
                className={cn(
                  "flex items-center gap-3 py-2",
                  isDone && "opacity-50",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {purchase.title}
                  </div>
                  <div className="text-muted-foreground font-mono text-[11px] tabular-nums">
                    {isDone ? "Done" : `${elapsed} of ${total}`}
                  </div>
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-sm font-semibold tabular-nums">
                  {formatPHP(purchase.amount ?? 0)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Edit purchase"
                  onClick={() => onEditPurchase(purchase)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete purchase"
                  onClick={() => onDeletePurchase(purchase)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onAddPurchase}
        >
          Add purchase <Plus className="ml-1 size-4" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire the card into the manager**

In `src/components/bnplManager.tsx`, replace the placeholder account row with `<BnplAccountCard />` and add the derived data. Add these imports:

```tsx
import { addMonths } from "date-fns";
import { useMemo, useState } from "react";
import { computeBillsInPeriod, partitionBills } from "~/lib/bill-utils";
import { groupStatements } from "~/lib/bnpl-utils";
import { localDateToUtcDateOnly } from "~/lib/date-utils";
import { buildPaidLookup, occurrenceKey } from "~/lib/payment-utils";
import type { BillEvent } from "~/types";
import { BnplAccountCard } from "./bnplAccountCard";
import {
  BnplPurchaseFormDialog,
  type PurchaseFormValues,
} from "./bnplPurchaseFormDialog";
```

Add the queries and derivations inside `BnplManager`, after the existing
`accounts` query. Note `allBills` already exists from Task 7 — reuse it rather
than declaring a second variable for the same query:

```tsx
  const { data: payments } = api.payment.getAll.useQuery();

  const paidKeys = useMemo(() => buildPaidLookup(payments ?? []), [payments]);

  // Statements are read off the same occurrence generator the dashboard uses,
  // rather than re-deriving dates here — one scheduler, one set of clamping
  // rules. A 14-month window is enough to always contain the next statement.
  const { purchasesByAccount, statementByAccount } = useMemo(() => {
    const { installments } = partitionBills(allBills ?? []);
    // Already UTC midnight — localDateToUtcDateOnly maps today's local
    // calendar day onto the canonical frame the scheduler anchors on.
    const windowStart = localDateToUtcDateOnly(new Date());
    const occurrences = computeBillsInPeriod(
      installments,
      windowStart,
      addMonths(windowStart, 14),
    );
    const statements = groupStatements(occurrences, accounts ?? []);

    const purchasesByAccount = new Map<string, BillEvent[]>();
    for (const purchase of installments) {
      if (!purchase.bnplAccountId) continue;
      const list = purchasesByAccount.get(purchase.bnplAccountId) ?? [];
      list.push(purchase);
      purchasesByAccount.set(purchase.bnplAccountId, list);
    }

    // The first statement per account is the current one, since groupStatements
    // sorts by date and the window starts today.
    const statementByAccount = new Map<string, (typeof statements)[number]>();
    for (const statement of statements) {
      if (!statementByAccount.has(statement.accountId)) {
        statementByAccount.set(statement.accountId, statement);
      }
    }

    return { purchasesByAccount, statementByAccount };
  }, [allBills, accounts]);
```

Add the purchase and statement mutations alongside the existing account mutations:

```tsx
  const [purchaseTarget, setPurchaseTarget] = useState<{
    account: BnplAccount;
    purchase?: BillEvent;
  } | null>(null);
  const [deletingPurchase, setDeletingPurchase] = useState<BillEvent | null>(
    null,
  );
  const [pendingStatements, setPendingStatements] = useState<Set<string>>(
    new Set(),
  );

  const createPurchaseMut = api.bnpl.createPurchase.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Purchase added");
      setPurchaseTarget(null);
    },
    onError: (e) => toast.error(e.message || "Failed to add purchase"),
  });

  const updatePurchaseMut = api.bnpl.updatePurchase.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Purchase updated");
      setPurchaseTarget(null);
    },
    onError: (e) => toast.error(e.message || "Failed to update purchase"),
  });

  const deletePurchaseMut = api.bnpl.deletePurchase.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Purchase deleted");
      setDeletingPurchase(null);
    },
    onError: (e) => toast.error(e.message || "Failed to delete purchase"),
  });

  const markStatementPaid = api.payment.markStatementPaid.useMutation();
  const markStatementUnpaid = api.payment.markStatementUnpaid.useMutation();

  // A statement is paid only when every purchase on it is paid, so a purchase
  // added after settling correctly flips it back to unpaid.
  const isStatementPaid = (statement: Statement) =>
    statement.billIds.every((billId) =>
      paidKeys.has(occurrenceKey(billId, statement.date)),
    );

  const handleToggleStatement = (statement: Statement) => {
    const key = `${statement.accountId}:${statement.date.getTime()}`;
    const currentlyPaid = isStatementPaid(statement);
    setPendingStatements((prev) => new Set(prev).add(key));
    const clearPending = () =>
      setPendingStatements((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });

    const mutation = currentlyPaid ? markStatementUnpaid : markStatementPaid;
    mutation.mutate(
      {
        accountId: statement.accountId,
        statementDate: statement.date,
        billIds: statement.billIds,
      },
      {
        onSuccess: () =>
          void utils.payment.getAll.invalidate().finally(clearPending),
        onError: (error) => {
          toast.error(error.message || "Failed to update statement");
          clearPending();
        },
      },
    );
  };
```

Import `Statement` as a type alongside `groupStatements`:

```tsx
import { groupStatements, type Statement } from "~/lib/bnpl-utils";
```

Replace the placeholder `<div key={account._id} …>` block with:

```tsx
            {accounts.map((account) => {
              const statement = statementByAccount.get(account._id) ?? null;
              const statementKey = statement
                ? `${statement.accountId}:${statement.date.getTime()}`
                : "";

              return (
                <BnplAccountCard
                  key={account._id}
                  account={account}
                  purchases={purchasesByAccount.get(account._id) ?? []}
                  statement={statement}
                  isStatementPaid={statement ? isStatementPaid(statement) : false}
                  isStatementPending={pendingStatements.has(statementKey)}
                  onToggleStatementPaid={() =>
                    statement && handleToggleStatement(statement)
                  }
                  onEditAccount={() => setEditing(account)}
                  onDeleteAccount={() => setDeleting(account)}
                  onAddPurchase={() => setPurchaseTarget({ account })}
                  onEditPurchase={(purchase) =>
                    setPurchaseTarget({ account, purchase })
                  }
                  onDeletePurchase={setDeletingPurchase}
                />
              );
            })}
```

Add the purchase dialog and its delete confirmation next to the account dialogs:

```tsx
      <BnplPurchaseFormDialog
        open={purchaseTarget !== null}
        onOpenChange={(open) => !open && setPurchaseTarget(null)}
        accountName={purchaseTarget?.account.name ?? ""}
        initialValues={
          purchaseTarget?.purchase &&
          purchaseTarget.purchase.type === "recurring"
            ? {
                title: purchaseTarget.purchase.title,
                amount: purchaseTarget.purchase.amount ?? 0,
                tenureMonths: purchaseTarget.purchase.recurrence.count ?? 1,
                firstDueMonth: purchaseTarget.purchase.recurrence.dtstart,
              }
            : undefined
        }
        onSubmit={(values: PurchaseFormValues) => {
          if (!purchaseTarget) return;
          if (purchaseTarget.purchase) {
            updatePurchaseMut.mutate({
              id: purchaseTarget.purchase._id,
              data: values,
            });
          } else {
            createPurchaseMut.mutate({
              accountId: purchaseTarget.account._id,
              ...values,
            });
          }
        }}
        isPending={createPurchaseMut.isPending || updatePurchaseMut.isPending}
      />

      <AlertDialog
        open={deletingPurchase !== null}
        onOpenChange={(open) => !open && setDeletingPurchase(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deletingPurchase?.title}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the purchase and its payment history. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePurchaseMut.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deletingPurchase)
                  deletePurchaseMut.mutate({ id: deletingPurchase._id });
              }}
              disabled={deletePurchaseMut.isPending}
            >
              {deletePurchaseMut.isPending && (
                <Loader2 className="mr-1 size-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
```

- [ ] **Step 4: Typecheck and lint**

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/components/bnplAccountCard.tsx src/components/bnplPurchaseFormDialog.tsx src/components/bnplManager.tsx
```

- [ ] **Step 5: Verify in the running app**

With `pnpm dev`, on `/bnpl`:
1. Add a purchase: `Airpods`, `1250`, `6` months, this month. The card's statement shows `₱1,250` due on the account's due day.
2. Add a second purchase `Fan`, `700`, `3` months, same month. The statement becomes `₱1,950` — one line, not two.
3. Mark the statement paid: the amount strikes through, both purchases count as paid.
4. Add a third purchase in the same month — the statement flips back to unpaid (expected).
5. Edit the **account's** due day from 15 to 20 and reload: the statement date moves to the 20th and stays a *single* statement.
6. Set the due day to 31 and add a purchase whose first month is February: the statement lands on Feb 28.
7. Delete a purchase, confirming its dialog.
8. Delete the account choosing **Keep purchases as ordinary bills** — the
   account disappears and its purchases now show as individual rows on
   `/dashboard`, with any paid state preserved.
9. Recreate an account with a purchase and delete it choosing **Delete purchases
   too** — both the account and its purchases are gone from `/bnpl` and
   `/dashboard`.

- [ ] **Step 6: Commit**

```bash
git add src/components/bnplAccountCard.tsx src/components/bnplPurchaseFormDialog.tsx src/components/bnplManager.tsx
git commit -m "feat: manage BNPL purchases and settle statements on /bnpl (#44)"
```

---

## Task 9: Roll-up rows in the pay-period bill list

**Files:**
- Modify: `src/app/_components/billList.tsx`

**Interfaces:**
- Consumes: `partitionBills` (Task 2), `groupStatements` + `Statement` (Task 3), `bnpl.getAll` (Task 4).
- Produces: no new exports.

- [ ] **Step 1: Add the account query and imports**

In `src/app/_components/billList.tsx`, add to the imports:

```tsx
import { getPayPeriodsByCount, partitionBills } from "~/lib/bill-utils";
import { groupStatements } from "~/lib/bnpl-utils";
import type { BillEvent, BnplAccount, Group } from "~/types";
```

In `BillList`, add the query and pass accounts down:

```tsx
  const { data: accounts } = api.bnpl.getAll.useQuery();
```

Extend the loading guard so accounts are present before rendering:

```tsx
  if (!incomeProfile || !bills || !groups || !accounts) return null;
```

Pass `accounts={accounts}` to each `<BillListCard />`.

- [ ] **Step 2: Render the roll-up rows**

In `BillListCard`, accept `accounts: BnplAccount[]` in its props, then split the rows and compute statements:

```tsx
  const { bills: ordinaryBills, installments } = useMemo(
    () => partitionBills(bills),
    [bills],
  );

  const sections = useMemo(
    () => buildSections(ordinaryBills, groups),
    [ordinaryBills, groups],
  );

  const statements = useMemo(
    () => groupStatements(installments, accounts),
    [installments, accounts],
  );
```

`outgoing` must keep summing **all** rows — installments included — so the balance stays an honest projection:

```tsx
  // Installments are counted here but itemized as one roll-up row per account
  // below, so section subtotals plus statement amounts still equal `outgoing`.
  const outgoing = useMemo(
    () =>
      sumBy(
        bills.filter((bill) => !excludedBills.includes(bill._id)),
        (bill) => bill.amount ?? 0,
      ),
    [bills, excludedBills],
  );
```

Replace the `bills.length === 0` empty-state condition with one that accounts for statements:

```tsx
        {ordinaryBills.length === 0 && statements.length === 0 ? (
```

Then render the statement rows after the `sections.map(...)` block, inside the same `space-y-5` container:

```tsx
            {statements.map((statement, idx) => (
              <div
                key={`${statement.accountId}:${statement.date.getTime()}`}
                className={cn(
                  (sections.length > 0 || idx > 0) &&
                    "border-border/40 border-t pt-5",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="text-foreground text-sm font-semibold">
                      {statement.accountName}
                    </span>
                    <span className="bg-muted/60 text-muted-foreground ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                      {statement.purchaseCount}
                    </span>
                    <span className="text-muted-foreground ml-1 font-mono text-[11px] tabular-nums">
                      {formatUtcDate(statement.date, "MMM d")}
                    </span>
                  </div>
                  <span className="w-24 text-right font-mono text-sm font-medium tracking-tight tabular-nums">
                    {formatPHP(statement.amount)}
                  </span>
                </div>
              </div>
            ))}
```

Add `CreditCard` to the `lucide-react` import.

- [ ] **Step 3: Typecheck and lint**

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/app/_components/billList.tsx
```

- [ ] **Step 4: Verify in the running app**

On `/dashboard`, with at least one ordinary bill and two BNPL purchases on the same account:
1. The purchases do **not** appear as individual rows.
2. One roll-up row shows the account name, purchase count, statement date, and summed amount.
3. Section subtotals plus the roll-up amount equal the card's "going out" figure.
4. A second account with a purchase in the same period produces a second roll-up row.
5. A period with only a statement and no ordinary bills shows the roll-up, not "Nothing due this period".

- [ ] **Step 5: Commit**

```bash
git add src/app/_components/billList.tsx
git commit -m "feat: show BNPL statements as roll-up rows in the bill list (#44)"
```

---

## Task 10: Summary cards and playground cloning

**Files:**
- Modify: `src/components/financialSummaryCards.tsx`
- Modify: `src/components/playgroundStartScreen.tsx:31`

**Interfaces:**
- Consumes: `partitionBills` (Task 2), `groupStatements` (Task 3), `bnpl.getAll` (Task 4).
- Produces: no new exports.

- [ ] **Step 1: Partition in the summary cards**

In `src/components/financialSummaryCards.tsx`, add to the imports:

```tsx
import {
  computeBillsInPeriod,
  createPayRule,
  partitionBills,
} from "~/lib/bill-utils";
import { groupStatements } from "~/lib/bnpl-utils";
```

Add the accounts query beside the payments query:

```tsx
  const { data: accounts } = api.bnpl.getAll.useQuery();
```

Rework the `useMemo` so "Total Bills" and "Next Bill" treat a statement as one item while "Remaining" keeps counting the money. Replace the existing `remaining`/`nextBill` computation with:

```tsx
  const { remaining, nextItem, billCount } = useMemo(() => {
    const payRule = createPayRule(incomeProfile);
    const currentPay = payRule.before(localDateToUtcDateOnly(new Date()), true);
    if (!currentPay) return { remaining: 0, nextItem: null, billCount: 0 };

    const nextPayDate = payRule.after(currentPay);
    if (!nextPayDate) return { remaining: 0, nextItem: null, billCount: 0 };

    const periodRows = computeBillsInPeriod(bills, currentPay, nextPayDate);
    const { bills: ordinaryRows, installments } = partitionBills(periodRows);
    const statements = groupStatements(installments, accounts ?? []);

    // Remaining counts every unpaid peso, installments included — a statement
    // is unpaid until all of its purchases are.
    const remainingBills = sumBy(ordinaryRows, (b) =>
      isOccurrencePaid(paidKeys, b._id, b.date) ? 0 : (b.amount ?? 0),
    );
    const remainingStatements = sumBy(statements, (s) =>
      s.billIds.every((id) => isOccurrencePaid(paidKeys, id, s.date))
        ? 0
        : s.amount,
    );

    // "Total Bills" counts a statement as one obligation, not N purchases —
    // one payment is what the user actually makes.
    const { bills: ordinaryAll, installments: installmentsAll } =
      partitionBills(bills);
    const accountsWithPurchases = new Set(
      installmentsAll.map((b) => b.bnplAccountId),
    );

    // Nearest upcoming unpaid obligation of either kind.
    const today = startOfDay(new Date());
    const upcomingBill = ordinaryRows.find(
      (b) =>
        utcDateOnlyToLocal(b.date) >= today &&
        !isOccurrencePaid(paidKeys, b._id, b.date),
    );
    const upcomingStatement = statements.find(
      (s) =>
        utcDateOnlyToLocal(s.date) >= today &&
        !s.billIds.every((id) => isOccurrencePaid(paidKeys, id, s.date)),
    );

    const candidates: Array<{ title: string; date: Date }> = [];
    if (upcomingBill)
      candidates.push({ title: upcomingBill.title, date: upcomingBill.date });
    if (upcomingStatement)
      candidates.push({
        title: upcomingStatement.accountName,
        date: upcomingStatement.date,
      });
    candidates.sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      remaining: remainingBills + remainingStatements,
      nextItem: candidates[0] ?? null,
      billCount: ordinaryAll.length + accountsWithPurchases.size,
    };
  }, [incomeProfile, bills, paidKeys, accounts]);
```

Update the two affected cards:

```tsx
    {
      icon: FileText,
      label: "Total Bills",
      value: billCount.toString(),
      subtitle: "Active bills",
      mono: true,
    },
```

```tsx
    {
      icon: CalendarClock,
      label: "Next Bill",
      value: nextItem?.title ?? "None",
      subtitle: nextItem
        ? formatUtcDate(nextItem.date, "MMM dd, yyyy")
        : "No upcoming bills",
      mono: false,
    },
```

- [ ] **Step 2: Keep purchases out of the playground**

In `src/components/playgroundStartScreen.tsx`, add the import:

```tsx
import { partitionBills } from "~/lib/bill-utils";
```

Change `handleCloneBills` so only ordinary bills are cloned. A purchase is a structurally valid recurring bill, so it would clone perfectly and reappear as individual rows in the one surface the design put out of scope:

```tsx
  const handleCloneBills = () => {
    const { bills: ordinaryBills } = partitionBills(bills ?? []);
    dispatch({ type: "INIT_CLONE", incomeProfile, bills: ordinaryBills });
  };
```

- [ ] **Step 3: Typecheck and lint**

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/components/financialSummaryCards.tsx src/components/playgroundStartScreen.tsx
```

- [ ] **Step 4: Run the full test suite**

Run: `pnpm test`
Expected: PASS — all tests from Tasks 1–3.

- [ ] **Step 5: Verify in the running app**

1. With 2 ordinary bills and 3 purchases on one account, "Total Bills" reads **3** (2 bills + 1 account), not 5.
2. "Remaining" drops by the statement amount when the statement is marked paid on `/bnpl`.
3. "Next Bill" names the account when its statement is the soonest unpaid obligation.
4. `/playground` → "clone my bills" brings in the ordinary bills only; no installments appear.
5. `/dashboard` with only BNPL purchases and no ordinary bills still shows the period cards (not "No bills yet"), each with its roll-up row.

- [ ] **Step 6: Commit**

```bash
git add src/components/financialSummaryCards.tsx src/components/playgroundStartScreen.tsx
git commit -m "feat: count BNPL statements in summary cards, exclude from playground (#44)"
```

---

## Done criteria

- `pnpm test` passes; `pnpm exec tsc --noEmit` and `pnpm exec eslint src` are clean.
- `/bnpl` creates accounts and purchases, shows one statement per account, and settles it with one toggle.
- An account's installments never appear as individual rows in the pay-period list; each account contributes one dated roll-up row whose amount is included in that period's "going out".
- Section subtotals plus roll-up amounts equal each period card's outgoing total.
- Changing an account's due day moves every existing purchase, leaving exactly one statement per month.
- Deleting an account offers both outcomes: "delete purchases too" removes them and their paid-markers; "keep as ordinary bills" leaves them in the bill list with their paid history intact.
- No file in `src/` contains the string "Shopee" or "SPayLater" outside of placeholder/example copy.
