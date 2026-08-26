"use client";

import { CreditCard, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import type { BnplAccount } from "~/types";
import { AuthenticatedLayout } from "./authenticatedLayout";
import {
  BnplAccountFormDialog,
  type AccountFormValues,
} from "./bnplAccountFormDialog";
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
            {accounts.map((account) => (
              <div
                key={account._id}
                className="border-border/40 bg-card flex items-center justify-between rounded-3xl border p-5"
              >
                <div>
                  <p className="text-foreground font-semibold">
                    {account.name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Due day {account.dueDay}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Edit account"
                    onClick={() => setEditing(account)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete account"
                    onClick={() => setDeleting(account)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
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
    </AuthenticatedLayout>
  );
}
