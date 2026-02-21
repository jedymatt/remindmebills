"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { BillFormFields, BillFormValuesSchema, type BillFormValues } from "./billFormFields";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";

export function CreateBillForm() {
  const router = useRouter();
  const form = useForm<BillFormValues>({
    resolver: zodResolver(BillFormValuesSchema),
    defaultValues: {
      title: "",
      type: "single",
    },
  });
  const utils = api.useUtils();
  const createBill = api.bill.create.useMutation({
    onSuccess: async () => {
      await utils.bill.getAll.invalidate();
      toast("Bill created successfully.");
      router.push("/dashboard");
    },
  });

  const [recurringEndsWith, setRecurringEndsWith] = useState<
    "never" | "until" | "count"
  >("never");

  const handleRecurringEndsWithChange = (
    value: "never" | "until" | "count",
  ) => {
    setRecurringEndsWith(value);
    if (value !== "count") form.setValue("recurrence.count", undefined);
    if (value !== "until") form.setValue("recurrence.until", undefined);
  };

  async function handleSubmit(data: BillFormValues) {
    await createBill.mutateAsync(data);
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Create a new bill</CardTitle>
        <CardDescription>
          Fill in the details of the bill you want to create.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BillFormFields
          form={form}
          recurringEndsWith={recurringEndsWith}
          onRecurringEndsWithChange={handleRecurringEndsWithChange}
          formId="create-bill-form"
          onSubmit={handleSubmit}
        />
      </CardContent>
      <CardFooter className="justify-between">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="create-bill-form"
          disabled={form.formState.isSubmitting}
        >
          Create
        </Button>
      </CardFooter>
    </Card>
  );
}
