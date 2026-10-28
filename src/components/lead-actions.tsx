"use client";

import { useActionState, useState } from "react";
import { generateLeadPitch, updateLead } from "@/app/actions/app";
import { CHASE_STATUSES, LEAD_STATUSES, STATUS_LABELS, type LeadStatus } from "@/lib/leads/status";
import { CURRENCIES } from "@/lib/work/types";
import { PitchView } from "./pitch-view";
import { Button, Field, FormMessage, inputClass } from "./ui";
import { keepInputOnSubmit } from "./use-keep-input";

export function LeadPitch({
  leadId,
  email,
  existing,
}: {
  leadId: string;
  email: string | null;
  existing: { subject: string; body: string } | null;
}) {
  const [state, action, pending] = useActionState(generateLeadPitch, undefined);
  const pitch = state?.subject && state.body ? { subject: state.subject, body: state.body } : existing;
  return (
    <div className="space-y-4">
      {pitch && <PitchView key={`${pitch.subject}${pitch.body}`} subject={pitch.subject} body={pitch.body} to={email} />}
      <form action={action} className="space-y-2">
        <input type="hidden" name="leadId" value={leadId} />
        <Button type="submit" variant={pitch ? "ghost" : "primary"} disabled={pending} className={pitch ? "px-0!" : ""}>
          {pending ? "Drafting…" : pitch ? "Draft another version" : "Draft the email"}
        </Button>
        <FormMessage error={state?.error} />
      </form>
    </div>
  );
}

export function LeadStatusForm({
  leadId,
  status,
  wonAmount,
  currency,
  followUpOn,
  notes,
}: {
  leadId: string;
  status: LeadStatus;
  wonAmount: number | null;
  currency: string;
  followUpOn: string | null;
  notes: string | null;
}) {
  const [state, action, pending] = useActionState(updateLead, undefined);
  const [current, setCurrent] = useState<LeadStatus>(status);
  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-4">
      <input type="hidden" name="leadId" value={leadId} />
      <Field label="Status">
        <select
          name="status"
          value={current}
          onChange={(e) => setCurrent(e.target.value as LeadStatus)}
          className={inputClass}
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>
      {current === "won" && (
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <Field label="Project value" hint="Adds to your earnings on the Today page.">
            <input
              name="wonAmount"
              inputMode="decimal"
              defaultValue={wonAmount ? String(wonAmount / 100) : ""}
              placeholder="500"
              className={inputClass}
            />
          </Field>
          <Field label="Currency">
            <select name="currency" defaultValue={currency} className={inputClass}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
      )}
      {(CHASE_STATUSES as readonly string[]).includes(current) && (
        <Field label="Follow up on" hint={status === "new" ? "Leave empty and we'll remind you in three days." : "We'll email you a reminder that morning."}>
          <input name="followUpOn" type="date" defaultValue={followUpOn ?? ""} className={inputClass} />
        </Field>
      )}
      <Field label="Notes">
        <textarea name="notes" rows={3} defaultValue={notes ?? ""} className={inputClass} placeholder="Spoke to the owner. Call back Friday." />
      </Field>
      <FormMessage error={state?.error} success={state?.success} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
