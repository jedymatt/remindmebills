"use client";

import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";
import { BillList } from "~/app/_components/billList";
import { IncomeProfileSetup } from "~/app/_components/incomeProfile";
import { api } from "~/trpc/react";
import { Button } from "./ui/button";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";

const authClient = createAuthClient();

export function DashboardPage() {
  const { data: incomeProfile, isLoading: isIncomeProfileLoading } =
    api.income.getIncomeProfile.useQuery();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex min-h-14 items-center border-b px-6 shadow">
        <Button
          variant="link"
          className="ml-auto"
          onClick={async () => {
            setIsSigningOut(true);
            await authClient.signOut({
              fetchOptions: {
                onSuccess: () => router.push("/"),
              },
            });
            setIsSigningOut(false);
          }}
          disabled={isSigningOut}
        >
          Sign out
        </Button>
      </nav>
      <div className="flex-grow p-6">
        {isIncomeProfileLoading && (
          <div className="flex items-center justify-center">
            <LoaderCircle className="animate-spin" />
          </div>
        )}
        {!isIncomeProfileLoading && incomeProfile && <BillList />}
        {!isIncomeProfileLoading && !incomeProfile && (
          <div className="flex items-center justify-center">
            <div className="max-auto w-full max-w-md">
              <IncomeProfileSetup />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
