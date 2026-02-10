"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SVGProps } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { authClient } from "~/lib/auth-client";
import {
  ArrowRight,
  Bell,
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

const features = [
  {
    icon: Bell,
    title: "Bill Reminders",
    description: "Get notified before due dates so you never miss a payment.",
  },
  {
    icon: Repeat,
    title: "Recurring Payments",
    description: "Track subscriptions and recurring bills with automatic scheduling.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard Overview",
    description: "See all your upcoming bills at a glance in one clean view.",
  },
  {
    icon: UserRound,
    title: "Guest Mode",
    description: "Try the app instantly without creating an account.",
  },
] as const;

const steps = [
  {
    icon: LogIn,
    title: "Sign In",
    description: "Use Google or try as a guest.",
  },
  {
    icon: PlusCircle,
    title: "Add Bills",
    description: "Enter your bills and due dates.",
  },
  {
    icon: CheckCircle,
    title: "Stay on Track",
    description: "Never miss a payment again.",
  },
] as const;

function NavBar({
  session,
  onSignOut,
}: {
  session: { user: { name: string } } | null;
  onSignOut: () => void;
}) {
  return (
    <header className="bg-background/80 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2 font-semibold">
          <Receipt className="size-5" />
          <span>Remind Me Bills</span>
        </div>
        {session ? (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {session.user.name}
            </span>
            <Button asChild size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await authClient.signIn.social({
                provider: "google",
                callbackURL: "/dashboard",
              });
            }}
          >
            Sign in
          </Button>
        )}
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="flex flex-col items-center px-4 py-20 text-center lg:py-32">
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight lg:text-5xl">
        Never Miss a Bill Again
      </h1>
      <p className="text-muted-foreground mt-4 max-w-lg text-lg">
        Track your bills, manage recurring payments, and stay on top of your
        finances — all in one place.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          onClick={async () => {
            await authClient.signIn.social({
              provider: "google",
              callbackURL: "/dashboard",
            });
          }}
        >
          Sign in with Google
          <SimpleIconsGoogle className="ml-1.5 inline size-4" />
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={async () => {
            await authClient.signIn.anonymous();
          }}
        >
          Try as Guest
          <UserRound className="ml-1.5 inline size-4" />
        </Button>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="bg-muted/50 w-full px-4 py-16">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-bold lg:text-3xl">
          Everything You Need
        </h2>
        <p className="text-muted-foreground mt-2 text-center">
          Simple tools to keep your bills organized.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <feature.icon className="text-primary mb-1 size-6" />
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-bold lg:text-3xl">
          How It Works
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.title} className="flex flex-col items-center text-center">
              <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-full">
                <step.icon className="size-6" />
              </div>
              <p className="text-muted-foreground mt-1 text-sm font-medium">
                Step {i + 1}
              </p>
              <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm">
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
    <section className="bg-muted/50 w-full px-4 py-16">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <h2 className="text-2xl font-bold lg:text-3xl">
          Ready to Take Control?
        </h2>
        <p className="text-muted-foreground mt-2">
          Start tracking your bills today — it only takes a minute.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            onClick={async () => {
              await authClient.signIn.social({
                provider: "google",
                callbackURL: "/dashboard",
              });
            }}
          >
            Sign in with Google
            <SimpleIconsGoogle className="ml-1.5 inline size-4" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={async () => {
              await authClient.signIn.anonymous();
            }}
          >
            Try as Guest
            <UserRound className="ml-1.5 inline size-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}

function WelcomeBackSection({ name }: { name: string }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="text-3xl font-bold lg:text-4xl">
        Welcome back, {name}
      </h1>
      <p className="text-muted-foreground mt-2">
        Pick up where you left off.
      </p>
      <Button asChild size="lg" className="mt-6">
        <Link href="/dashboard">
          Go to Dashboard
          <ArrowRight className="ml-1.5 size-4" />
        </Link>
      </Button>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t px-4 py-6">
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 text-sm">
        <Receipt className="text-muted-foreground size-4" />
        <span className="text-muted-foreground">
          Remind Me Bills &copy; {new Date().getFullYear()}
        </span>
      </div>
    </footer>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex min-h-svh flex-col">
      {/* Nav skeleton */}
      <div className="w-full border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      {/* Hero skeleton */}
      <div className="flex flex-1 flex-col items-center px-4 pt-20">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="mt-4 h-5 w-64" />
        <div className="mt-8 flex gap-3">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-32" />
        </div>
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
    <div className="flex min-h-svh flex-col">
      <NavBar session={session} onSignOut={handleSignOut} />

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
