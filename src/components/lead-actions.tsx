"use client";

import { useActionState, useState } from "react";
import { generateLeadPitch, updateLead } from "@/app/actions/app";
import { LEAD_STATUSES, STATUS_LABELS, type LeadStatus } from "@/lib/leads/status";
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
        <Button type="submit" variant={pitch ? "secondary" : "primary"} disabled={pending}>
          {pending ? "Writing your pitch…" : pitch ? "Write a different version" : "Write my pitch"}
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
  notes,
}: {
  leadId: string;
  status: LeadStatus;
  wonAmount: number | null;
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
        <Field label="Project value (USD)" hint="Counts toward your “Earned with Pitchcraft” total.">
          <input
            name="wonAmount"
            inputMode="decimal"
            defaultValue={wonAmount ? String(wonAmount / 100) : ""}
            placeholder="500"
            className={inputClass}
          />
        </Field>
      )}
      <Field label="Notes">
        <textarea name="notes" rows={3} defaultValue={notes ?? ""} className={inputClass} placeholder="Spoke to the owner, follow up Friday…" />
      </Field>
      <FormMessage error={state?.error} success={state?.success} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
