"use client";

import { isSameDay, subDays } from "date-fns";
import { sumBy } from "lodash";
import {
  Circle,
  CircleCheckBig,
  CreditCard,
  EyeClosedIcon,
  EyeIcon,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BillModal } from "~/components/billModal";
import { getPayPeriodsByCount, partitionBills } from "~/lib/bill-utils";
import { groupStatements } from "~/lib/bnpl-utils";
import { formatUtcDate } from "~/lib/date-utils";
import { buildPaidLookup, occurrenceKey } from "~/lib/payment-utils";
import { UNGROUPED_COLOR, colorForOrder } from "~/lib/group-colors";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import type { BillEvent, BnplAccount, Group } from "~/types";

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

      {/* Eye toggle — always visible when excluded. Otherwise visible by
          default (so it's reachable on touch), and only reveal-on-hover on
          devices that actually support hover. */}
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

      {/* Amount — fixed-width right-aligned column; struck through when paid */}
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

function BillListCard({
  bills,
  groups,
  accounts,
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
  accounts: BnplAccount[];
  payDate: Date;
  after: Date | null;
  isCurrent: boolean;
  ingoing: number;
  paidKeys: Set<string>;
  pendingKeys: Set<string>;
  onBillClick: (billId: string) => void;
  onTogglePaid: (bill: BillRow) => void;
}) {
  const [excludedBills, setExcludedBills] = useState<string[]>([]);

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

  // Paid bills and installments both stay in this sum rather than dropping out:
  // paid shows as a struck row instead (balance is income−all-bills, not "cash
  // left" — "remaining to pay" lives in the summary cards), and installments are
  // itemized as one roll-up row per account below, so section subtotals plus
  // statement amounts still equal `outgoing`.
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
    ? `${formatUtcDate(payDate, "MMM d")} – ${formatUtcDate(subDays(after, 1), "MMM d, yyyy")}`
    : formatUtcDate(payDate, "MMM d, yyyy");

  return (
    <div
      className={cn(
        "border-border/40 bg-card relative flex flex-col overflow-hidden rounded-3xl border transition-shadow",
        "shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_-6px_rgba(0,0,0,0.12)]",
        isCurrent && "ring-ledger-accent/40 dark:ring-ledger-accent/25 ring-2",
      )}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        {/* Date eyebrow row — current badge lives here */}
        <div className="mb-1.5 flex items-center gap-2">
          <p className="text-muted-foreground font-mono text-sm tabular-nums">
            {dateLabel}
          </p>
          {isCurrent && (
            <span className="bg-ledger-accent-soft text-ledger-accent-strong dark:bg-ledger-accent/15 dark:text-ledger-accent rounded-full px-2.5 py-0.5 text-[11px] font-medium">
              This period
            </span>
          )}
        </div>

        {/* Balance */}
        <p
          className={cn(
            "font-mono text-3xl font-semibold tracking-tight tabular-nums",
            balance > 0
              ? "text-teal-700 dark:text-teal-300"
              : balance < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-ledger-ink",
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
        {ordinaryBills.length === 0 && statements.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Sparkles className="text-muted-foreground/40 size-5" />
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
                  className={cn(idx > 0 && "border-border/40 border-t pt-5")}
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
                      <span className="bg-muted/60 text-muted-foreground ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                        {billCount}
                      </span>
                    </div>
                    <span className="w-24 text-right font-mono text-sm font-medium tracking-tight tabular-nums">
                      {formatPHP(subtotal)}
                    </span>
                  </div>

                  {/* Bill rows */}
                  <ul>
                    {section.bills.map((bill) => {
                      const key = occurrenceKey(bill._id, bill.date);
                      return (
                        <BillRowItem
                          key={key}
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
                  </ul>
                </div>
              );
            })}

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
          </div>
        )}
      </div>
    </div>
  );
}

const PERIODS_INITIAL = 9;
const PERIODS_PAGE = 9;

export function BillList() {
  const { data: bills } = api.bill.getAll.useQuery();
  const { data: incomeProfile } = api.income.getIncomeProfile.useQuery();
  const { data: groups } = api.group.getAll.useQuery();
  const { data: accounts } = api.bnpl.getAll.useQuery();
  const { data: payments } = api.payment.getAll.useQuery();
  const utils = api.useUtils();
  const markPaid = api.payment.markPaid.useMutation();
  const markUnpaid = api.payment.markUnpaid.useMutation();
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PERIODS_INITIAL);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const paidKeys = useMemo(() => buildPaidLookup(payments ?? []), [payments]);

  const billsInPayPeriod = useMemo(() => {
    if (!bills || !incomeProfile) return [];
    return getPayPeriodsByCount(bills, incomeProfile, visibleCount);
  }, [bills, incomeProfile, visibleCount]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => c + PERIODS_PAGE);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [billsInPayPeriod.length]);

  if (!incomeProfile || !bills || !groups || !accounts) return null;

  const ingoing = incomeProfile.amount ?? 0;

  const handleBillClick = (billId: string) => {
    setSelectedBillId(billId);
    setModalOpen(true);
  };

  const handleTogglePaid = (bill: BillRow) => {
    const key = occurrenceKey(bill._id, bill.date);
    const currentlyPaid = paidKeys.has(key);
    setPendingKeys((prev) => new Set(prev).add(key));
    const clearPending = () =>
      setPendingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    const mutation = currentlyPaid ? markUnpaid : markPaid;
    mutation.mutate(
      { billId: bill._id, occurrenceDate: bill.date },
      {
        // Keep the row disabled until the refetch lands (invalidate resolves
        // after it), not just the mutation response — otherwise paidKeys is
        // still stale when the button re-enables and a fast re-click fires the
        // same-direction mutation again.
        onSuccess: () =>
          void utils.payment.getAll.invalidate().finally(clearPending),
        onError: (error) => {
          toast.error(error.message || "Failed to update payment");
          clearPending();
        },
      },
    );
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
            accounts={accounts}
            after={after}
            isCurrent={index === 0}
            ingoing={ingoing}
            paidKeys={paidKeys}
            pendingKeys={pendingKeys}
            onBillClick={handleBillClick}
            onTogglePaid={handleTogglePaid}
          />
        ))}
      </div>

      <div ref={sentinelRef} aria-hidden className="h-1 w-full" />

      <BillModal
        billId={selectedBillId}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
