"use client";

import { BillList } from "~/app/_components/billList";
import { api } from "~/trpc/react";
import { AuthenticatedLayout } from "./authenticatedLayout";
import { IncomeProfileSetup } from "./createIncomeProfileForm";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Skeleton } from "./ui/skeleton";

export function DashboardPage() {
  const { data: incomeProfile, isLoading } =
    api.income.getIncomeProfile.useQuery();

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="space-y-4 p-6">
          <Skeleton className="h-9 w-24" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Card key={index} className="h-auto">
                <CardHeader>
                  <CardTitle>
                    <Skeleton className="h-5 w-1/2" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 space-y-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="space-y-0.5">
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
      </AuthenticatedLayout>
    );
  }

  if (!incomeProfile) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center py-16">
          <div className="max-auto w-full max-w-md">
            <IncomeProfileSetup />
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }
  return (
    <AuthenticatedLayout>
      <BillList />
    </AuthenticatedLayout>
  );
}
