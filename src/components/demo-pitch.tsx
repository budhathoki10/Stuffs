"use client";

import { useActionState } from "react";
import { generateDemoPitch } from "@/app/actions/audit";
import { PitchView } from "./pitch-view";
import { Button, FormMessage } from "./ui";

export function DemoPitch({ auditId }: { auditId: string }) {
  const [state, action, pending] = useActionState(generateDemoPitch, undefined);
  if (state?.subject && state.body) {
    return <PitchView subject={state.subject} body={state.body} />;
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="auditId" value={auditId} />
      <p className="text-sm text-muted">
        See the email a freelancer could send this business, written from the problems found above.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "Writing pitch…" : "Write a sample pitch"}
      </Button>
      <FormMessage error={state?.error} />
    </form>
  );
}
