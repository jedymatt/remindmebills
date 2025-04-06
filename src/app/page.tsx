import { headers } from "next/headers";
import { redirect } from "next/navigation";

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

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
                  Sign in
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
