"use client";

import { useActionState } from "react";
import { publishSite } from "@/app/actions/work";
import { Button, FormMessage } from "../ui";

export function PublishToggle({ leadId, published }: { leadId: string; published: boolean }) {
  const [state, action, pending] = useActionState(publishSite, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="publish" value={published ? "0" : "1"} />
      <Button type="submit" variant={published ? "secondary" : "primary"} disabled={pending}>
        {pending ? "One moment…" : published ? "Take it offline" : "Publish"}
      </Button>
      <FormMessage error={state?.error} />
    </form>
  );
}
