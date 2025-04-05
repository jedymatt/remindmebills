"use client";
// import { createAuthClient } from "better-auth/react";
import { createAuthClient } from "better-auth/react";
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
        Sign in
      </h1>

      <button onClick={handleSigIn}>Sign in with Google</button>
    </div>
  );
}
