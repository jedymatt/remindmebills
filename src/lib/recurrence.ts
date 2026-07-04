// Named recurrence cadences (fortnightly, quarterly, …) are not distinct
// storage types — they decompose onto the existing `{type, interval}` model the
// scheduler already understands:
//
//   fortnightly  = weekly  × 2
//   quarterly    = monthly × 3
//   semi-annual  = monthly × 6
//   yearly       = monthly × 12
//
// Keeping them as (base type, interval) pairs means the RRule mapping and the
// short-month day-clamping in `bill-utils.ts` are reused verbatim — a yearly
// bill dated Feb 29 clamps to Feb 28 for free because it flows through the same
// monthly generator. This module is the single source of truth mapping those
// pairs to/from the human-facing cadence names.

export type RecurrenceBase = "weekly" | "monthly";

export interface FrequencyPreset {
  id: string;
  label: string;
  type: RecurrenceBase;
  interval: number;
}

// Order here is the order shown in the picker. Each (type, interval) pair is
// unique, so `presetFor` is an unambiguous reverse lookup.
export const FREQUENCY_PRESETS: FrequencyPreset[] = [
  { id: "weekly", label: "Weekly", type: "weekly", interval: 1 },
  { id: "fortnightly", label: "Fortnightly", type: "weekly", interval: 2 },
  { id: "monthly", label: "Monthly", type: "monthly", interval: 1 },
  { id: "quarterly", label: "Quarterly", type: "monthly", interval: 3 },
  { id: "semiannual", label: "Every 6 months", type: "monthly", interval: 6 },
  { id: "yearly", label: "Yearly", type: "monthly", interval: 12 },
];

// The subset of a recurrence needed to name it. `bymonthday` matters because a
// bill pinned to specific days-of-month is not a plain "monthly" cadence, so it
// must not be labelled as a preset.
interface RecurrenceLike {
  type: RecurrenceBase;
  interval: number;
  bymonthday?: number[] | null;
}

/**
 * Returns the named preset a recurrence corresponds to, or null when it's a
 * custom cadence (an arbitrary interval, or one pinned to specific month-days)
 * that doesn't map to a named option.
 */
export function presetFor(recurrence: RecurrenceLike): FrequencyPreset | null {
  if (recurrence.bymonthday && recurrence.bymonthday.length > 0) return null;
  return (
    FREQUENCY_PRESETS.find(
      (p) => p.type === recurrence.type && p.interval === recurrence.interval,
    ) ?? null
  );
}

/**
 * Human-readable cadence: the preset name when one matches ("Quarterly"),
 * otherwise a generic "Every N weeks/months" for custom intervals.
 */
export function formatRecurrence(recurrence: RecurrenceLike): string {
  const preset = presetFor(recurrence);
  if (preset) return preset.label;

  const unit = recurrence.type === "weekly" ? "week" : "month";
  return `Every ${recurrence.interval} ${unit}${recurrence.interval === 1 ? "" : "s"}`;
}
