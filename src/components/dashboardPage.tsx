"use client";

import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BillList } from "~/app/_components/billList";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

const authClient = createAuthClient();

function UserNav() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={"ghost"} className="h-8 w-8 rounded-full">
          <Avatar>
            <AvatarImage src={session?.user?.image ?? undefined} />
            <AvatarFallback>
              {session?.user?.name
                .toUpperCase()
                .split(" ")
                .map((i) => i.slice(0, 1))
                .slice(0, 2)
                .join("") ?? "..."}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={"end"} className="w-[200px]">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
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
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex h-14 items-center justify-end border-b px-6">
        <UserNav />
      </nav>
      <div className="flex-grow p-6">
        <BillList />
      </div>
    </div>
  );
}
