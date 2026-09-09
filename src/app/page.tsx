import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { HomePage } from "~/components/homePage";
import { auth } from "~/server/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect("/dashboard");
  }

  return <HomePage />;
}
