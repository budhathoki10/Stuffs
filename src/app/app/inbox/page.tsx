import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { STATUS_LABELS, type LeadStatus } from "@/lib/leads/status";
import { stripQuoted } from "@/lib/outreach/text";
import { inbox } from "@/lib/services/outreach";

export const metadata: Metadata = { title: "Inbox" };

const when = (d: Date) => {
  const sameDay = d.toDateString() === new Date().toDateString();
  return d.toLocaleString("en-GB", sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" });
};

export default async function InboxPage() {
  const user = await requireUser();
  const threads = await inbox(user.id);
  const waiting = threads.filter((t) => t.message.direction === "in").length;

  return (
    <div className="space-y-8">
      <div>
        <Eyebrow>Email</Eyebrow>
        <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">Inbox</h1>
        <p className="mt-1.5 text-sm text-muted">
          {threads.length === 0
            ? "Every email you send from Pitchcraft, and every reply, shows up here."
            : waiting === 0
              ? "No one is waiting on you."
              : waiting === 1
                ? "One business is waiting for your reply."
                : `${waiting} businesses are waiting for your reply.`}
        </p>
      </div>

      {threads.length === 0 ? (
        <div className="rounded-md border border-dashed border-strong-border px-6 py-10 text-center">
          <p className="mb-4 text-muted">Open a lead, draft the email and send it from there. Replies land here.</p>
          <ButtonLink href="/app">Today&apos;s leads</ButtonLink>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
          {threads.map(({ message: m, lead, unread }) => {
            const incoming = m.direction === "in";
            return (
              <li key={lead.id}>
                <Link
                  href={`/app/leads/${lead.id}#conversation`}
                  className={`grid gap-x-4 gap-y-0.5 px-5 py-3.5 hover:bg-background sm:grid-cols-[12rem_1fr_auto] ${unread ? "font-medium" : ""}`}
                >
                  <span className="flex items-center gap-2 truncate">
                    {unread > 0 && <span className="size-2 shrink-0 rounded-full bg-pen" aria-label="Unread" />}
                    <span className="truncate">{lead.name}</span>
                  </span>
                  <span className="min-w-0 truncate text-sm">
                    <span className={unread ? "" : "text-foreground"}>{m.subject}</span>
                    <span className="font-normal text-muted">
                      {" · "}
                      {incoming ? stripQuoted(m.body).replace(/\s+/g, " ").slice(0, 140) : `You: ${m.body.replace(/\s+/g, " ").slice(0, 120)}`}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 text-[13px] font-normal text-muted sm:justify-end">
                    <span>{STATUS_LABELS[lead.status as LeadStatus]}</span>
                    <time dateTime={m.createdAt.toISOString()}>{when(m.createdAt)}</time>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
