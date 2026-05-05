// Fixed palette, ordered. Index 0..7 maps to a Tailwind-derived hex.
// Group color is derived from `order % palette.length` (no DB writes).
export const GROUP_COLOR_PALETTE = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
  "#f97316", // orange-500
] as const;

export const UNGROUPED_COLOR = "#94a3b8"; // slate-400 — neutral muted

export function colorForOrder(order: number): string {
  const len = GROUP_COLOR_PALETTE.length;
  const idx = ((order % len) + len) % len; // safe for negative
  return GROUP_COLOR_PALETTE[idx]!;
}
