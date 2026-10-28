"use client";

import { useActionState } from "react";
import type { WorkState } from "@/app/actions/work";
import { Button, FormMessage, inputClass } from "../ui";
import { keepInputOnSubmit } from "../use-keep-input";

/** One URL box and a button, for the before-and-after check and starting a monitor. */
export function UrlActionForm({
  action: serverAction,
  leadId,
  defaultUrl,
  label,
  button,
  pendingLabel,
}: {
  action: (state: WorkState, formData: FormData) => Promise<WorkState>;
  leadId: string;
  defaultUrl: string;
  label: string;
  button: string;
  pendingLabel: string;
}) {
  const [state, action, pending] = useActionState(serverAction, undefined);
  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <label className="block text-[13px] font-medium">
        {label}
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <input name="url" type="text" inputMode="url" defaultValue={defaultUrl} placeholder="https://" className={`${inputClass} font-normal`} />
          <Button type="submit" disabled={pending} className="shrink-0">
            {pending ? pendingLabel : button}
          </Button>
        </div>
      </label>
      <FormMessage error={state?.error} success={state?.success} />
    </form>
  );
}
