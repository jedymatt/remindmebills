"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type PropsWithChildren } from "react";
import {
  FlaskConical,
  FolderTree,
  LayoutDashboard,
  Menu,
  Receipt,
  type LucideIcon,
} from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/utils";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";

function Wordmark() {
  return (
    <span className="text-ledger-ink font-display flex items-center gap-2 text-lg font-medium">
      <span className="bg-ledger-ink text-ledger-paper flex size-7 items-center justify-center rounded-lg">
        <Receipt className="size-4" />
      </span>
      Remind Me Bills
    </span>
  );
}

function UserNav() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <span className="text-ledger-muted hidden text-sm sm:inline">
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

const navLinks: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/groups", label: "Groups", icon: FolderTree },
  { href: "/playground", label: "Playground", icon: FlaskConical },
];

export function AuthenticatedLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="bg-ledger-paper text-ledger-ink font-sans flex min-h-svh flex-col antialiased">
      <header className="border-ledger-line bg-ledger-paper/80 sticky top-0 z-50 w-full border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/">
              <Wordmark />
            </Link>
            <nav className="hidden items-center gap-4 sm:flex">
              {navLinks.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "text-ledger-accent-strong"
                        : "text-ledger-muted hover:text-ledger-ink",
                    )}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:hidden"
                  aria-label="Open navigation menu"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle asChild>
                    <span>
                      <Wordmark />
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-6">
                  {navLinks.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-ledger-accent-soft text-ledger-accent-strong"
                            : "text-ledger-muted hover:bg-ledger-accent-soft/50 hover:text-ledger-ink",
                        )}
                      >
                        <Icon className="size-4" />
                        {label}
                      </Link>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>
            <UserNav />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-ledger-line border-t px-4 py-8">
        <div className="text-ledger-muted mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-sm sm:flex-row">
          <div className="flex items-center gap-2">
            <Receipt className="size-4" />
            <span>Remind Me Bills</span>
          </div>
          <span>&copy; {new Date().getFullYear()} Remind Me Bills</span>
        </div>
      </footer>
    </div>
  );
}
