"use client";

import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BillList } from "~/app/_components/billList";
import { Button } from "./ui/button";

const authClient = createAuthClient();

export function DashboardPage() {
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
        <BillList />
      </div>
    </div>
  );
}
