import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "~/components/ui/button";
import { auth } from "~/server/auth";
import { BillList } from "../_components/billList";

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex min-h-14 items-center border-b px-6 shadow">
        <Button
          variant="link"
          className="ml-auto"
          onClick={async () => {
            "use server";
            await auth.api.signOut({
              headers: await headers(),
            });
            // Redirect to home page
            redirect("/");
          }}
        >
          Sign Out
        </Button>
      </nav>
      <div className="flex-grow p-6">
        <BillList />
      </div>
    </div>
  );
}
