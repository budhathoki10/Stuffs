"use client";

import { useActionState, useState } from "react";
import { saveQuote } from "@/app/actions/work";
import { CURRENCIES, type LineItem } from "@/lib/work/types";
import { Button, Field, FormMessage, inputClass } from "../ui";
import { keepInputOnSubmit } from "../use-keep-input";
import { LineItemsEditor } from "./line-items-editor";

export function QuoteEditor({
  leadId,
  quote,
  locked,
}: {
  leadId: string;
  quote: { id: string; currency: string; items: LineItem[]; note: string | null; validUntil: string };
  locked: boolean;
}) {
  const [state, action, pending] = useActionState(saveQuote, undefined);
  const [currency, setCurrency] = useState(quote.currency);
  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-5">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="quoteId" value={quote.id} />
      <LineItemsEditor initial={quote.items} currency={currency} disabled={locked} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Currency">
          <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={locked} className={inputClass}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Valid until">
          <input type="date" name="validUntil" defaultValue={quote.validUntil} disabled={locked} className={inputClass} />
        </Field>
      </div>
      <Field label="Note to the client" hint="Timeline, what you need from them, how payment works.">
        <textarea
          name="note"
          rows={3}
          defaultValue={quote.note ?? ""}
          disabled={locked}
          placeholder="I can start next week and have it live in 10 days. Half up front, half when it's live."
          className={inputClass}
        />
      </Field>
      <FormMessage error={state?.error} success={state?.success} />
      {!locked && (
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save quote"}
        </Button>
      )}
    </form>
  );
}
