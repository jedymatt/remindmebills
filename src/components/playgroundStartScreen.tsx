"use client";

import { FlaskConical, Copy, FileText } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { api } from "~/trpc/react";
import { usePlaygroundDispatch } from "./playgroundContext";
import type { IncomeProfile } from "~/types";

interface PlaygroundStartScreenProps {
  incomeProfile: IncomeProfile;
}

export function PlaygroundStartScreen({
  incomeProfile,
}: PlaygroundStartScreenProps) {
  const dispatch = usePlaygroundDispatch();
  const { data: bills, isLoading: isBillsLoading } = api.bill.getAll.useQuery();

  const handleStartFresh = () => {
    dispatch({ type: "INIT_FRESH", incomeProfile });
  };

  const handleCloneBills = () => {
    dispatch({ type: "INIT_CLONE", incomeProfile, bills: bills ?? [] });
  };

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <FlaskConical className="text-muted-foreground mb-4 size-12" />
      <h1 className="text-2xl font-bold">Financial Playground</h1>
      <p className="text-muted-foreground mt-2 max-w-md text-center">
        Experiment with &quot;what-if&quot; scenarios. Add hypothetical bills to
        see how they&apos;d affect your budget. Nothing is saved.
      </p>

      <div className="mt-8 grid w-full max-w-lg gap-4 sm:grid-cols-2">
        <Card
          className="cursor-pointer transition-colors hover:border-primary"
          onClick={handleStartFresh}
        >
          <CardHeader className="pb-2">
            <FileText className="text-primary mb-2 size-8" />
            <CardTitle className="text-lg">Start Fresh</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Begin with a blank slate. Add only the bills you want to simulate.
            </CardDescription>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "transition-colors",
            isBillsLoading
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer hover:border-primary",
          )}
          onClick={isBillsLoading ? undefined : handleCloneBills}
        >
          <CardHeader className="pb-2">
            <Copy className="text-primary mb-2 size-8" />
            <CardTitle className="text-lg">Clone My Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Start with a copy of your current bills, then add hypothetical
              expenses.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
