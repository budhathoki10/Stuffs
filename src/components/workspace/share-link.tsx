"use client";

import { useState } from "react";
import { gmailLink } from "../pitch-view";
import { Button } from "../ui";

/** A client-facing link with copy and "email it" shortcuts. */
export function ShareLink({ url, to, subject, body }: { url: string; to?: string | null; subject: string; body: string }) {
  const [note, setNote] = useState<string | null>(null);
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
        <a href={gmailLink(to, subject, `${body}\n\n${url}`)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          Email it with Gmail
        </a>
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
    </div>
  );
}
