# Mark Bill Occurrences as Paid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user mark each occurrence of a bill paid/unpaid, so the dashboard's remaining balance reflects only what's still owed, persisted per occurrence.

**Architecture:** Occurrences are generated client-side from recurrence rules, so paid-state is a sparse `payments` collection keyed by `(userId, billId, occurrenceDate)`, joined to generated occurrences in memory via a `Set` of composite keys. A row checkbox fires idempotent `markPaid`/`markUnpaid` tRPC mutations; a paid occurrence is treated exactly like an existing *excluded* row in every money sum.

**Tech Stack:** Next.js 16 (App Router), tRPC 11 + SuperJSON, MongoDB native driver, TanStack React Query, Tailwind 4, lucide-react, sonner.

**Design spec:** `docs/superpowers/specs/2026-07-04-mark-bill-occurrences-paid-design.md`

## Global Constraints

- **No test framework** (CLAUDE.md). Per-task verification = `pnpm typecheck` + `node_modules/.bin/eslint <changed files>` + (UI tasks) `SKIP_ENV_VALIDATION=1 pnpm build` + live-browser check.
- **`next lint` / `pnpm lint` are broken under Next 16.** Lint changed files with `node_modules/.bin/eslint <path> …` directly; typecheck with `pnpm typecheck`.
- **Commits are SSH-signed via the 1Password agent.** If a commit fails with `1Password: failed to fill whole buffer`, the agent is locked — commit with `--no-gpg-sign` and note it's unsigned.
- **Every commit message ends with:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **Date-only values are UTC-midnight instants** (see `src/lib/date-utils.ts`). The payment occurrence-key must stay in that frame.
- **Path alias:** `~/` → `src/`.
- **Branch:** `feat/mark-bill-occurrences-paid`. It already carries **uncommitted scaffolding** for Tasks 1–2 (the data model, `paymentRouter`, and `payment-utils.ts` join module). Those tasks finalize and commit that scaffolding.

---

### Task 1: Server foundation — `payments` collection, `paymentRouter`, `Payment` type

**Files:**
- Create: `src/server/api/routers/payment.ts` (already scaffolded on branch)
- Modify: `src/server/api/root.ts` (already wired on branch)
- Modify: `src/types/index.ts` (already added on branch)

**Interfaces:**
- Produces: tRPC `payment` router with `getAll(): Payment[]`, `markPaid({ billId: string, occurrenceDate: Date }): void`, `markUnpaid({ billId: string, occurrenceDate: Date }): void`.
- Produces: `interface Payment { _id: string; userId: string; billId: string; occurrenceDate: Date; amountPaid?: number; paidAt: Date }` in `~/types`.

- [ ] **Step 1: Apply the `deleteOne` → `deleteMany` fix in `markUnpaid`**

In `src/server/api/routers/payment.ts`, the `markUnpaid` mutation must delete **all** matching rows (self-heals any duplicate created by a concurrent upsert race). Ensure the body reads:

```ts
markUnpaid: protectedProcedure
  .input(z.object({ billId: z.string(), occurrenceDate: z.date() }))
  .mutation(async ({ ctx, input }) => {
    const billOid = await assertBillOwned(ctx, input.billId);

    await ctx.db.collection<PaymentDoc>("payments").deleteMany({
      userId: new ObjectId(ctx.session.user.id),
      billId: billOid,
      occurrenceDate: toOccurrenceKey(input.occurrenceDate),
    });
  }),
```

Confirm `src/server/api/root.ts` imports `paymentRouter` and registers it as `payment`, and `src/types/index.ts` exports the `Payment` interface above.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Lint the changed files**

Run: `node_modules/.bin/eslint src/server/api/routers/payment.ts src/server/api/root.ts src/types/index.ts`
Expected: no errors or warnings.

- [ ] **Step 4: Commit**

```bash
git add src/server/api/routers/payment.ts src/server/api/root.ts src/types/index.ts
git commit -m "feat: add payments collection and paymentRouter (#34)

New payment router with getAll/markPaid/markUnpaid over a sparse
payments collection keyed by (userId, billId, occurrenceDate).
markUnpaid uses deleteMany to self-heal any upsert-race duplicate.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Client join module — `payment-utils.ts`

**Files:**
- Create: `src/lib/payment-utils.ts` (already scaffolded on branch; `occurrenceKey` body is a stub that throws)

**Interfaces:**
- Consumes: `Payment` from `~/types`.
- Produces:
  - `occurrenceKey(billId: string, occurrenceDate: Date): string`
  - `buildPaidLookup(payments: Payment[]): Set<string>`
  - `isOccurrencePaid(paidKeys: Set<string>, billId: string, occurrenceDate: Date): boolean`

- [ ] **Step 1: Implement `occurrenceKey`**

Replace the stubbed body (the `throw`) in `src/lib/payment-utils.ts` with the timezone-stable encoding. `getTime()` is the UTC-based epoch, so the key matches whether it came from a generated occurrence or a stored payment:

```ts
export function occurrenceKey(billId: string, occurrenceDate: Date): string {
  return `${billId}:${occurrenceDate.getTime()}`;
}
```

Leave `buildPaidLookup` and `isOccurrencePaid` as scaffolded.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `node_modules/.bin/eslint src/lib/payment-utils.ts`
Expected: no errors or warnings.

> **Note:** No unit test — there is no test runner. `occurrenceKey`'s correctness (a paid marker lining up with its generated occurrence) is exercised end-to-end by the live check in Task 3 (mark paid → reload → still shows paid means the stored key matched the regenerated occurrence).

- [ ] **Step 4: Commit**

```bash
git add src/lib/payment-utils.ts
git commit -m "feat: add occurrence/payment join helpers (#34)

Timezone-stable (billId, occurrenceDate) key via getTime(), plus a
Set-based paid lookup for joining generated occurrences to payments.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Bill-list UI — paid checkbox, styling, money math, mutations

**Files:**
- Modify: `src/app/_components/billList.tsx`

**Interfaces:**
- Consumes: `api.payment.getAll` / `markPaid` / `markUnpaid`; `buildPaidLookup`, `isOccurrencePaid`, `occurrenceKey` from `~/lib/payment-utils`.
- Produces: no exported API change (`BillList` still takes no props).

- [ ] **Step 1: Add imports**

In `src/app/_components/billList.tsx`, extend the lucide import and add sonner + payment-utils:

```tsx
import { Circle, CircleCheckBig, EyeClosedIcon, EyeIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  buildPaidLookup,
  isOccurrencePaid,
  occurrenceKey,
} from "~/lib/payment-utils";
```

(Replace the existing `import { EyeClosedIcon, EyeIcon, Sparkles } from "lucide-react";` line.)

- [ ] **Step 2: Extend `BillRowItem` with paid props and rendering**

Replace the `BillRowItem` component with this version (adds the paid toggle button, dims the row when paid, strikes the amount; the existing eye/exclude toggle is unchanged):

```tsx
function BillRowItem({
  bill,
  payDate,
  isExcluded,
  isPaid,
  isPaidPending,
  onClick,
  onToggleExclude,
  onTogglePaid,
}: {
  bill: BillRow;
  payDate: Date;
  isExcluded: boolean;
  isPaid: boolean;
  isPaidPending: boolean;
  onClick: () => void;
  onToggleExclude: () => void;
  onTogglePaid: () => void;
}) {
  const isDue = isSameDay(bill.date, payDate);

  return (
    <li
      className={cn(
        "group hover:bg-ledger-accent-soft/60 dark:hover:bg-ledger-accent/10 relative -mx-2 flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors",
        (isExcluded || isPaid) && "opacity-40",
      )}
      onClick={onClick}
    >
      {/* Paid toggle — persistent settled state. Always visible; disabled
          while its mutation is in flight. */}
      <button
        type="button"
        className={cn(
          "shrink-0 transition-colors disabled:opacity-50",
          isPaid
            ? "text-ledger-accent-strong dark:text-ledger-accent"
            : "text-muted-foreground/50 hover:text-muted-foreground",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePaid();
        }}
        disabled={isPaidPending}
        aria-label={isPaid ? "Mark unpaid" : "Mark paid"}
        aria-pressed={isPaid}
      >
        {isPaid ? (
          <CircleCheckBig className="size-4" />
        ) : (
          <Circle className="size-4" />
        )}
      </button>

      {/* Eye toggle — transient exclude (planning). Always visible when
          excluded. Otherwise visible by default (reachable on touch), and
          reveal-on-hover only on devices that support hover. */}
      <button
        type="button"
        className={cn(
          "shrink-0 transition-all",
          isExcluded
            ? "text-muted-foreground/60 opacity-100"
            : "text-muted-foreground/60 hover:text-muted-foreground opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onToggleExclude();
        }}
        aria-label={isExcluded ? "Include bill" : "Exclude bill"}
      >
        {isExcluded ? (
          <EyeClosedIcon className="size-3.5" />
        ) : (
          <EyeIcon className="size-3.5" />
        )}
      </button>

      {/* Title + date */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{bill.title}</div>
        {!isExcluded && (
          <div
            className={cn(
              "font-mono text-[11px] tabular-nums",
              isDue
                ? "text-ledger-accent-strong dark:text-ledger-accent"
                : "text-muted-foreground",
            )}
          >
            {isDue && (
              <span className="bg-ledger-accent mr-1 inline-block size-2 rounded-full align-middle opacity-80" />
            )}
            {formatUtcDate(bill.date, "MMM d")}
          </div>
        )}
      </div>

      {/* Amount — struck through when paid */}
      <span
        className={cn(
          "w-24 shrink-0 text-right font-mono text-sm font-semibold tracking-tight tabular-nums",
          isPaid && "line-through",
        )}
      >
        {!isExcluded ? (
          bill.amount != null ? (
            formatPHP(bill.amount)
          ) : (
            <span className="text-muted-foreground text-xs font-normal">—</span>
          )
        ) : null}
      </span>
    </li>
  );
}
```

- [ ] **Step 3: Thread paid-state through `BillListCard`**

`BillListCard` must (a) accept `paidKeys`, `pendingKeys`, and `onTogglePaid`; (b) exclude paid occurrences from `outgoing` and `subtotalFor`; (c) pass per-row paid state to `BillRowItem`. Update the signature and the two sums:

Add to the destructured props and the prop type:

```tsx
function BillListCard({
  bills,
  groups,
  payDate,
  after,
  isCurrent,
  ingoing,
  paidKeys,
  pendingKeys,
  onBillClick,
  onTogglePaid,
}: {
  bills: BillRow[];
  groups: Group[];
  payDate: Date;
  after: Date | null;
  isCurrent: boolean;
  ingoing: number;
  paidKeys: Set<string>;
  pendingKeys: Set<string>;
  onBillClick: (billId: string) => void;
  onTogglePaid: (bill: BillRow) => void;
}) {
```

Replace the `outgoing` memo and `subtotalFor` so paid rows drop out (alongside excluded):

```tsx
  const outgoing = useMemo(
    () =>
      sumBy(
        bills.filter(
          (bill) =>
            !excludedBills.includes(bill._id) &&
            !isOccurrencePaid(paidKeys, bill._id, bill.date),
        ),
        (bill) => bill.amount ?? 0,
      ),
    [bills, excludedBills, paidKeys],
  );
```

```tsx
  const subtotalFor = (sectionBills: BillRow[]) =>
    sumBy(
      sectionBills.filter(
        (b) =>
          !excludedBills.includes(b._id) &&
          !isOccurrencePaid(paidKeys, b._id, b.date),
      ),
      (b) => b.amount ?? 0,
    );
```

Replace the `BillRowItem` render (inside `section.bills.map`) to pass paid state:

```tsx
                    {section.bills.map((bill) => {
                      const key = occurrenceKey(bill._id, bill.date);
                      return (
                        <BillRowItem
                          key={bill._id}
                          bill={bill}
                          payDate={payDate}
                          isExcluded={excludedBills.includes(bill._id)}
                          isPaid={paidKeys.has(key)}
                          isPaidPending={pendingKeys.has(key)}
                          onClick={() => onBillClick(bill._id)}
                          onToggleExclude={() => toggleExclude(bill._id)}
                          onTogglePaid={() => onTogglePaid(bill)}
                        />
                      );
                    })}
```

- [ ] **Step 4: Wire the query, mutations, and pending-set in `BillList`**

In the `BillList` component, add the payments query, paid lookup, per-occurrence pending set, and the toggle handler; pass them to each `BillListCard`. Add near the other queries:

```tsx
  const { data: payments } = api.payment.getAll.useQuery();
  const utils = api.useUtils();
  const markPaid = api.payment.markPaid.useMutation();
  const markUnpaid = api.payment.markUnpaid.useMutation();
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());

  const paidKeys = useMemo(() => buildPaidLookup(payments ?? []), [payments]);

  const handleTogglePaid = (bill: BillRow) => {
    const key = occurrenceKey(bill._id, bill.date);
    const currentlyPaid = paidKeys.has(key);
    setPendingKeys((prev) => new Set(prev).add(key));
    const mutation = currentlyPaid ? markUnpaid : markPaid;
    mutation.mutate(
      { billId: bill._id, occurrenceDate: bill.date },
      {
        onSuccess: () => utils.payment.getAll.invalidate(),
        onError: (error) =>
          toast.error(error.message || "Failed to update payment"),
        onSettled: () =>
          setPendingKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          }),
      },
    );
  };
```

Keep the existing `if (!incomeProfile || !bills || !groups) return null;` guard as-is (do **not** gate on `payments` — an unloaded payment set just means "nothing paid yet"). Then pass the new props in the `.map`:

```tsx
        {billsInPayPeriod.map(({ payDate, bills, after }, index) => (
          <BillListCard
            key={index}
            payDate={payDate}
            bills={bills}
            groups={groups}
            after={after}
            isCurrent={index === 0}
            ingoing={ingoing}
            paidKeys={paidKeys}
            pendingKeys={pendingKeys}
            onBillClick={handleBillClick}
            onTogglePaid={handleTogglePaid}
          />
        ))}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Lint**

Run: `node_modules/.bin/eslint src/app/_components/billList.tsx`
Expected: no errors or warnings.

- [ ] **Step 7: Build**

Run: `SKIP_ENV_VALIDATION=1 pnpm build`
Expected: compiles successfully.

- [ ] **Step 8: Live verification (per the `verify` skill)**

Start the dev server (`pnpm dev --port 3001`; wait for `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/` → `200`). In a fresh browser context: landing page → **Try as Guest** → set up an income profile → create a recurring monthly bill with an amount → open `/dashboard`.

Verify:
- Each occurrence row shows an empty circle; clicking it fills to a check, dims the row, strikes the amount, and the period card's balance rises by that amount ("going out" drops).
- Reload the page → the occurrence is still shown paid (confirms the stored key matched the regenerated occurrence).
- Click the check again → reverts to unpaid, balance drops back.

- [ ] **Step 9: Commit**

```bash
git add src/app/_components/billList.tsx
git commit -m "feat: mark occurrences paid from the bill list (#34)

Row checkbox toggles markPaid/markUnpaid (disabled while pending);
paid rows dim + strike and drop out of every period sum, exactly
like an excluded row.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Summary cards — remaining balance and next-unpaid

**Files:**
- Modify: `src/components/financialSummaryCards.tsx`

**Interfaces:**
- Consumes: `api.payment.getAll`; `buildPaidLookup`, `isOccurrencePaid` from `~/lib/payment-utils`.

- [ ] **Step 1: Add imports**

In `src/components/financialSummaryCards.tsx`, add:

```tsx
import { api } from "~/trpc/react";
import { buildPaidLookup, isOccurrencePaid } from "~/lib/payment-utils";
```

- [ ] **Step 2: Fetch payments and exclude paid from balance + next bill**

Add the query and paid lookup at the top of the component body (above the existing `useMemo`), then filter `nextBill` and `totalBillAmount` to unpaid:

```tsx
  const { data: payments } = api.payment.getAll.useQuery();
  const paidKeys = useMemo(() => buildPaidLookup(payments ?? []), [payments]);

  const { currentPeriodBills, nextBill } = useMemo(() => {
    const payRule = createPayRule(incomeProfile);
    const currentPay = payRule.before(localDateToUtcDateOnly(new Date()), true);
    if (!currentPay) return { currentPeriodBills: [], nextBill: null };

    const nextPayDate = payRule.after(currentPay);
    if (!nextPayDate) return { currentPeriodBills: [], nextBill: null };

    const periodBills = computeBillsInPeriod(bills, currentPay, nextPayDate);

    const today = startOfDay(new Date());
    const upcoming = periodBills.find(
      (b) =>
        utcDateOnlyToLocal(b.date) >= today &&
        !isOccurrencePaid(paidKeys, b._id, b.date),
    );

    return { currentPeriodBills: periodBills, nextBill: upcoming ?? null };
  }, [incomeProfile, bills, paidKeys]);

  const income = incomeProfile.amount ?? 0;
  const totalBillAmount = sumBy(
    currentPeriodBills.filter((b) => !isOccurrencePaid(paidKeys, b._id, b.date)),
    (b) => b.amount ?? 0,
  );
  const balance = income - totalBillAmount;
```

(The `useMemo` gains `paidKeys` in its dependency array; `totalBillAmount` now filters out paid occurrences. The "Total Bills" card still shows `bills.length` — unchanged.)

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `node_modules/.bin/eslint src/components/financialSummaryCards.tsx`
Expected: no errors or warnings.

- [ ] **Step 5: Build**

Run: `SKIP_ENV_VALIDATION=1 pnpm build`
Expected: compiles successfully.

- [ ] **Step 6: Live verification**

With the dev server running and the guest session from Task 3: on `/dashboard`, note the **Balance** card and **Next Bill** card. Mark the nearest upcoming occurrence paid.

Verify:
- The **Balance** card's amount rises by the paid bill's amount (remaining excludes paid).
- The **Next Bill** card advances to the next unpaid upcoming bill (or "None" if the current period is cleared — expected, period-scoped behavior).

- [ ] **Step 7: Commit**

```bash
git add src/components/financialSummaryCards.tsx
git commit -m "feat: exclude paid occurrences from dashboard balance (#34)

Summary balance now shows true remaining (unpaid only) and Next Bill
skips already-paid occurrences.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Full-branch verification and `/bills` route check

**Files:**
- Possibly modify: `src/app/bills/*` (only if it renders occurrences — see below)

- [ ] **Step 1: Determine whether `/bills` renders occurrences**

Run: `git grep -n "getPayPeriodsByCount\|computeBillsInPeriod\|BillRowItem\|<BillList" src/app/bills`
Expected: identify whether the `/bills` route reuses `BillList` (inherits the checkbox for free) or renders a flat list of bill *definitions* (no dated occurrences → out of scope, no change). Record the finding.

- [ ] **Step 2: Full typecheck + build**

Run: `pnpm typecheck && SKIP_ENV_VALIDATION=1 pnpm build`
Expected: both succeed.

- [ ] **Step 3: End-to-end smoke (per `verify` skill)**

With a fresh guest session: create both a **single** bill and a **recurring** bill → dashboard → mark an occurrence of each paid → reload → both persist as paid, balance reflects remaining → unmark one → reverts. Confirm no console errors beyond the known pre-existing noise (Better Auth "Base URL" warn, Radix "Missing Description for DialogContent").

- [ ] **Step 4: (No commit unless Step 1 required a change.)** If `/bills` reused `BillList` and needed nothing, note it in the PR description. If it needed a change, implement it mirroring Task 3's row wiring, then typecheck + lint + build + commit.

---

## Self-Review

**Spec coverage:**
- Data model (`payments`, UTC-midnight key) → Task 1. ✓
- `getAll` / `markPaid` / `markUnpaid`, ownership, idempotent upsert, `deleteMany` → Task 1. ✓
- Join module (`occurrenceKey` timezone-stable, `buildPaidLookup`, `isOccurrencePaid`) → Task 2. ✓
- Row checkbox, dim/strike, disable-while-pending, invalidate, toast → Task 3. ✓
- Paid drops from subtotal/outgoing/balance like excluded (invariant preserved) → Task 3. ✓
- Remaining balance + next-unpaid on summary cards → Task 4. ✓
- Persistence across reload → verified in Tasks 3 & 5. ✓
- Out of scope (overdue, amountPaid, history, playground) → not touched. ✓
- `/bills` route confirmation → Task 5. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every command has expected output. ✓

**Type consistency:** `occurrenceKey(billId, date)`, `buildPaidLookup(payments)`, `isOccurrencePaid(paidKeys, billId, date)`, `Payment`, and the `markPaid`/`markUnpaid` input shape `{ billId, occurrenceDate }` are used identically across Tasks 1–4. `onTogglePaid(bill)`, `paidKeys`, `pendingKeys` prop names match between `BillList` and `BillListCard`. ✓
