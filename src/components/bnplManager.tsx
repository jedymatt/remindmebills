"use client";

import { addMonths } from "date-fns";
import { CreditCard, Loader2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { computeBillsInPeriod, partitionBills } from "~/lib/bill-utils";
import { groupStatements, type Statement } from "~/lib/bnpl-utils";
import { localDateToUtcDateOnly } from "~/lib/date-utils";
import { buildPaidLookup, occurrenceKey } from "~/lib/payment-utils";
import { api } from "~/trpc/react";
import type { BillEvent, BnplAccount } from "~/types";
import { AuthenticatedLayout } from "./authenticatedLayout";
import { BnplAccountCard } from "./bnplAccountCard";
import {
  BnplAccountFormDialog,
  type AccountFormValues,
} from "./bnplAccountFormDialog";
import {
  BnplPurchaseFormDialog,
  type PurchaseFormValues,
} from "./bnplPurchaseFormDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="border-ledger-line flex flex-col items-center rounded-lg border border-dashed py-12">
      <span className="bg-ledger-accent-soft text-ledger-accent-strong mb-3 flex size-11 items-center justify-center rounded-2xl">
        <CreditCard className="size-5" />
      </span>
      <h3 className="text-ledger-ink font-display text-lg">No BNPL accounts</h3>
      <p className="text-ledger-muted mt-1 text-sm">
        Add an account to track its installments separately from your bills.
      </p>
      <Button className="mt-4" onClick={onAdd}>
        New Account <Plus className="ml-1 size-4" />
      </Button>
    </div>
  );
}

export function BnplManager() {
  const utils = api.useUtils();
  const { data: accounts, isLoading } = api.bnpl.getAll.useQuery();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BnplAccount | null>(null);
  const [deleting, setDeleting] = useState<BnplAccount | null>(null);

  // Both confirmation dialogs name a purchase count so their consequence is
  // concrete. Read from the shared bill list rather than a dedicated endpoint —
  // the page already needs those rows in Task 8.
  const { data: allBills } = api.bill.getAll.useQuery();
  const purchaseCountFor = (accountId: string) =>
    (allBills ?? []).filter((b) => b.bnplAccountId === accountId).length;

  const deletingPurchaseCount = deleting ? purchaseCountFor(deleting._id) : 0;

  const { data: payments } = api.payment.getAll.useQuery();

  const paidKeys = useMemo(() => buildPaidLookup(payments ?? []), [payments]);

  // Statements are read off the same occurrence generator the dashboard uses,
  // rather than re-deriving dates here — one scheduler, one set of clamping
  // rules. A 14-month window is enough to always contain the next statement.
  const { purchasesByAccount, statementByAccount } = useMemo(() => {
    const { installments } = partitionBills(allBills ?? []);
    // Already UTC midnight — localDateToUtcDateOnly maps today's local
    // calendar day onto the canonical frame the scheduler anchors on.
    const windowStart = localDateToUtcDateOnly(new Date());
    const occurrences = computeBillsInPeriod(
      installments,
      windowStart,
      addMonths(windowStart, 14),
    );
    const statements = groupStatements(occurrences, accounts ?? []);

    const purchasesByAccount = new Map<string, BillEvent[]>();
    for (const purchase of installments) {
      if (!purchase.bnplAccountId) continue;
      const list = purchasesByAccount.get(purchase.bnplAccountId) ?? [];
      list.push(purchase);
      purchasesByAccount.set(purchase.bnplAccountId, list);
    }

    // The first statement per account is the current one, since groupStatements
    // sorts by date and the window starts today.
    const statementByAccount = new Map<string, (typeof statements)[number]>();
    for (const statement of statements) {
      if (!statementByAccount.has(statement.accountId)) {
        statementByAccount.set(statement.accountId, statement);
      }
    }

    return { purchasesByAccount, statementByAccount };
  }, [allBills, accounts]);

  // A changed due day rewrites every existing purchase's schedule, which moves
  // due dates the user may have set months ago. Held here until confirmed.
  const [pendingDueDay, setPendingDueDay] = useState<{
    account: BnplAccount;
    values: AccountFormValues;
  } | null>(null);

  const invalidate = () =>
    Promise.all([
      utils.bnpl.getAll.invalidate(),
      utils.bill.getAll.invalidate(),
      utils.payment.getAll.invalidate(),
    ]);

  const createMut = api.bnpl.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Account created");
      setCreateOpen(false);
    },
    onError: (e) => toast.error(e.message || "Failed to create account"),
  });

  const updateMut = api.bnpl.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Account updated");
      setEditing(null);
      setPendingDueDay(null);
    },
    onError: (e) => toast.error(e.message || "Failed to update account"),
  });

  // Saving an edit only prompts when the due day actually changed *and* there
  // are purchases to move. A rename, or a due-day change on an empty account,
  // saves straight through — a dialog with nothing at stake is just friction.
  const handleEditSubmit = (values: AccountFormValues) => {
    if (!editing) return;

    const movesPurchases =
      values.dueDay !== editing.dueDay && purchaseCountFor(editing._id) > 0;

    if (movesPurchases) {
      setPendingDueDay({ account: editing, values });
      return;
    }

    updateMut.mutate({ id: editing._id, data: values });
  };

  const deleteMut = api.bnpl.delete.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Account deleted");
      setDeleting(null);
    },
    onError: (e) => toast.error(e.message || "Failed to delete account"),
  });

  const [purchaseTarget, setPurchaseTarget] = useState<{
    account: BnplAccount;
    purchase?: BillEvent;
  } | null>(null);
  const [deletingPurchase, setDeletingPurchase] = useState<BillEvent | null>(
    null,
  );
  const [pendingStatements, setPendingStatements] = useState<Set<string>>(
    new Set(),
  );

  const createPurchaseMut = api.bnpl.createPurchase.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Purchase added");
      setPurchaseTarget(null);
    },
    onError: (e) => toast.error(e.message || "Failed to add purchase"),
  });

  const updatePurchaseMut = api.bnpl.updatePurchase.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Purchase updated");
      setPurchaseTarget(null);
    },
    onError: (e) => toast.error(e.message || "Failed to update purchase"),
  });

  const deletePurchaseMut = api.bnpl.deletePurchase.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Purchase deleted");
      setDeletingPurchase(null);
    },
    onError: (e) => toast.error(e.message || "Failed to delete purchase"),
  });

  const markStatementPaid = api.payment.markStatementPaid.useMutation();
  const markStatementUnpaid = api.payment.markStatementUnpaid.useMutation();

  // A statement is paid only when every purchase on it is paid, so a purchase
  // added after settling correctly flips it back to unpaid.
  const isStatementPaid = (statement: Statement) =>
    statement.billIds.every((billId) =>
      paidKeys.has(occurrenceKey(billId, statement.date)),
    );

  const handleToggleStatement = (statement: Statement) => {
    const key = `${statement.accountId}:${statement.date.getTime()}`;
    const currentlyPaid = isStatementPaid(statement);
    setPendingStatements((prev) => new Set(prev).add(key));
    const clearPending = () =>
      setPendingStatements((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });

    const mutation = currentlyPaid ? markStatementUnpaid : markStatementPaid;
    mutation.mutate(
      {
        accountId: statement.accountId,
        statementDate: statement.date,
        billIds: statement.billIds,
      },
      {
        onSuccess: () =>
          void utils.payment.getAll.invalidate().finally(clearPending),
        onError: (error) => {
          toast.error(error.message || "Failed to update statement");
          clearPending();
        },
      },
    );
  };

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-ledger-ink font-display text-xl">BNPL</h1>
          {accounts && accounts.length > 0 && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              New Account <Plus className="ml-1 size-4" />
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-3xl" />
            ))}
          </div>
        ) : !accounts || accounts.length === 0 ? (
          <EmptyState onAdd={() => setCreateOpen(true)} />
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => {
              const statement = statementByAccount.get(account._id) ?? null;
              const statementKey = statement
                ? `${statement.accountId}:${statement.date.getTime()}`
                : "";

              return (
                <BnplAccountCard
                  key={account._id}
                  account={account}
                  purchases={purchasesByAccount.get(account._id) ?? []}
                  statement={statement}
                  isStatementPaid={
                    statement ? isStatementPaid(statement) : false
                  }
                  isStatementPending={pendingStatements.has(statementKey)}
                  onToggleStatementPaid={() =>
                    statement && handleToggleStatement(statement)
                  }
                  onEditAccount={() => setEditing(account)}
                  onDeleteAccount={() => setDeleting(account)}
                  onAddPurchase={() => setPurchaseTarget({ account })}
                  onEditPurchase={(purchase) =>
                    setPurchaseTarget({ account, purchase })
                  }
                  onDeletePurchase={setDeletingPurchase}
                />
              );
            })}
          </div>
        )}
      </div>

      <BnplAccountFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(values) => createMut.mutate(values)}
        isPending={createMut.isPending}
      />

      <BnplAccountFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        account={editing ?? undefined}
        onSubmit={handleEditSubmit}
        isPending={updateMut.isPending}
      />

      {/* Rendered above the still-open edit dialog, so cancelling returns to
          the form with its values intact rather than discarding the edit. */}
      <AlertDialog
        open={pendingDueDay !== null}
        onOpenChange={(open) => !open && setPendingDueDay(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move the statement day?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDueDay &&
                `${purchaseCountFor(pendingDueDay.account._id)} existing purchase${
                  purchaseCountFor(pendingDueDay.account._id) === 1 ? "" : "s"
                } will move from day ${pendingDueDay.account.dueDay} to day ${
                  pendingDueDay.values.dueDay
                }. Every statement date for this account changes to match, so it
                stays a single monthly statement.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateMut.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (pendingDueDay)
                  updateMut.mutate({
                    id: pendingDueDay.account._id,
                    data: pendingDueDay.values,
                  });
              }}
              disabled={updateMut.isPending}
            >
              {updateMut.isPending && (
                <Loader2 className="mr-1 size-4 animate-spin" />
              )}
              Move purchases
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingPurchaseCount === 0
                ? "This account has no purchases."
                : `This account has ${deletingPurchaseCount} purchase${
                    deletingPurchaseCount === 1 ? "" : "s"
                  }. Choose what happens to them.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* Two outcomes rather than one default: deleting destroys purchase
              and payment history, while keeping destroys nothing and only puts
              those rows back in the bill list. Neither is obviously right, so
              the choice is made here, in view of the count. */}
          <AlertDialogFooter className="sm:flex-col sm:gap-2">
            <AlertDialogAction
              className="w-full"
              onClick={(e) => {
                e.preventDefault();
                if (deleting)
                  deleteMut.mutate({ id: deleting._id, purchases: "keep" });
              }}
              disabled={deleteMut.isPending || deletingPurchaseCount === 0}
            >
              Keep purchases as ordinary bills
            </AlertDialogAction>
            <AlertDialogAction
              className="w-full"
              onClick={(e) => {
                e.preventDefault();
                if (deleting)
                  deleteMut.mutate({ id: deleting._id, purchases: "delete" });
              }}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending && (
                <Loader2 className="mr-1 size-4 animate-spin" />
              )}
              {deletingPurchaseCount === 0
                ? "Delete account"
                : "Delete purchases too"}
            </AlertDialogAction>
            <AlertDialogCancel
              className="w-full"
              disabled={deleteMut.isPending}
            >
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BnplPurchaseFormDialog
        open={purchaseTarget !== null}
        onOpenChange={(open) => !open && setPurchaseTarget(null)}
        accountName={purchaseTarget?.account.name ?? ""}
        initialValues={
          purchaseTarget?.purchase?.type === "recurring"
            ? {
                title: purchaseTarget.purchase.title,
                amount: purchaseTarget.purchase.amount ?? 0,
                tenureMonths: purchaseTarget.purchase.recurrence.count ?? 1,
                firstDueMonth: purchaseTarget.purchase.recurrence.dtstart,
              }
            : undefined
        }
        onSubmit={(values: PurchaseFormValues) => {
          if (!purchaseTarget) return;
          if (purchaseTarget.purchase) {
            updatePurchaseMut.mutate({
              id: purchaseTarget.purchase._id,
              data: values,
            });
          } else {
            createPurchaseMut.mutate({
              accountId: purchaseTarget.account._id,
              ...values,
            });
          }
        }}
        isPending={createPurchaseMut.isPending || updatePurchaseMut.isPending}
      />

      <AlertDialog
        open={deletingPurchase !== null}
        onOpenChange={(open) => !open && setDeletingPurchase(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deletingPurchase?.title}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the purchase and its payment history. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePurchaseMut.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deletingPurchase)
                  deletePurchaseMut.mutate({ id: deletingPurchase._id });
              }}
              disabled={deletePurchaseMut.isPending}
            >
              {deletePurchaseMut.isPending && (
                <Loader2 className="mr-1 size-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AuthenticatedLayout>
  );
}
