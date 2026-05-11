"use client";

import { formatDate, isEqual, subDays } from "date-fns";
import { sumBy } from "lodash";
import { EyeClosedIcon, EyeIcon, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { BillModal } from "~/components/billModal";
import { getBillsByPayPeriod } from "~/lib/bill-utils";
import { UNGROUPED_COLOR, colorForOrder } from "~/lib/group-colors";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import type { BillEvent, Group } from "~/types";

function formatPHP(value: number, signDisplay?: "always") {
  return value.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    signDisplay,
  });
}

type BillRow = BillEvent & { date: Date };

type Section = {
  group: Group | null;
  bills: BillRow[];
};

function buildSections(bills: BillRow[], groups: Group[]): Section[] {
  const groupIds = new Set(groups.map((g) => g._id));
  const groupSections: Section[] = groups.map((g) => ({
    group: g,
    bills: bills.filter((b) => b.groupId === g._id),
  }));
  // Bills with no groupId — and bills referencing a missing group — fall here,
  // so the sum of section subtotals always equals the card's outgoing total.
  const ungrouped: Section = {
    group: null,
    bills: bills.filter((b) => !b.groupId || !groupIds.has(b.groupId)),
  };
  return [...groupSections, ungrouped].filter((s) => s.bills.length > 0);
}

function BillRowItem({
  bill,
  payDate,
  isExcluded,
  onClick,
  onToggleExclude,
}: {
  bill: BillRow;
  payDate: Date;
  isExcluded: boolean;
  onClick: () => void;
  onToggleExclude: () => void;
}) {
  const isDue = isEqual(bill.date, payDate);

  return (
    <li
      className={cn(
        "group relative -mx-2 flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-amber-50/40 dark:hover:bg-amber-500/5",
        isExcluded && "opacity-40",
      )}
      onClick={onClick}
    >
      {/* Eye toggle — hidden until hover; always visible when excluded */}
      <button
        type="button"
        className={cn(
          "shrink-0 transition-all",
          isExcluded
            ? "opacity-100 text-muted-foreground/60"
            : "opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-muted-foreground",
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
              "text-[11px]",
              isDue
                ? "text-amber-700 dark:text-amber-300"
                : "text-muted-foreground",
            )}
          >
            {isDue && (
              <span className="mr-1 inline-block size-2 rounded-full bg-amber-400 dark:bg-amber-500 align-middle opacity-80" />
            )}
            {formatDate(bill.date, "MMM d")}
          </div>
        )}
      </div>

      {/* Amount — fixed-width right-aligned column */}
      <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums tracking-tight">
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

function BillListCard({
  bills,
  groups,
  payDate,
  after,
  isCurrent,
  ingoing,
  onBillClick,
}: {
  bills: BillRow[];
  groups: Group[];
  payDate: Date;
  after: Date | null;
  isCurrent: boolean;
  ingoing: number;
  onBillClick: (billId: string) => void;
}) {
  const [excludedBills, setExcludedBills] = useState<string[]>([]);

  const sections = useMemo(
    () => buildSections(bills, groups),
    [bills, groups],
  );

  const outgoing = useMemo(
    () =>
      sumBy(
        bills.filter((bill) => !excludedBills.includes(bill._id)),
        (bill) => bill.amount ?? 0,
      ),
    [bills, excludedBills],
  );

  const balance = ingoing - outgoing;

  const toggleExclude = (billId: string) => {
    setExcludedBills((prev) =>
      prev.includes(billId)
        ? prev.filter((id) => id !== billId)
        : [...prev, billId],
    );
  };

  const subtotalFor = (sectionBills: BillRow[]) =>
    sumBy(
      sectionBills.filter((b) => !excludedBills.includes(b._id)),
      (b) => b.amount ?? 0,
    );

  const dateLabel = after
    ? `${formatDate(payDate, "MMM d")} – ${formatDate(subDays(after, 1), "MMM d, yyyy")}`
    : formatDate(payDate, "MMM d, yyyy");

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-3xl border border-border/40 bg-card transition-shadow",
        "shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_-6px_rgba(0,0,0,0.12)]",
        // Warm tint layered over card surface
        "bg-[linear-gradient(oklch(0.98_0.01_60/_0.35),oklch(0.98_0.01_60/_0.35))] dark:bg-[linear-gradient(oklch(0.22_0.01_40/_0.08),oklch(0.22_0.01_40/_0.08))]",
        isCurrent &&
          "ring-2 ring-amber-200/70 dark:ring-amber-500/20",
      )}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        {/* Date eyebrow row — current badge lives here */}
        <div className="mb-1.5 flex items-center gap-2">
          <p className="text-sm text-muted-foreground tabular-nums">
            {dateLabel}
          </p>
          {isCurrent && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              This period
            </span>
          )}
        </div>

        {/* Balance */}
        <p
          className={cn(
            "text-3xl font-semibold tabular-nums tracking-tight",
            balance > 0
              ? "text-teal-700 dark:text-teal-300"
              : balance < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-foreground",
          )}
        >
          {formatPHP(balance, "always")}
        </p>

        {/* Caption */}
        <p className="text-muted-foreground mt-1 text-xs tabular-nums">
          {formatPHP(ingoing)} coming in, {formatPHP(outgoing)} going out
        </p>
      </div>

      {/* Sections */}
      <div className="flex-1 px-5 pb-5">
        {bills.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Sparkles className="size-5 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              Nothing due this period
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {sections.map((section, idx) => {
              const subtotal = subtotalFor(section.bills);
              const swatchColor = section.group
                ? colorForOrder(section.group.order)
                : UNGROUPED_COLOR;
              const label = section.group ? section.group.name : "Ungrouped";
              const billCount = section.bills.length;

              return (
                <div
                  key={section.group?._id ?? "__ungrouped__"}
                  className={cn(idx > 0 && "border-t border-border/40 pt-5")}
                >
                  {/* Section header */}
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {/* Swatch with soft halo */}
                      <span className="relative inline-flex shrink-0 items-center justify-center">
                        <span
                          className="absolute size-4 rounded-full opacity-20"
                          style={{ backgroundColor: swatchColor }}
                        />
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: swatchColor }}
                        />
                      </span>
                      <span className="text-foreground text-sm font-semibold">
                        {label}
                      </span>
                      <span className="ml-0.5 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                        {billCount}
                      </span>
                    </div>
                    <span className="w-24 text-right text-sm font-medium tabular-nums tracking-tight">
                      {formatPHP(subtotal)}
                    </span>
                  </div>

                  {/* Bill rows */}
                  <ul>
                    {section.bills.map((bill) => (
                      <BillRowItem
                        key={bill._id}
                        bill={bill}
                        payDate={payDate}
                        isExcluded={excludedBills.includes(bill._id)}
                        onClick={() => onBillClick(bill._id)}
                        onToggleExclude={() => toggleExclude(bill._id)}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function BillList() {
  const { data: bills } = api.bill.getAll.useQuery();
  const { data: incomeProfile } = api.income.getIncomeProfile.useQuery();
  const { data: groups } = api.group.getAll.useQuery();
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  if (!incomeProfile || !bills || !groups) return null;

  const billsInPayPeriod = getBillsByPayPeriod(bills, incomeProfile);
  const ingoing = incomeProfile.amount ?? 0;

  const handleBillClick = (billId: string) => {
    setSelectedBillId(billId);
    setModalOpen(true);
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {billsInPayPeriod.map(({ payDate, bills, after }, index) => (
          <BillListCard
            key={index}
            payDate={payDate}
            bills={bills}
            groups={groups}
            after={after}
            isCurrent={index === 0}
            ingoing={ingoing}
            onBillClick={handleBillClick}
          />
        ))}
      </div>

      <BillModal
        billId={selectedBillId}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
