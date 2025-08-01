"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SVGProps } from "react";
import { Button } from "~/components/ui/button";
import { authClient } from "~/lib/auth-client";

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

export function HomePage() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  if (isPending) return null;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center">
      {session ? (
        <div className="space-y-4">
          <p className="text-center text-2xl font-bold">
            Logged in as {session.user.name}
          </p>
          <div className="flex flex-row items-center justify-center gap-2">
            <Button
              onClick={async () => {
                await authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => router.push("/"),
                  },
                });
              }}
              variant={"ghost"}
            >
              Sign out
            </Button>
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col space-y-2">
          <Button
            onClick={async () => {
              await authClient.signIn.social({
                provider: "google",
                callbackURL: "/dashboard",
              });
            }}
          >
            Sign in with Google{" "}
            <SimpleIconsGoogle className="ml-1 inline size-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await authClient.signIn.anonymous();
            }}
          >
            Sign in as Guest
          </Button>
        </div>
      )}
    </main>
  );
}
