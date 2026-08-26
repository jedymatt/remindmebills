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
        <span className="bg-ledger-accent-soft text-ledger-accent-strong mb-4 flex size-12 items-center justify-center rounded-2xl">
          <Receipt className="size-6" />
        </span>
        <h2 className="text-ledger-ink font-display text-2xl">
          Set Up Your Income First
        </h2>
        <p className="text-ledger-muted mt-1 max-w-md text-center">
          To use the playground, you need to set up your income profile on the
          dashboard first.
        </p>
        <Link
          href="/dashboard"
          className="text-ledger-accent-strong mt-4 text-sm font-medium hover:underline"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

// Separated so incomeProfile can be passed as a concrete value,
// avoiding the non-null assertion that would be needed if reading from context.
function PlaygroundContent({
  incomeProfile,
}: {
  incomeProfile: IncomeProfile;
}) {
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

  // A one-shot flag meaning "past hydration", not state synchronization: the
  // skeleton below renders until it flips, so server and client produce
  // identical first-render HTML even when the React Query cache already holds
  // data from a previous navigation. The rule cannot tell a hydration probe
  // apart from a cascading-render mistake, so this exception is permanent.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration probe
    setMounted(true);
  }, []);

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
