"use client";

import { useActionState } from "react";
import { runFreeAudit } from "@/app/actions/audit";
import { Button, FormMessage, inputClass } from "./ui";
import { keepInputOnSubmit } from "./use-keep-input";

export function AuditForm() {
  const [state, action, pending] = useActionState(runFreeAudit, undefined);
  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="audit-url" className="sr-only">
          Business website
        </label>
        <input
          id="audit-url"
          name="url"
          type="text"
          inputMode="url"
          required
          defaultValue={state?.url}
          placeholder="any-business-website.com"
          className={`${inputClass} sm:flex-1 text-base`}
        />
        <Button type="submit" disabled={pending} className="sm:w-44">
          {pending ? "Checking…" : "Check website free"}
        </Button>
      </div>
      {pending && <p className="text-sm text-muted">Loading the site and running 13 checks. This takes up to 30 seconds.</p>}
      <FormMessage error={state?.error} />
    </form>
  );
}
