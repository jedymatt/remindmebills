"use client";

import { formatDate, isEqual, subDays } from "date-fns";
import { sumBy } from "lodash";
import { ChevronDown, ChevronUp, EyeClosedIcon, EyeIcon } from "lucide-react";
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
  return (
    <li
      className={cn(
        "flex cursor-pointer items-center gap-3 py-3 transition-colors hover:bg-muted/50",
        isEqual(bill.date, payDate) && "text-yellow-700 dark:text-yellow-500",
        isExcluded && "opacity-40",
      )}
      onClick={onClick}
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onToggleExclude();
        }}
      >
        {isExcluded ? (
          <EyeClosedIcon className="size-4" />
        ) : (
          <EyeIcon className="size-4" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{bill.title}</div>
        {!isExcluded && (
          <div className="text-muted-foreground text-xs">
            Due {formatDate(bill.date, "MMM d")}
          </div>
        )}
      </div>
      {!isExcluded && (
        <span className="shrink-0 text-sm font-medium tabular-nums">
          {bill.amount != null ? (
            formatPHP(bill.amount)
          ) : (
            <span className="text-muted-foreground text-xs font-normal">
              —
            </span>
          )}
        </span>
      )}
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
  const [showBreakdown, setShowBreakdown] = useState(false);

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

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border",
        isCurrent
          ? "ring-primary/20 border-primary/50 ring-2"
          : "border-border",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-5 py-3.5",
          isCurrent ? "bg-primary/5" : "bg-muted/30",
        )}
      >
        <div>
          <div className="text-sm font-semibold">
            {formatDate(payDate, "MMM d")}
            {after && <> – {formatDate(subDays(after, 1), "MMM d, yyyy")}</>}
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {bills.length} {bills.length === 1 ? "bill" : "bills"}
          </div>
        </div>
        {isCurrent && (
          <span className="bg-primary text-primary-foreground rounded-full px-2.5 py-0.5 text-[11px] font-medium">
            Current
          </span>
        )}
      </div>

      {/* Sections */}
      <div className="flex-1 px-5 py-2">
        {bills.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No bills this period
          </p>
        ) : (
          <div className="space-y-3">
            {sections.map((section) => {
              const subtotal = subtotalFor(section.bills);
              const swatchColor = section.group
                ? colorForOrder(section.group.order)
                : UNGROUPED_COLOR;
              const label = section.group ? section.group.name : "Ungrouped";
              return (
                <div
                  key={section.group?._id ?? "__ungrouped__"}
                  className="border-l-[3px] pl-3"
                  style={{ borderLeftColor: swatchColor }}
                >
                  <div className="flex items-center justify-between pt-1">
                    <span
                      className="text-sm font-medium"
                      style={{ color: swatchColor }}
                    >
                      {label}
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {formatPHP(subtotal)}
                    </span>
                  </div>
                  <ul className="divide-y">
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

      {/* Summary footer */}
      {bills.length > 0 && (
        <div className="bg-muted/30 border-t px-5 py-3">
          <button
            type="button"
            className="flex w-full items-center justify-between"
            onClick={() => setShowBreakdown((prev) => !prev)}
          >
            <span className="text-muted-foreground text-xs">Balance</span>
            <span className="flex items-center gap-1">
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  balance > 0
                    ? "text-green-600 dark:text-green-400"
                    : balance < 0
                      ? "text-red-600 dark:text-red-400"
                      : "",
                )}
              >
                {formatPHP(balance, "always")}
              </span>
              {showBreakdown ? (
                <ChevronUp className="text-muted-foreground size-3.5" />
              ) : (
                <ChevronDown className="text-muted-foreground size-3.5" />
              )}
            </span>
          </button>
          {showBreakdown && (
            <div className="text-muted-foreground mt-2 space-y-1 border-t pt-2 text-xs">
              <div className="flex justify-between">
                <span>Income</span>
                <span className="tabular-nums">
                  {formatPHP(ingoing, "always")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Bills</span>
                <span className="tabular-nums">
                  {formatPHP(-outgoing, "always")}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
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
