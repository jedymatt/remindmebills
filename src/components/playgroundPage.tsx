"use client";

import { Receipt } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import type { IncomeProfile } from "~/types";
import { AuthenticatedLayout } from "./authenticatedLayout";
import { PlaygroundProvider, usePlayground } from "./playgroundContext";
import { PlaygroundStartScreen } from "./playgroundStartScreen";
import { PlaygroundWorkspace } from "./playgroundWorkspace";
import { Card, CardContent } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

function PlaygroundSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
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
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

function NoIncomeProfileState() {
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="flex flex-col items-center justify-center py-16">
        <Receipt className="text-muted-foreground mb-4 size-12" />
        <h2 className="text-2xl font-bold">Set Up Your Income First</h2>
        <p className="text-muted-foreground mt-1 max-w-md text-center">
          To use the playground, you need to set up your income profile on the
          dashboard first.
        </p>
        <Link
          href="/dashboard"
          className="text-primary mt-4 text-sm font-medium hover:underline"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

// Separated so incomeProfile can be passed as a concrete value,
// avoiding the non-null assertion that would be needed if reading from context.
function PlaygroundContent({ incomeProfile }: { incomeProfile: IncomeProfile }) {
  const { isInitialized } = usePlayground();

  if (!isInitialized) {
    return <PlaygroundStartScreen incomeProfile={incomeProfile} />;
  }

  return <PlaygroundWorkspace />;
}

function PlaygroundPageInner() {
  const [mounted, setMounted] = useState(false);
  const { data: incomeProfile, isLoading } =
    api.income.getIncomeProfile.useQuery();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show skeleton on first render so server and client produce identical HTML,
  // preventing the hydration mismatch that occurs when the React Query cache
  // already has data from a previous page navigation.
  if (!mounted || isLoading) {
    return <PlaygroundSkeleton />;
  }

  if (!incomeProfile) {
    return <NoIncomeProfileState />;
  }

  return (
    <PlaygroundProvider>
      <PlaygroundContent incomeProfile={incomeProfile} />
    </PlaygroundProvider>
  );
}

export function PlaygroundPage() {
  return (
    <AuthenticatedLayout>
      <PlaygroundPageInner />
    </AuthenticatedLayout>
  );
}
