# Bill Grouping (Destination Bank / Savings Account)

## Problem

Bills currently have no notion of source/destination. Users want to think of each bill as paid from a specific account (e.g., "BPI Savings", "Cash", "Credit Card"). Without grouping, the dashboard's per-pay-period cards show one undifferentiated list, making it hard to answer "how much do I owe from BPI this period?".

## Goals

- Each bill optionally belongs to one user-defined group.
- Each per-pay-period card on the dashboard renders bills sectioned by group, with a per-section subtotal.
- Users manage their groups (create, rename, reorder, delete) on a dedicated page.

## Non-goals

- Multiple groups per bill (tags).
- Group support in the playground (`/playground` stays simple).
- Filtering bills by group on the dashboard.
- Adding/modifying a `/bills` index list page (no such page currently exists in the repo; only `/bills/create` does).
- Bulk-reassign bills from the group manager.
- Sharing groups across users.
- Group-based notifications/reminders.
- Persisting group color (colors are derived, not stored).

## Data model

### New collection: `groups`

```ts
type Group = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;   // 1-50 chars, trimmed
  order: number;  // 0-based, dense within a user; defines display order
};
```

Color is **not** stored. The UI derives a color from `order` against a fixed 8-color palette (see "Color derivation" below).

### Modified collection: `bills`

`BillEvent` gains an optional field:

```ts
groupId?: ObjectId | null;
```

Existing bills are untouched and treated as ungrouped.

### Indexes

- `groups`: compound index on `{ userId: 1, order: 1 }` for ordered fetch.
- `bills`: no new index required for this feature. (A `{ userId: 1, groupId: 1 }` index is a future option if per-group queries appear.)

### Schema/type changes

- New file `src/schemas/group.ts` with Zod schemas: `CreateGroupInput`, `UpdateGroupInput`, `ReorderGroupsInput`.
- `~/types` adds an exported `Group` type and extends `BillEvent` with `groupId?: string | null` (serialized to hex string at the API boundary, matching the existing `_id`/`userId` pattern).
- `BillFormValuesSchema` (in `billFormFields.tsx`) extends both `single` and `recurring` variants with `groupId: z.string().nullish()`.

## Color derivation

- New file `src/lib/group-colors.ts` exports a fixed palette (8 Tailwind-derived hex colors) and a helper `colorForOrder(order: number): string` returning `palette[order % palette.length]`.
- Reordering groups can shift colors. This is acceptable — the user is the one reordering, and there are no DB writes to keep in sync.
- Ungrouped bills render with a neutral muted swatch (or no swatch) — to be decided visually during implementation, not a behavioral concern.

## tRPC API

### New router: `src/server/api/routers/group.ts`

Registered in `src/server/api/root.ts`. All procedures are `protectedProcedure` and scoped to `ctx.session.user.id`.

| Procedure | Input | Returns | Behavior |
|---|---|---|---|
| `getAll` | — | `Group[]` | Ordered by `order` ascending. |
| `create` | `{ name }` | created `Group` | Server assigns `order = (max existing order) + 1`, or `0` if none. |
| `update` | `{ id, data: { name? } }` | — | Throws `NOT_FOUND` if not owned. |
| `reorder` | `{ orderedIds: string[] }` | — | Validates the set of ids exactly matches the user's groups. Assigns dense `order` values in array index order via a bulk write. |
| `delete` | `{ id }` | — | Two-step (no transaction): `bills.updateMany({ userId, groupId }, { $unset: { groupId: "" } })` first, then `groups.deleteOne(...)`. Both inside a try/catch; on failure, surface a generic error. A retry is safe since the bills update is idempotent. |

Transactions are not used because MongoDB transactions require a replica set, which the project's setup does not assume.

### Modifications to `src/server/api/routers/bill.ts`

- `InputBillSchema` gains `groupId: z.string().nullish()`.
- On `create` and `update`, when `groupId` is a non-empty string the server:
  1. Validates `ObjectId.isValid(groupId)`.
  2. Verifies the group belongs to the same user via a single `groups.findOne({ _id, userId })`.
  3. On either failure: throws `BAD_REQUEST`.
- When `groupId` is `null` or `undefined` it is stored as `null` (or unset). Existing bills (with the field absent) are treated identically to `null`.
- `getAll` and `getById` serialize `groupId` to a hex string when present; absent or null `groupId` is returned as `null`.

### Client-side cache invalidation

- `group.create` / `update` / `reorder` → invalidate `group.getAll`.
- `group.delete` → invalidate `group.getAll`, `bill.getAll`, and `bill.getById` (since `groupId` was unset on bills).

## UI

### `/groups` — group management page

- New protected route `src/app/groups/page.tsx` (RSC shell rendering `<GroupManager />`).
- New client component `src/components/groupManager.tsx`.

Layout:

- Header: "Groups" title, "New group" button on the right.
- Empty state when no groups exist: short message + "New group" CTA.
- Group list: vertical list of rows. Each row shows:
  - Drag handle (left)
  - Color swatch (derived from `colorForOrder(group.order)`)
  - Group name
  - Bill count badge (e.g., "3 bills") — derived client-side from `bill.getAll`
  - Edit and Delete icon buttons (right)

Create / edit dialog:

- Shadcn `Dialog` containing a small React Hook Form + Zod form. Single field: name. Reused for create and edit (pre-filled in edit).
- On submit → mutation → toast → close dialog → React Query invalidates `group.getAll`.

Delete flow:

- Trash icon → Shadcn `AlertDialog` (matching the pattern in `billModal.tsx`).
- Body: `Delete '<name>'? This will remove the group from N bills. The bills will not be deleted.` (`N` = bill count for this group, computed client-side from `bill.getAll`.)
- Confirm → `group.delete` mutation → invalidates groups + bills → toast.

Reordering:

- Drag-and-drop using `@dnd-kit/core` and `@dnd-kit/sortable` (two new dependencies).
- On drop: optimistically reorder client-side, fire `group.reorder` with the new id order; on error, roll back state and toast an error.

Navigation:

- Add a "Groups" link in `authenticatedLayout.tsx` next to existing nav entries.

### Dashboard cards (`src/app/_components/billList.tsx`)

`BillList` adds a third parallel query: `api.group.getAll.useQuery()`. Render is gated on all three queries having data (extending the existing `if (!incomeProfile || !bills) return null;` guard).

`BillListCard` is changed to render bills sectioned by group. Sectioning logic, in user-defined group order, with ungrouped last:

```ts
const grouped: { group: Group | null; bills: BillRow[] }[] = [
  ...groups.map((g) => ({ group: g, bills: bills.filter((b) => b.groupId === g._id) })),
  { group: null, bills: bills.filter((b) => !b.groupId) },
].filter((section) => section.bills.length > 0);
```

Each section renders:

- A small heading row: color swatch + group name on the left, group subtotal on the right (sum of `bill.amount ?? 0` for non-excluded bills in that section, formatted with the existing `formatPHP` helper). Ungrouped section heading: "Ungrouped" with a neutral swatch.
- The existing bill `<li>` rendering, scoped to the section's bills (the existing `divide-y` continues to separate rows within the section).
- Sections are separated by spacing only — no extra dividers.

The existing per-bill "exclude from balance" eye-icon toggle remains; excluded bills contribute 0 to their section subtotal (mirroring how the card's `outgoing` already works).

The card-level totals (`outgoing`, `balance`, breakdown footer) are unchanged — they continue to sum across all bills in the period regardless of group.

### Bill form (`src/components/billFormFields.tsx`)

Add an optional Group field between the amount input and the type tabs:

- Shadcn `Select` populated from `api.group.getAll.useQuery()`.
- First option: "No group" (form value: `null`).
- Then one item per group, ordered by `order`, displaying color swatch + name.
- No inline "Create new group..." option (groups are managed only on `/groups`).

`CreateBillForm` and `BillEditMode` (in `billModal.tsx`) read/write this field through their existing default-values plumbing. `playgroundBillFormDialog` does **not** include this field.

### Bill detail view (`src/components/billViewMode.tsx`)

Display the group as a labeled field ("Group: <swatch> <name>") when present. Omit the row when absent.

## Files touched

| File | Change |
|---|---|
| `src/server/api/routers/group.ts` | New: `getAll`, `create`, `update`, `reorder`, `delete`. |
| `src/server/api/routers/bill.ts` | Add `groupId` to input schemas, validate ownership on create/update, serialize on read. |
| `src/server/api/root.ts` | Register `groupRouter`. |
| `src/schemas/group.ts` | New: input Zod schemas. |
| `src/types/index.ts` | Export `Group`; extend `BillEvent` with `groupId`. |
| `src/lib/group-colors.ts` | New: palette + `colorForOrder`. |
| `src/app/groups/page.tsx` | New: RSC shell. |
| `src/components/groupManager.tsx` | New: management UI (list + dialog + DnD). |
| `src/components/billFormFields.tsx` | Add Group select; extend `BillFormValuesSchema`. |
| `src/components/createBillForm.tsx` | Default-value plumbing for `groupId`. |
| `src/components/billModal.tsx` | Default-value plumbing for `groupId` in `BillEditMode`. |
| `src/components/billViewMode.tsx` | Display group field when present. |
| `src/app/_components/billList.tsx` | Add `group.getAll` query; section bills inside `BillListCard`. |
| `src/components/authenticatedLayout.tsx` | Add "Groups" nav link. |

## Dependencies

- `@dnd-kit/core` and `@dnd-kit/sortable` (new).

## Alternatives considered

- **Embed groups on a per-user settings doc.** Single read for all groups, but no existing settings doc to extend (income profile is a different concern). Less conventional than a separate collection.
- **Denormalize `group: { name, color }` on each bill (no entity).** Zero extra queries, but renaming requires updating every bill, no place for custom order, and effectively rules out a management page. Rejected.
- **Up/down arrow buttons instead of DnD.** Avoids two dependencies but degrades the management UX. DnD chosen.
- **Stable color from hash of `_id`** instead of derived from `order`. Avoids reorder-induced color drift but introduces collisions even with few groups. Order-based chosen.
- **Fixed palette saved to DB** vs derived. Saving allows custom colors later; deriving keeps the model simpler and removes a UI decision per group. Derived chosen.
