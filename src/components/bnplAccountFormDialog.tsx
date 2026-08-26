"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { BnplAccount } from "~/types";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";

const AccountFormSchema = z.object({
  name: z.string().trim().min(1, { message: "Name is required" }).max(50),
  dueDay: z.coerce.number<number>().int().min(1).max(31),
});

export type AccountFormValues = z.infer<typeof AccountFormSchema>;

export function BnplAccountFormDialog({
  open,
  onOpenChange,
  account,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: BnplAccount;
  onSubmit: (values: AccountFormValues) => void;
  isPending: boolean;
}) {
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(AccountFormSchema),
    defaultValues: { name: "", dueDay: 15 },
  });

  // Reset on open so an edit shows the current values and a create starts clean.
  useEffect(() => {
    if (!open) return;
    form.reset(
      account
        ? { name: account.name, dueDay: account.dueDay }
        : { name: "", dueDay: 15 },
    );
  }, [open, account, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Edit account" : "New account"}</DialogTitle>
          <DialogDescription>
            A BNPL provider bills every purchase on one monthly statement.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            id="bnpl-account-form"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="SPayLater" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dueDay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statement due day</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={31} {...field} />
                  </FormControl>
                  <FormDescription>
                    Months without this day use their last day instead.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form="bnpl-account-form" disabled={isPending}>
            {isPending && <Loader2 className="mr-1 size-4 animate-spin" />}
            {account ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
