"use client";

import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import { BillList } from "~/app/_components/billList";
import { AuthenticatedLayout } from "./authenticatedLayout";
import { Button } from "./ui/button";

export function DashboardPage() {
  return (
    <AuthenticatedLayout>
      <div className="flex-grow space-y-4 p-6">
        <div>
          <Button asChild>
            <Link href={"/bills/create"}>
              New Bill <CalendarPlus />
            </Link>
          </Button>
        </div>
        <BillList />
      </div>
    </AuthenticatedLayout>
  );
}
