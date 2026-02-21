"use client";

import { CalendarPlus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { FinancialSummaryCards } from "~/components/financialSummaryCards";
import type { BillEvent, PlaygroundBill, PlaygroundBillData } from "~/types";
import { PlaygroundBanner } from "./playgroundBanner";
import { PlaygroundBillFormDialog } from "./playgroundBillFormDialog";
import { PlaygroundBillList } from "./playgroundBillList";
import { PlaygroundBillModal } from "./playgroundBillModal";
import { usePlayground, usePlaygroundDispatch } from "./playgroundContext";
import { Button } from "./ui/button";

export function PlaygroundWorkspace() {
  const { bills, incomeProfile } = usePlayground();
  const dispatch = usePlaygroundDispatch();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<PlaygroundBill | null>(null);
  const [billModalOpen, setBillModalOpen] = useState(false);

  if (!incomeProfile) return null;

  // Convert PlaygroundBill[] to BillEvent[] for FinancialSummaryCards.
  // The component only reads bill.type, bill.date, bill.recurrence, bill.amount,
  // and bill.title — none of which require _id or userId.
  const billsAsBillEvent = bills.map((bill) => ({
    ...bill,
    _id: bill.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userId: null as any,
  })) as unknown as BillEvent[];

  const handleAddBill = (bill: PlaygroundBill) => {
    dispatch({ type: "ADD_BILL", bill });
  };

  const handleBillClick = (billId: string) => {
    const bill = bills.find((b) => b.id === billId);
    if (bill) {
      setSelectedBill(bill);
      setBillModalOpen(true);
    }
  };

  const handleUpdateBill = (id: string, data: PlaygroundBillData) => {
    dispatch({ type: "UPDATE_BILL", id, data });
    // Refresh selected bill reference with updated data
    setSelectedBill({ ...data, id });
  };

  const handleDeleteBill = (id: string) => {
    dispatch({ type: "DELETE_BILL", id });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PlaygroundBanner />

      <FinancialSummaryCards
        incomeProfile={incomeProfile}
        bills={billsAsBillEvent}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Bills by Pay Period</h2>
        <Button size="sm" onClick={() => setAddDialogOpen(true)}>
          Add Bill <CalendarPlus className="ml-1 size-4" />
        </Button>
      </div>

      {bills.length > 0 ? (
        <PlaygroundBillList
          bills={bills}
          incomeProfile={incomeProfile}
          onBillClick={handleBillClick}
        />
      ) : (
        <div className="flex flex-col items-center rounded-lg border border-dashed py-12">
          <CalendarPlus className="text-muted-foreground mb-3 size-10" />
          <h3 className="text-lg font-medium">No bills yet</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Add a hypothetical bill to see how it affects your budget.
          </p>
          <Button className="mt-4" onClick={() => setAddDialogOpen(true)}>
            Add Bill <CalendarPlus className="ml-1 size-4" />
          </Button>
        </div>
      )}

      <div className="flex justify-center pt-4">
        <Button variant="outline" onClick={() => dispatch({ type: "RESET" })}>
          <RotateCcw className="mr-2 size-4" />
          Reset Playground
        </Button>
      </div>

      <PlaygroundBillFormDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAddBill}
      />

      <PlaygroundBillModal
        bill={selectedBill}
        open={billModalOpen}
        onOpenChange={setBillModalOpen}
        onUpdate={handleUpdateBill}
        onDelete={handleDeleteBill}
      />
    </div>
  );
}
