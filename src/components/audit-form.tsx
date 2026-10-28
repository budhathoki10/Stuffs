"use client";

import { useActionState } from "react";
import { runFreeAudit } from "@/app/actions/audit";
import { Button, FormMessage, inputClass } from "./ui";
import { keepInputOnSubmit } from "./use-keep-input";

export function AuditForm() {
  const [state, action, pending] = useActionState(runFreeAudit, undefined);
  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-2.5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="audit-url" className="sr-only">
          Business website
        </label>
        <input
          id="audit-url"
          name="url"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          required
          defaultValue={state?.url}
          placeholder="joesplumbing.com"
          className={`${inputClass} py-2.5 sm:flex-1`}
        />
        <Button type="submit" disabled={pending} className="py-2.5 sm:w-36">
          {pending ? "Checking…" : "Check this site"}
        </Button>
      </div>
      <p className="text-[13px] text-muted">
        {pending ? "Loading the site and running the checks. Usually 10 to 20 seconds." : "Free, no account needed."}
      </p>
      <FormMessage error={state?.error} />
    </form>
  );
}
