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

const navLinks: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/groups", label: "Groups", icon: FolderTree },
  { href: "/playground", label: "Playground", icon: FlaskConical },
];

export function AuthenticatedLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background/80 sticky top-0 z-50 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Receipt className="size-5" />
              <span>Remind Me Bills</span>
            </Link>
            <nav className="hidden items-center gap-4 sm:flex">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1 text-sm font-medium transition-colors hover:text-foreground ${
                    pathname === href
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {Icon && <Icon className="size-3.5" />}
                  {label}
                </Link>
              ))}
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
                  <SheetTitle className="flex items-center gap-2">
                    <Receipt className="size-5" />
                    Remind Me Bills
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-6">
                  {navLinks.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
                        pathname === href
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {Icon && <Icon className="size-4" />}
                      {label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
            <UserNav />
          </div>
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
