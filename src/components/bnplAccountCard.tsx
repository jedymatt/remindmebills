"use client";

import { Circle, CircleCheckBig, Pencil, Plus, Trash2 } from "lucide-react";
import { installmentProgress, type Statement } from "~/lib/bnpl-utils";
import { formatUtcDate, localDateToUtcDateOnly } from "~/lib/date-utils";
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
                  isStatementPaid
                    ? "Mark statement unpaid"
                    : "Mark statement paid"
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
              statement?.date ?? localDateToUtcDateOnly(new Date()),
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
