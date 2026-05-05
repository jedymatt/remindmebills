# UI Design System — Design Spec

**Date:** 2026-05-05
**Status:** Approved
**Scope:** Visual refresh + reusable component patterns built on shadcn/ui (Path B). No page-level rewrites.

## 1. Goals & non-goals

### Goals

- Replace the default neutral shadcn look with a distinctive visual identity that fits a warm, refined, approachable personal-finance app.
- Build a small set of domain pattern components (`MoneyDisplay`, `BillCard`, etc.) that codify the most-repeated UI in the app.
- Adopt those patterns in the highest-visibility surfaces (dashboard summary, bill list, bill view) so the redesign is tangible, not theoretical.
- Full light + dark mode parity at the token level (capability only — no UI toggle in this pass).

### Non-goals

- No new routes, no page-level rewrites.
- No `/design` styleguide route.
- No real logo — `BrandMark` ships as a Fraunces-italic monogram placeholder.
- No test infrastructure (project has none; not added here).
- No dark-mode UI toggle (capability built; surfaced in a follow-up).
- No form redesigns; forms pick up the new look passively via tokens.
- No bespoke animations beyond tokenized motion.
- No `MoneyDisplay` i18n beyond accepting a `currency` prop. Only PHP is used in adoption sites.

## 2. Personality & visual direction

- **Personality:** warm + refined + approachable. Combination of "calm/premium" (Stripe, Linear, Things 3) and "playful/friendly" (Monzo, Cash App). Rejects "bold/editorial" and "utilitarian/data-heavy" directions.
- **Palette: P3 Lavender & Plum.** Plum primary in both modes; lavender-tinted neutrals; sage paid-state; warm pink due-soon; soft red overdue. Distinctive against the typical fintech blue/green palette.
- **Typography: Fraunces + Inter (T2).**
  - Fraunces (variable, axes `opsz`/`SOFT`) — display headings, large numerals.
  - Inter (variable) — body, UI labels, small numerals, form inputs.
  - Geist is removed.
- **Density:** comfortable spacing; generous but not airy. Bill list density toggleable via prop on `BillCard`.
- **Motion:** subtle. Three duration tokens, one easing curve. No bespoke entrance choreography.

## 3. Token architecture

Two-tier tokens: **raw → semantic**. Raw tokens hold the actual color values; semantic tokens are role-based aliases (`--primary`, `--card`, …) that components consume. This isolates the palette from component code.

### Raw tokens — `src/styles/tokens.css` (new)

Defines the color ramps:

- `--plum-50` … `--plum-900` (primary)
- `--lavender-50` … `--lavender-900` (neutrals with plum tint)
- `--sage-100/300/500/700` (paid)
- `--coral-100/300/500/700` (due-soon)
- `--rose-100/300/500/700` (overdue)
- `--ink-50` … `--ink-900` (foreground neutrals)

Values use `oklch()`. The exact stops are tuned during implementation; the contract is "ten-stop ramps with consistent perceptual lightness steps."

### Semantic tokens — `src/styles/globals.css` (rewritten)

Existing shadcn semantic names are preserved so every shadcn primitive picks up the new look automatically:

`--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring`, `--chart-1` … `--chart-5`, `--sidebar*` (existing shadcn sidebar tokens kept for forward-compat).

**New roles added:**

- `--brand` — reserved for logo / brand mark. Defaults to `--primary` until a real logo lands.
- `--money` — foreground token for currency text.
- `--paid`, `--paid-foreground` — paid-status surface + text.
- `--due-soon`, `--due-soon-foreground` — due-soon-status surface + text.
- `--overdue`, `--overdue-foreground` — overdue-status surface + text.

**Light/dark strategy.** Dark mode is *not* a mechanical inversion. Plum stays the primary in both modes but lightens (~`oklch(0.72 0.10 305)`); backgrounds shift to a deep plum-tinted charcoal (~`oklch(0.18 0.015 300)`). Status surfaces (paid, due-soon, overdue) pick more saturated, darker variants for dark mode. Both modes are defined explicitly: `:root { … }` for light, `.dark { … }` for dark.

### Type-scale tokens

Defined as Tailwind 4 `@utility` blocks in `globals.css`:

| Utility | Size / line-height | Font | Notes |
|---|---|---|---|
| `text-display-xl` | 44 / 48 | Fraunces 500 | `letter-spacing: -0.03em` — hero numerals |
| `text-display-lg` | 32 / 36 | Fraunces 500 | `letter-spacing: -0.02em` |
| `text-display-md` | 24 / 30 | Fraunces 500 | `letter-spacing: -0.01em` — section headings, default `MoneyDisplay` |
| `text-body` | 14 / 20 | Inter 400 | default body |
| `text-body-sm` | 13 / 18 | Inter 400 | secondary text |
| `text-label` | 11 / 14 | Inter 600 | `letter-spacing: 0.14em`, `text-transform: uppercase` |
| `text-num` | inherits | — | `font-feature-settings: 'tnum'` — composable with size utilities |

### Radius, elevation, motion

- `--radius: 0.75rem` (was `0.625rem`). shadcn-derived `--radius-sm/md/lg/xl` keep their existing relationships.
- `--shadow-sm: 0 1px 2px rgba(plum, 0.06), 0 0 0 1px rgba(plum, 0.04)` — cards at rest.
- `--shadow-md: 0 8px 24px rgba(plum, 0.10), 0 0 0 1px rgba(plum, 0.04)` — popovers, hover lift, dialogs.
- Dark mode overrides shadow color to neutral (no plum tint at dark luminance).
- `--duration-fast: 120ms`, `--duration-base: 200ms`, `--duration-slow: 320ms`.
- `--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1)` — single easing curve.

## 4. File layout

```
src/
  app/
    layout.tsx              # MODIFIED — fonts swapped, CSS vars exposed
  components/
    patterns/               # NEW
      index.ts              # barrel export
      MoneyDisplay.tsx
      StatusBadge.tsx
      RecurrenceBadge.tsx
      BrandMark.tsx
      BillCard.tsx
      SummaryCard.tsx
      SectionHeader.tsx
      EmptyState.tsx
    ui/
      badge.tsx             # MODIFIED — adds paid/due-soon/overdue/accent variants
      (others)              # unchanged structurally; pick up new tokens
  styles/
    tokens.css              # NEW — raw palette
    globals.css             # REWRITTEN — semantic tokens, type scale, motion, base layer
```

Patterns are imported from a barrel: `import { BillCard, MoneyDisplay } from "~/components/patterns"`.

## 5. Pattern catalog

Eight components. Each is a single-file React component with a named export and explicit prop types.

### Atoms

#### `MoneyDisplay`

```ts
type MoneyDisplaySize = "sm" | "md" | "lg" | "xl";
type MoneyDisplayTone = "default" | "muted" | "negative";

interface MoneyDisplayProps {
  value: number;
  currency: "PHP" | "USD" | string;
  size?: MoneyDisplaySize;        // default "md"
  tone?: MoneyDisplayTone;        // default "default"
  locale?: string;                // default "en-PH"
  className?: string;
}
```

- Formats via `Intl.NumberFormat(locale, { style: "currency", currency })`.
- Sizes ≥ `md` render in Fraunces; `sm` renders in Inter.
- Always emits tabular numerals (`font-feature-settings: 'tnum'`).
- `tone="muted"` uses `--muted-foreground`; `tone="negative"` uses `--overdue-foreground`.
- Renders a `<span>`. No wrapping div.

#### `StatusBadge`

```ts
type BillStatus = "paid" | "due-soon" | "overdue" | "upcoming" | "recurring";

interface StatusBadgeProps {
  status: BillStatus;
  label?: string;        // override default label (e.g. "Due in 2d")
  className?: string;
}
```

- Composes shadcn `<Badge>` with the matching variant (`paid`, `due-soon`, `overdue`, `accent`, `secondary`).
- Default label per status: `Paid`, `Due soon`, `Overdue`, `Upcoming`, `Recurring`.
- Override with `label` for relative dates ("Due in 2d", "Overdue 3d").
- **Note on `paid`:** the current data model (`BillEvent`) has no "paid" field — bills are events, not payment records. `paid` is included in the type for forward compatibility, but no adoption site in this pass renders it. The variant will exist in the badge `cva` config and the pattern type, but stay unused until paid-tracking is introduced.

#### `RecurrenceBadge`

```ts
interface RecurrenceBadgeProps {
  rule: string;          // RFC-5545 rrule string, as stored on bills
  className?: string;
}
```

- Uses existing `bill-utils.ts` helpers to parse the rrule and produce a human label ("Monthly", "Every 2 weeks", "Yearly · Mar 15"). If a helper doesn't yet emit this label, add one to `bill-utils.ts` rather than duplicating logic in the pattern.
- Composes shadcn `<Badge variant="accent">` with a `Repeat` icon from lucide-react.

#### `BrandMark`

```ts
type BrandMarkSize = "sm" | "md" | "lg";

interface BrandMarkProps {
  size?: BrandMarkSize;       // default "md"
  className?: string;
}
```

- Renders an SVG (or styled `<span>`) showing a single-letter "R" monogram in Fraunces italic, on a `--brand` background with `--primary-foreground` text.
- Sizes: `sm` 24×24, `md` 36×36, `lg` 56×56.
- Designed for trivial replacement when a real logo lands — no consumers should depend on its internal markup.

### Composites

#### `BillCard`

```ts
type BillCardDensity = "compact" | "comfortable";

interface BillCardProps {
  bill: BillEvent;             // existing type from ~/types
  group?: Group | null;        // existing type from ~/types — has order, used to derive color
  occurrenceDate?: Date;       // for recurring bills, the specific occurrence being shown
  density?: BillCardDensity;   // default "comfortable"
  onSelect?: () => void;
  className?: string;
}
```

- Renders title, due date, recurrence (`RecurrenceBadge` if `bill.type === "recurring"`), status (`StatusBadge` derived from due date), amount (`MoneyDisplay`).
- Left-edge color stripe (4px) when `group` is provided. The color is derived via the existing `colorForOrder(group.order)` helper from `~/lib/group-colors` — `BillCard` calls it internally; consumers pass the `Group` object as-is.
- `comfortable` (default): 14/16px padding, two-line meta. `compact`: 8/12px padding, one-line meta.
- Composes `MoneyDisplay`, `StatusBadge`, `RecurrenceBadge`.

**Status derivation** (computed inside `BillCard`):

- For `bill.type === "single"`: compare `bill.date` to today.
- For `bill.type === "recurring"`: use `occurrenceDate` if provided, else the next occurrence computed from `bill.recurrence` via `bill-utils.ts`.
- Mapping: `< today` → `overdue`; `≤ today + 3d` → `due-soon`; otherwise → `upcoming`. Recurring bills additionally surface `recurring` in the meta row via `RecurrenceBadge`, so `upcoming` is the typical badge in the headline row.
- The mapping rule (3-day window for "due-soon") is encoded as a single helper `deriveBillStatus(bill, occurrenceDate?)` co-located with `BillCard` (or pushed into `bill-utils.ts` if it grows).

#### `SummaryCard`

```ts
interface SummaryCardProps {
  icon: LucideIcon;
  label: string;
  subtitle?: string;
  children: React.ReactNode;   // the value: usually a <MoneyDisplay> or plain text/number
  className?: string;
}
```

- Renders an icon chip (icon in `--accent` square), uppercase label, value (children), subtitle.
- `children` design lets the consumer choose `<MoneyDisplay>` for monetary tiles or plain text for non-monetary ones (e.g. "6 active bills", "Spotify Premium").
- Composes shadcn `<Card>` underneath.

#### `SectionHeader`

```ts
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;     // typically a <Button>
  className?: string;
}
```

- Renders title in Fraunces 500 / `text-display-md`, subtitle in body-sm muted, action right-aligned, separator underline.

#### `EmptyState`

```ts
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}
```

- Centered card with dashed border, icon chip, Fraunces title, body-sm description, optional action.

### shadcn primitives — what changes

- `~/components/ui/badge.tsx` — add `paid`, `due-soon`, `overdue`, `accent` variants to the existing `cva` config. These map to the new semantic tokens.
- All other shadcn primitives (`Button`, `Card`, `Input`, `Select`, `Dialog`, `Popover`, `Calendar`, `Tabs`, `Skeleton`, `Form`, `AlertDialog`, `Avatar`, `DropdownMenu`, `Label`, `RadioGroup`, `Separator`, `Sonner`) are unchanged structurally — they pick up the new look entirely through token replacement.

## 6. Adoption sites

Five files modified to consume the new patterns.

| # | File | What changes |
|---|---|---|
| 1 | `src/components/financialSummaryCards.tsx` | Replace inline `Card` rendering of the four tiles with `<SummaryCard>` containing `<MoneyDisplay>` for monetary values, plain text for non-monetary. Remove the local `formatPHP` helper — `MoneyDisplay` owns formatting. |
| 2 | `src/app/_components/billList.tsx` | Replace inline list-item markup with `<BillCard>`. Group color stripe is forwarded via `BillCard`'s `group` prop, preserving existing visual. |
| 3 | `src/components/billViewMode.tsx` | Bill amount becomes `<MoneyDisplay size="lg">`; the inline "Recurring Bill" `<Badge>` becomes `<StatusBadge status="recurring">`; recurrence rule preview uses `<RecurrenceBadge>`. |
| 4 | `src/components/authenticatedLayout.tsx` | Add `<BrandMark size="md" />` to the header (replacing or alongside the current text title — exact placement determined during implementation). |
| 5 | `src/components/dashboardPage.tsx` and/or `src/components/playgroundStartScreen.tsx` | Empty/zero-state branches use `<EmptyState>` instead of inline markup. |

**Explicitly NOT touched in this pass:**

- All forms (`createBillForm.tsx`, `billFormFields.tsx`, `editIncomeProfileDialog.tsx`, `createIncomeProfileForm.tsx`, `createBillPage.tsx`) — they inherit new tokens automatically.
- `groupManager.tsx`, `homePage.tsx`.
- `playgroundBillList.tsx`, `playgroundBillModal.tsx`, `playgroundBillFormDialog.tsx`, `playgroundBanner.tsx`, `playgroundWorkspace.tsx`, `playgroundPage.tsx` — pick up new tokens; pattern adoption deferred.
- `incomeProfileSection.tsx` — picks up new tokens.

## 7. Verification

1. `pnpm check` (lint + typecheck) passes for all changed files. New patterns must compile clean under strict TypeScript.
2. `pnpm dev` boots without runtime errors. Routes that exist today continue to render: `/`, `/dashboard`, `/bills`, `/bills/create`, `/playground`.
3. **Light-mode walkthrough:** sign in → dashboard (verify `SummaryCard` × 4 + bill list with `BillCard`) → click a bill → view mode (verify `MoneyDisplay`, `StatusBadge`, `RecurrenceBadge`) → assign group → close. Compare against `patterns.html` mockup.
4. **Dark-mode walkthrough:** add the `dark` class to `<html>` via DevTools (no UI toggle in this pass) and repeat the walkthrough. Confirm contrast and that no surface looks broken.
5. **Empty-state spot-check:** in a fresh playground or by clearing bills, confirm `EmptyState` renders with action working.
6. **Header check:** confirm `BrandMark` renders in the authenticated header at appropriate sizes on mobile and desktop widths.
7. **Existing rrule behavior:** confirm `RecurrenceBadge` labels match the rrule outputs the app currently shows on `billViewMode` and elsewhere — i.e. the rrule parsing is reused, not reimplemented.

## 8. Risks & mitigations

- **Font payload (~80–120 KB).** Mitigated by `next/font/google` self-hosting, Latin subset, `display: "swap"`. Acceptable for a personal-finance app.
- **Pattern API regret.** The pattern surface is small (8 components); APIs are minimal. If a prop turns out wrong, it's local to one or two adoption sites. Reviewed during implementation, not pre-locked.
- **Color contrast in dark mode for status surfaces.** Pink-on-dark and rose-on-dark must clear WCAG AA. To be verified during implementation; if any combination fails, the dark variant gets desaturated/lightened until it passes. Light mode pairings are already AA-compliant by construction.
- **Currency formatting edge cases.** `MoneyDisplay` receives raw numbers; we trust `Intl.NumberFormat` for negatives, decimals, and grouping. Localized minus signs and PHP `₱` symbol are handled natively by the API.
- **Rrule label coverage.** `RecurrenceBadge` may encounter rrule patterns whose human label isn't yet implemented. Strategy: extend `bill-utils.ts` with a single `formatRecurrence(rule): string` helper covering existing patterns, default to a sensible fallback ("Custom recurrence") for the rest.

## 9. Sequencing summary

(Implementation plan will detail this; included here for shape only.)

1. Foundation: tokens, fonts, type scale, motion, badge variants. No visual change yet on consumer surfaces.
2. Atoms: `MoneyDisplay`, `StatusBadge`, `RecurrenceBadge`, `BrandMark`. Each independently testable in isolation.
3. Composites: `SummaryCard`, `BillCard`, `SectionHeader`, `EmptyState`.
4. Adoption: the five files in §6, in any order — they don't depend on each other.
5. Verification walkthrough.
