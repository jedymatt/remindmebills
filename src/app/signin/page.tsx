"use client";
// import { createAuthClient } from "better-auth/react";
import { createAuthClient } from "better-auth/react";
import { Button } from "~/components/ui/button";
export default function SignIn() {
  const authClient = createAuthClient();

  async function handleSigIn() {
    const { data: session } = await authClient.getSession();
    if (session) {
      console.log("Already signed in");
      return;
    }

    const data = await authClient.signIn.social({ provider: "google" });
    console.log({ data });
  }

  return (
    <div>
      <h1>Sign in</h1>

      <Button onClick={handleSigIn}>Sign in with Google</Button>
    </div>
  );
}
