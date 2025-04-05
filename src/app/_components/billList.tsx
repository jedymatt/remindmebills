"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { api } from "~/trpc/react";

export function BillList() {
  const { data: bills } = api.bill.getAll.useQuery();

  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {bills?.map((bill) => (
        <Card key={bill._id}>
          <CardHeader>
            <CardTitle>{bill.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {bill.date?.toLocaleDateString("en-PH")}
            {bill.amount?.toLocaleString("en-PH", {
              style: "currency",
              currency: "PHP",
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
