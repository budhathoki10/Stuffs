"use client";

import { useState } from "react";
import { Button } from "./ui";

export function gmailLink(to: string | null | undefined, subject: string, body: string) {
  const url = new URL("https://mail.google.com/mail/");
  url.searchParams.set("view", "cm");
  url.searchParams.set("fs", "1");
  if (to) url.searchParams.set("to", to);
  url.searchParams.set("su", subject);
  url.searchParams.set("body", body);
  return url.toString();
}

function mailtoLink(to: string | null | undefined, subject: string, body: string) {
  return `mailto:${to ? encodeURIComponent(to) : ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** The drafted email, laid out like a compose window. Edits stay local until it's sent. */
export function PitchView({ subject: initialSubject, body: initialBody, to }: { subject: string; body: string; to?: string | null }) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      setCopied("Copied.");
    } catch {
      setCopied("Your browser blocked copying. Select the text and copy it by hand.");
    }
    setTimeout(() => setCopied(null), 2500);
  }

  return (
    <div>
      <div className="overflow-hidden rounded-md border border-strong-border bg-surface">
        <div className="grid grid-cols-[4.5rem_1fr] items-center border-b border-border text-sm">
          <span className="px-3 py-2 text-muted">To</span>
          <span className="truncate py-2 pr-3">{to ?? <span className="text-faint">No email found</span>}</span>
        </div>
        <div className="grid grid-cols-[4.5rem_1fr] items-center border-b border-border text-sm">
          <label htmlFor="pitch-subject" className="px-3 py-2 text-muted">
            Subject
          </label>
          <input
            id="pitch-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-transparent py-2 pr-3 font-medium outline-none"
            aria-label="Pitch subject"
          />
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={Math.min(18, body.split("\n").length + 2)}
          className="block w-full resize-y bg-transparent px-3 py-3 text-sm leading-relaxed outline-none"
          aria-label="Pitch body"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={gmailLink(to, subject, body)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-[5px] bg-ink px-3.5 py-2 text-sm font-medium text-on-ink hover:bg-ink-hover"
        >
          Open in Gmail
        </a>
        <a
          href={mailtoLink(to, subject, body)}
          className="inline-flex items-center rounded-[5px] border border-strong-border px-3.5 py-2 text-sm font-medium hover:border-ink"
        >
          Open in email app
        </a>
        <Button type="button" variant="ghost" onClick={copy}>
          Copy text
        </Button>
        {copied && (
          <span role="status" className="text-sm text-muted">
            {copied}
          </span>
        )}
      </div>
    </div>
  );
}
