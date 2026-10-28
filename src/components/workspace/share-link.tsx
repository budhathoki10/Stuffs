"use client";

import { useState } from "react";
import type { OutgoingKind } from "@/lib/outreach/text";
import { Button } from "../ui";
import { EmailComposer } from "./email-composer";

/** A client-facing link: copy it, send it on WhatsApp, or email it from the app. */
export function ShareLink({
  url,
  to,
  subject,
  body,
  email,
}: {
  url: string;
  to?: string | null;
  subject: string;
  body: string;
  /** Lets the link be emailed from inside the app, recorded on this lead's conversation. */
  email?: { leadId: string; kind: OutgoingKind; quoteId?: string; signoff: string };
}) {
  const [note, setNote] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setNote("Link copied.");
    } catch {
      setNote("Your browser blocked copying. Select the link and copy it by hand.");
    }
    setTimeout(() => setNote(null), 2500);
  }
  return (
    <div className="space-y-2">
      <div className="flex min-w-0 items-center gap-2 rounded-[5px] border border-strong-border bg-surface py-1 pl-3 pr-1">
        <input
          readOnly
          value={url}
          aria-label="Link for the client"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 bg-transparent font-mono text-[13px] outline-none"
        />
        <Button type="button" variant="secondary" className="shrink-0 py-1" onClick={copy}>
          Copy
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        {email && (
          <button type="button" onClick={() => setComposing((c) => !c)} aria-expanded={composing} className="underline underline-offset-4">
            {composing ? "Close email" : "Email it to them"}
          </button>
        )}
        <a href={`https://wa.me/?text=${encodeURIComponent(`${body}\n\n${url}`)}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          Send on WhatsApp
        </a>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted underline underline-offset-4">
          Open
        </a>
        {note && (
          <span role="status" className="text-money">
            {note}
          </span>
        )}
      </div>
      {email && composing && (
        <div className="pt-2">
          <EmailComposer leadId={email.leadId} kind={email.kind} quoteId={email.quoteId} to={to ?? null} subject={subject} body={`${body}\n\n${url}\n\n${email.signoff}`} />
        </div>
      )}
    </div>
  );
}
