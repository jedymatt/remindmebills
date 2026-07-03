"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SVGProps } from "react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/utils";
import {
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle,
  LayoutDashboard,
  LogIn,
  PlusCircle,
  Receipt,
  Repeat,
  UserRound,
} from "lucide-react";

function SimpleIconsGoogle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      {/* Icon from Simple Icons by Simple Icons Collaborators - https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md */}
      <path
        fill="currentColor"
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133c-1.147 1.147-2.933 2.4-6.053 2.4c-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0C5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36c2.16-2.16 2.84-5.213 2.84-7.667c0-.76-.053-1.467-.173-2.053z"
      ></path>
    </svg>
  );
}

async function signInWithGoogle() {
  await authClient.signIn.social({
    provider: "google",
    callbackURL: "/dashboard",
  });
}

async function continueAsGuest() {
  await authClient.signIn.anonymous();
}

const features = [
  {
    icon: Bell,
    title: "One tidy list",
    description:
      "Every bill, due date, and amount together — nothing scattered across apps and inboxes.",
  },
  {
    icon: Repeat,
    title: "Recurring made simple",
    description:
      "Set a subscription once and it schedules itself every cycle, automatically.",
  },
  {
    icon: LayoutDashboard,
    title: "See what's coming",
    description:
      "A dashboard that shows what's due, and when, at a single glance.",
  },
  {
    icon: UserRound,
    title: "Start without an account",
    description:
      "Try the whole thing as a guest. Sign in with Google whenever you're ready.",
  },
] as const;

const steps = [
  {
    icon: LogIn,
    title: "Sign in",
    description: "Use Google, or jump straight in as a guest.",
  },
  {
    icon: PlusCircle,
    title: "Add your bills",
    description: "Enter each bill with its due date and amount.",
  },
  {
    icon: CheckCircle,
    title: "Stay ahead",
    description: "See what's next and never miss a payment.",
  },
] as const;

type UpcomingBill = {
  name: string;
  category: string;
  due: string;
  amount: number;
};

// The hero's signature element: a calm, ordered view of what's due — the
// product's actual value shown rather than described. Amounts are numbers so
// the total below stays a single source of truth.
const upcomingBills: UpcomingBill[] = [
  { name: "Rent", category: "Housing", due: "Jul 5", amount: 1450 },
  { name: "Spotify", category: "Subscription", due: "Jul 9", amount: 11.99 },
  { name: "Water", category: "Utilities", due: "Jul 14", amount: 62 },
  { name: "Electric", category: "Utilities", due: "Jul 22", amount: 88.4 },
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const totalDue = upcomingBills.reduce((sum, bill) => sum + bill.amount, 0);

// Each ledger row reveals a beat after the one above it, so the list settles
// into order on load. Reduced-motion users get the settled state instantly.
const ROW_STAGGER_MS = 90;

function AuthButtons() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button size="lg" onClick={signInWithGoogle}>
        Continue with Google
        <SimpleIconsGoogle className="size-4" />
      </Button>
      <Button variant="outline" size="lg" onClick={continueAsGuest}>
        Try as guest
        <UserRound className="size-4" />
      </Button>
    </div>
  );
}

type NavBarProps = {
  session: { user: { name: string } } | null;
  onClickSignOut: () => void;
};

function NavBar({ session, onClickSignOut }: NavBarProps) {
  return (
    <header className="border-ledger-line bg-ledger-paper/80 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <div className="text-ledger-ink font-display flex items-center gap-2 text-lg font-medium">
          <span className="bg-ledger-ink text-ledger-paper flex size-7 items-center justify-center rounded-lg">
            <Receipt className="size-4" />
          </span>
          Remind Me Bills
        </div>
        {session ? (
          <div className="flex items-center gap-2">
            <span className="text-ledger-muted hidden text-sm sm:inline">
              {session.user.name}
            </span>
            <Button asChild size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-ledger-muted"
              onClick={onClickSignOut}
            >
              Sign out
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-ledger-ink"
            onClick={signInWithGoogle}
          >
            Sign in
          </Button>
        )}
      </div>
    </header>
  );
}

function LedgerRow({ bill, index }: { bill: UpcomingBill; index: number }) {
  const isNext = index === 0;
  return (
    <li
      className="flex animate-[ledger-row_0.5s_ease-out_both] items-center gap-3 py-3 motion-reduce:animate-none"
      style={{ animationDelay: `${index * ROW_STAGGER_MS}ms` }}
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          isNext ? "bg-ledger-accent" : "bg-ledger-line",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-ledger-ink truncate text-sm font-medium">
          {bill.name}
        </p>
        <p className="text-ledger-muted truncate text-xs">{bill.category}</p>
      </div>
      <span className="text-ledger-muted font-mono text-xs tabular-nums">
        {bill.due}
      </span>
      <span className="text-ledger-ink w-20 text-right font-mono text-sm font-medium tabular-nums">
        {currency.format(bill.amount)}
      </span>
    </li>
  );
}

function LedgerPanel() {
  return (
    <div className="relative">
      {/* soft accent glow anchoring the panel to the page */}
      <div
        aria-hidden
        className="bg-ledger-accent-soft/60 absolute -inset-4 -z-10 rounded-[2rem] blur-2xl"
      />
      <div className="border-ledger-line bg-ledger-panel shadow-ledger-ink/5 rounded-2xl border p-5 shadow-xl sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-ledger-muted text-xs font-medium tracking-wider uppercase">
              This month
            </p>
            <p className="text-ledger-ink font-display mt-0.5 text-lg">
              Upcoming bills
            </p>
          </div>
          <span className="bg-ledger-accent-soft text-ledger-accent-strong flex size-9 items-center justify-center rounded-full">
            <CalendarClock className="size-4" />
          </span>
        </div>
        <ul className="divide-ledger-line mt-5 divide-y">
          {upcomingBills.map((bill, index) => (
            <LedgerRow key={bill.name} bill={bill} index={index} />
          ))}
        </ul>
        <div className="border-ledger-line mt-5 flex items-center justify-between border-t pt-4">
          <div className="text-ledger-accent-strong flex items-center gap-1.5 text-sm font-medium">
            <CheckCircle className="size-4" />
            You&apos;re on track
          </div>
          <div className="text-right">
            <p className="text-ledger-muted text-xs">Due this month</p>
            <p className="text-ledger-ink font-mono text-base font-medium tabular-nums">
              {currency.format(totalDue)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="px-4 pt-16 pb-20 lg:pt-24 lg:pb-28">
      <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="text-ledger-accent-strong text-xs font-semibold tracking-[0.18em] uppercase">
            Bill &amp; subscription tracker
          </p>
          <h1 className="text-ledger-ink font-display mt-4 text-4xl leading-[1.05] tracking-tight lg:text-6xl">
            Never miss a bill again.
          </h1>
          <p className="text-ledger-muted mt-5 max-w-md text-lg">
            Keep every bill, subscription, and due date in one calm list — and
            see exactly what&apos;s coming before it&apos;s due.
          </p>
          <div className="mt-8">
            <AuthButtons />
          </div>
          <p className="text-ledger-muted mt-4 text-sm">
            Free to use — start as a guest, no card required.
          </p>
        </div>
        <LedgerPanel />
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="border-ledger-line border-t px-4 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-xl">
          <h2 className="text-ledger-ink font-display text-3xl lg:text-4xl">
            Everything in one calm place
          </h2>
          <p className="text-ledger-muted mt-3">
            Simple tools that keep your bills organized and your due dates in
            plain sight.
          </p>
        </div>
        <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="flex gap-4">
              <span className="bg-ledger-accent-soft text-ledger-accent-strong flex size-10 shrink-0 items-center justify-center rounded-xl">
                <feature.icon className="size-5" />
              </span>
              <div>
                <h3 className="text-ledger-ink font-medium">{feature.title}</h3>
                <p className="text-ledger-muted mt-1 text-sm">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section className="border-ledger-line bg-ledger-accent-soft/30 border-t px-4 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-ledger-ink font-display text-3xl lg:text-4xl">
          How it works
        </h2>
        <div className="mt-12 grid gap-10 sm:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title}>
              <div className="flex items-center gap-3">
                <span className="text-ledger-accent-strong font-mono text-sm font-medium">
                  0{index + 1}
                </span>
                <span className="bg-ledger-line h-px flex-1" />
              </div>
              <step.icon className="text-ledger-ink mt-5 size-6" />
              <h3 className="text-ledger-ink mt-3 text-lg font-medium">
                {step.title}
              </h3>
              <p className="text-ledger-muted mt-1 text-sm">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="border-ledger-line border-t px-4 py-20">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <h2 className="text-ledger-ink font-display text-3xl lg:text-4xl">
          Ready to take control?
        </h2>
        <p className="text-ledger-muted mt-3">
          Add your first bill in under a minute. No account needed to start.
        </p>
        <div className="mt-8">
          <AuthButtons />
        </div>
      </div>
    </section>
  );
}

function WelcomeBackSection({ name }: { name: string }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-ledger-accent-strong text-xs font-semibold tracking-[0.18em] uppercase">
        Welcome back
      </p>
      <h1 className="text-ledger-ink font-display mt-4 text-4xl lg:text-5xl">
        Hello, {name}
      </h1>
      <p className="text-ledger-muted mt-3">
        Pick up right where you left off.
      </p>
      <Button asChild size="lg" className="mt-8">
        <Link href="/dashboard">
          Go to dashboard
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-ledger-line border-t px-4 py-8">
      <div className="text-ledger-muted mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-sm sm:flex-row">
        <div className="flex items-center gap-2">
          <Receipt className="size-4" />
          <span>Remind Me Bills</span>
        </div>
        <span>&copy; {new Date().getFullYear()} Remind Me Bills</span>
      </div>
    </footer>
  );
}

function LoadingSkeleton() {
  return (
    <div className="bg-ledger-paper flex min-h-svh flex-col">
      <div className="border-ledger-line w-full border-b">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-12 px-4 pt-16 lg:grid-cols-2">
        <div>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-14 w-full max-w-sm" />
          <Skeleton className="mt-4 h-5 w-64" />
          <div className="mt-8 flex gap-3">
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function HomePage() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  if (isPending) return <LoadingSkeleton />;

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => router.push("/"),
      },
    });
  };

  return (
    <div className="bg-ledger-paper text-ledger-ink flex min-h-svh flex-col font-sans antialiased">
      <NavBar session={session} onClickSignOut={handleSignOut} />

      {session ? (
        <WelcomeBackSection name={session.user.name} />
      ) : (
        <>
          <HeroSection />
          <FeaturesSection />
          <HowItWorksSection />
          <CtaSection />
        </>
      )}

      <Footer />
    </div>
  );
}
