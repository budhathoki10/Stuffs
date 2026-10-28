"use client";

import { useState } from "react";
import { Button } from "./ui";

function gmailLink(to: string | null | undefined, subject: string, body: string) {
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

/** Editable pitch with copy and "open in email" shortcuts. */
export function PitchView({
  subject: initialSubject,
  body: initialBody,
  to,
  onSent,
}: {
  subject: string;
  body: string;
  to?: string | null;
  onSent?: () => void;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied("Copy failed: select the text and copy it manually");
    }
  }

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Subject</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-lg border border-border px-3 py-2 text-sm font-medium"
          aria-label="Pitch subject"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Email</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={Math.min(18, body.split("\n").length + 3)}
          className="w-full rounded-lg border border-border px-3 py-2 text-sm leading-relaxed"
          aria-label="Pitch body"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <a
          href={gmailLink(to, subject, body)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onSent}
          className="inline-flex items-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong"
        >
          Open in Gmail
        </a>
        <a
          href={mailtoLink(to, subject, body)}
          onClick={onSent}
          className="inline-flex items-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:border-accent"
        >
          Open in email app
        </a>
        <Button type="button" variant="secondary" onClick={() => copy("Email copied", `${subject}\n\n${body}`)}>
          Copy
        </Button>
      </div>
      {copied && (
        <p role="status" className="text-sm text-accent">
          {copied}
        </p>
      )}
    </div>
  );
}
