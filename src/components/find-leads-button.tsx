"use client";

import { useActionState } from "react";
import { findLeadsNow } from "@/app/actions/app";
import { Button, FormMessage } from "./ui";

export function FindLeadsButton({ label = "Find my leads now" }: { label?: string }) {
  const [state, action, pending] = useActionState(findLeadsNow, undefined);
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" disabled={pending}>
        {pending ? "Finding businesses and checking their websites…" : label}
      </Button>
      <FormMessage error={state?.error} success={state?.success} />
    </form>
  );
}
