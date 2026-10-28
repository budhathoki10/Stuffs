"use client";

import { useActionState, useState } from "react";
import { sendMessage } from "@/app/actions/outreach";
import type { OutgoingKind } from "@/lib/outreach/text";
import { Button, FormMessage } from "../ui";
import { keepInputOnSubmit } from "../use-keep-input";

/**
 * Write and send an email to a business without leaving the app. Laid out like a compose
 * window; it goes out as "Name via Pitchcraft" and replies come back to this lead.
 */
export function EmailComposer({
  leadId,
  kind,
  to: initialTo,
  subject: initialSubject,
  body: initialBody,
  quoteId,
  sendLabel = "Send email",
  placeholder,
  note,
}: {
  leadId: string;
  kind: OutgoingKind;
  to: string | null;
  subject: string;
  body: string;
  quoteId?: string;
  sendLabel?: string;
  placeholder?: string;
  note?: string;
}) {
  const [state, action, pending] = useActionState(sendMessage, undefined);
  const [to, setTo] = useState(initialTo ?? "");
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the text is still selectable.
    }
  }

  return (
    <form onSubmit={keepInputOnSubmit(action)}>
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="kind" value={kind} />
      {quoteId && <input type="hidden" name="quoteId" value={quoteId} />}
      <div className="overflow-hidden rounded-md border border-strong-border bg-surface">
        <div className="grid grid-cols-[4.5rem_1fr] items-center border-b border-border text-sm">
          <label htmlFor={`${kind}-to`} className="px-3 py-2 text-muted">
            To
          </label>
          <input
            id={`${kind}-to`}
            name="to"
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="owner@business.com"
            className="w-full bg-transparent py-2 pr-3 outline-none placeholder:text-faint"
          />
        </div>
        <div className="grid grid-cols-[4.5rem_1fr] items-center border-b border-border text-sm">
          <label htmlFor={`${kind}-subject`} className="px-3 py-2 text-muted">
            Subject
          </label>
          <input
            id={`${kind}-subject`}
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-transparent py-2 pr-3 font-medium outline-none"
          />
        </div>
        <textarea
          name="body"
          aria-label="Message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder}
          rows={Math.min(16, Math.max(5, body.split("\n").length + 2))}
          className="block w-full resize-y bg-transparent px-3 py-3 text-sm leading-relaxed outline-none placeholder:text-faint"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" disabled={pending || !!state?.success}>
          {pending ? "Sending…" : state?.success ? "Sent" : sendLabel}
        </Button>
        <button type="button" onClick={copy} className="text-[13px] text-muted underline-offset-4 hover:text-foreground hover:underline">
          {copied ? "Copied" : "Copy text"}
        </button>
        {note && !state && <span className="text-xs text-muted">{note}</span>}
      </div>
      <div className="mt-3">
        <FormMessage error={state?.error} success={state?.success} />
      </div>
    </form>
  );
}
