"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type PropsWithChildren } from "react";
import { Receipt } from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "~/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

function UserNav() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground hidden text-sm sm:inline">
        {session?.user?.name}
      </span>
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
                  .join("") ?? ""}
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
                  onSuccess: () => {
                    queryClient.clear();
                    router.push("/");
                  },
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
    </div>
  );
}

export function AuthenticatedLayout({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background/80 sticky top-0 z-50 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Receipt className="size-5" />
            <span>Remind Me Bills</span>
          </Link>
          <UserNav />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t px-4 py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 text-sm">
          <Receipt className="text-muted-foreground size-4" />
          <span className="text-muted-foreground">
            Remind Me Bills &copy; {new Date().getFullYear()}
          </span>
        </div>
      </footer>
    </div>
  );
}
