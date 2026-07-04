import { format } from "date-fns";

/**
 * Date-only values in this app (bill `date`/`dtstart`/`until`, income
 * `startDate`, and the pay-period boundaries derived from them) are stored as
 * `Date` instants but represent a calendar *day*, with no meaningful time.
 *
 * The canonical representation is **UTC midnight** (`YYYY-MM-DDT00:00:00Z`):
 * - `rrule` schedules off a Date's UTC fields, so UTC-midnight anchors produce
 *   occurrences on the intended day-of-month/weekday in every timezone.
 * - Bill dates already land here (`z.coerce.date()` parses `"yyyy-MM-dd"` as
 *   UTC midnight). Income dates (from the `Calendar`) are local midnight and
 *   must be converted — see `localDateToUtcDateOnly` and the migration.
 *
 * Render and compare these values with the helpers below so the calendar day is
 * stable in every timezone (date-fns `format` would otherwise shift the day in
 * non-UTC zones).
 */

const MS_PER_DAY = 86_400_000;

/**
 * Convert a local-midnight `Date` (what the `Calendar`/`DatePicker` produces) to
 * UTC midnight of the **same calendar day**, exactly, in any timezone.
 */
export function localDateToUtcDateOnly(local: Date): Date {
  return new Date(
    Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()),
  );
}

/**
 * Reinterpret a canonical (UTC-midnight) value's calendar day as a local `Date`,
 * so date-fns `format` and day-granularity comparisons are timezone-independent.
 */
export function utcDateOnlyToLocal(utc: Date): Date {
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

/**
 * Floor a `Date` to UTC midnight of its own UTC calendar day. Unlike
 * `localDateToUtcDateOnly` (which reads local fields) this keeps the UTC day, and
 * unlike `roundToUtcDateOnly` it floors rather than rounds. It's the canonical
 * key for occurrences in the UTC-naive frame: the client occurrence key and the
 * server-stored payment date both pass through it, so their days stay
 * byte-identical for the in-memory paid-state join.
 */
export function truncateToUtcDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** Format a canonical (UTC-midnight) value by its calendar day, timezone-stably. */
export function formatUtcDate(date: Date, formatStr: string): string {
  return format(utcDateOnlyToLocal(date), formatStr);
}

/**
 * Parse a native `<input type="date">` value (`"yyyy-MM-dd"`, or `""` when
 * cleared) into a canonical UTC-midnight `Date`, or `undefined` when empty or
 * invalid. The inverse of rendering with `formatUtcDate(value, "yyyy-MM-dd")`:
 * keeps date-only form state a `Date` (not the input's raw string) so the
 * display formatter and the `z.coerce.date()` schema agree. `new Date("yyyy-MM-dd")`
 * parses as UTC midnight, which is exactly the canonical representation.
 */
export function dateInputToUtcDateOnly(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Round an arbitrary instant to the nearest UTC midnight. Used to canonicalize
 * legacy income rows that were stored at *local* midnight (the old Calendar)
 * when read/written, without a data migration. Already-canonical (UTC-midnight)
 * values are unchanged (idempotent).
 *
 * Limitation: the original timezone can't be recovered from a bare instant, so
 * rounding only recovers the intended calendar day for client UTC offsets in
 * **(−12h, +12h]**. Offsets beyond +12h (NZ in NZDT = +13, Samoa/Tonga +13,
 * Kiribati +14, Chatham +13:45) and exactly −12h round to the adjacent day.
 * Those legacy rows self-correct the next time the profile is saved, since the
 * picker now writes exact UTC midnight via `localDateToUtcDateOnly`.
 */
export function roundToUtcDateOnly(date: Date): Date {
  return new Date(Math.round(date.getTime() / MS_PER_DAY) * MS_PER_DAY);
}
