import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { SVGProps } from "react";
import { Button } from "~/components/ui/button";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

export function SimpleIconsGoogle(props: SVGProps<SVGSVGElement>) {
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

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    void api.bill.getAll.prefetch();
  }

  return (
    <HydrateClient>
      <main className="p-2">
        <div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-col items-center justify-center gap-4">
              <p className="text-center text-2xl text-white">
                {session && <span>Logged in as {session.user?.name}</span>}
              </p>
              {session ? (
                <form
                  action={async () => {
                    "use server";
                    await auth.api.signOut({
                      headers: await headers(),
                    });
                    // Redirect to home page
                    redirect("/");
                  }}
                >
                  <Button>{"Sign out"}</Button>
                </form>
              ) : (
                <Button
                  onClick={async () => {
                    "use server";
                    const response = await auth.api.signInSocial({
                      body: {
                        provider: "google",
                        callbackURL: "/dashboard",
                      },
                    });

                    if (response.redirect && response.url) {
                      redirect(response.url);
                    } else {
                      console.error("Sign in failed", response);
                    }
                  }}
                >
                  Sign in with Google{" "}
                  <SimpleIconsGoogle className="ml-1 inline size-4" />
                </Button>
              )}

              {session?.user && (
                <Button variant="link" asChild>
                  <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
