"use client";

import { CalendarPlus, FileText, Receipt } from "lucide-react";
import Link from "next/link";
import { BillList } from "~/app/_components/billList";
import { api } from "~/trpc/react";
import { AuthenticatedLayout } from "./authenticatedLayout";
import { IncomeProfileSetup } from "./createIncomeProfileForm";
import { FinancialSummaryCards } from "./financialSummaryCards";
import { IncomeProfileSection } from "./incomeProfileSection";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Skeleton } from "./ui/skeleton";

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-2 p-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Income section skeleton */}
      <Skeleton className="h-14 w-full rounded-lg" />
      {/* Bill list skeleton */}
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="h-auto">
            <CardHeader>
              <CardTitle>
                <Skeleton className="h-5 w-1/2" />
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="space-y-0.5">
                  <Skeleton className="h-5 w-1/2" />
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter className="justify-end">
              <Skeleton className="h-5 w-1/3" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NoIncomeProfileState() {
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="flex flex-col items-center justify-center py-16">
        <Receipt className="text-muted-foreground mb-4 size-12" />
        <h2 className="text-2xl font-bold">Welcome to Remind Me Bills</h2>
        <p className="text-muted-foreground mt-1 text-center">
          Set up your income profile to get started tracking your bills.
        </p>
        <div className="mt-8 w-full max-w-md">
          <IncomeProfileSetup />
        </div>
      </div>
    </div>
  );
}

function NoBillsState() {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed py-12">
      <FileText className="text-muted-foreground mb-3 size-10" />
      <h3 className="text-lg font-medium">No bills yet</h3>
      <p className="text-muted-foreground mt-1 text-sm">
        Add your first bill to start tracking your expenses.
      </p>
      <Button asChild className="mt-4">
        <Link href="/bills/create">
          Add Bill <CalendarPlus className="ml-1 size-4" />
        </Link>
      </Button>
    </div>
  );
}

export function DashboardPage() {
  const { data: incomeProfile, isLoading: isIncomeLoading } =
    api.income.getIncomeProfile.useQuery();
  const { data: bills, isLoading: isBillsLoading } =
    api.bill.getAll.useQuery();

  const isLoading = isIncomeLoading || isBillsLoading;

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <DashboardSkeleton />
      </AuthenticatedLayout>
    );
  }

  if (!incomeProfile) {
    return (
      <AuthenticatedLayout>
        <NoIncomeProfileState />
      </AuthenticatedLayout>
    );
  }

  const hasBills = bills && bills.length > 0;

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <FinancialSummaryCards
          incomeProfile={incomeProfile}
          bills={bills ?? []}
        />
        <IncomeProfileSection incomeProfile={incomeProfile} />
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Bills by Pay Period</h2>
          <Button asChild size="sm">
            <Link href="/bills/create">
              New Bill <CalendarPlus className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
        {hasBills ? <BillList /> : <NoBillsState />}
      </div>
    </AuthenticatedLayout>
  );
}
