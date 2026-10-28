"use client";

import { useActionState } from "react";
import { findLeadsNow } from "@/app/actions/app";
import { Button, FormMessage } from "./ui";

export function FindLeadsButton() {
  const [state, action, pending] = useActionState(findLeadsNow, undefined);
  return (
    <form action={action} className="space-y-3">
      <Button type="submit" disabled={pending}>
        {pending ? "Checking their websites…" : "Find today's leads"}
      </Button>
      <FormMessage error={state?.error} success={state?.success} />
    </form>
  );
}
