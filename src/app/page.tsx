import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "~/components/ui/button";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import { BillList } from "./_components/billList";

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
            </div>
          </div>

          {/* {session?.user && <LatestPost />} */}
        </div>
        {session?.user && <BillList />}
      </main>
    </HydrateClient>
  );
}
