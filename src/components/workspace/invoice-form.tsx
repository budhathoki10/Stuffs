"use client";

import { useActionState, useState } from "react";
import { newInvoice } from "@/app/actions/work";
import { CURRENCIES, type LineItem } from "@/lib/work/types";
import { Button, Field, FormMessage, inputClass } from "../ui";
import { keepInputOnSubmit } from "../use-keep-input";
import { LineItemsEditor } from "./line-items-editor";

export function InvoiceForm({
  leadId,
  items,
  currency: initialCurrency,
  dueOn,
}: {
  leadId: string;
  items: LineItem[];
  currency: string;
  dueOn: string;
}) {
  const [state, action, pending] = useActionState(newInvoice, undefined);
  const [currency, setCurrency] = useState(initialCurrency);
  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-5">
      <input type="hidden" name="leadId" value={leadId} />
      <LineItemsEditor initial={items} currency={currency} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Currency">
          <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Due">
          <input type="date" name="dueOn" defaultValue={dueOn} className={inputClass} />
        </Field>
      </div>
      <Field label="Note" hint="Shown on the invoice, e.g. “50% deposit” or “Thank you for your business.”">
        <textarea name="note" rows={2} className={inputClass} />
      </Field>
      <FormMessage error={state?.error} success={state?.success} />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create invoice"}
      </Button>
    </form>
  );
}
