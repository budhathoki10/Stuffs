import type { Message } from "@/db/schema";
import { addressOf, followUpDraft, MAX_UNANSWERED, replySubject, stripQuoted } from "@/lib/outreach/text";
import { Badge } from "../ui";
import { EmailComposer } from "./email-composer";

const KIND_LABEL: Record<string, string> = {
  pitch: "First email",
  followup: "Follow-up",
  quote: "Quote",
  invoice: "Invoice",
  report: "Report",
  site: "Website",
};

const when = (d: Date) => d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function daysAgo(d: Date) {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

/** The email thread with one business, and the box to write the next message. */
export function Conversation({
  leadId,
  businessName,
  freelancerName,
  messages,
  problemId,
  optedOut,
}: {
  leadId: string;
  businessName: string;
  freelancerName: string;
  messages: Message[];
  problemId: string | null;
  optedOut: boolean;
}) {
  const last = messages.at(-1)!;
  const lastIn = messages.findLast((m) => m.direction === "in");
  const unanswered = messages.filter(
    (m) => m.direction === "out" && m.status === "sent" && (m.kind === "pitch" || m.kind === "followup") && (!lastIn || m.createdAt > lastIn.createdAt),
  ).length;
  const firstOut = messages.find((m) => m.direction === "out" && m.status === "sent");
  const to = lastIn ? addressOf(lastIn.fromAddress) : (firstOut?.toAddress ?? null);

  return (
    <div className="space-y-6">
      <ol className="space-y-3">
        {messages.map((m) => {
          const incoming = m.direction === "in";
          const shown = incoming ? stripQuoted(m.body) : m.body;
          return (
            <li
              key={m.id}
              className={`rounded-md border p-4 ${incoming ? "border-ink/30 bg-surface sm:mr-10" : "border-border bg-background sm:ml-10"}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[13px]">
                <p className="min-w-0">
                  <span className="font-medium text-foreground">{incoming ? businessName : "You"}</span>
                  <span className="text-muted"> {incoming ? `· ${addressOf(m.fromAddress) ?? m.fromAddress}` : `→ ${m.toAddress}`}</span>
                </p>
                <p className="flex items-center gap-2 text-muted">
                  {!incoming && KIND_LABEL[m.kind] && <span>{KIND_LABEL[m.kind]}</span>}
                  {m.status === "failed" && <Badge tone="bad">Not sent</Badge>}
                  {m.status === "bounced" && <Badge tone="bad">Bounced</Badge>}
                  <time dateTime={m.createdAt.toISOString()}>{when(m.createdAt)}</time>
                </p>
              </div>
              <p className="mt-2 text-sm font-medium">{m.subject}</p>
              <p className="mt-1.5 whitespace-pre-line break-words text-sm leading-relaxed">{shown}</p>
              {incoming && shown !== m.body.trim() && (
                <details className="mt-2 text-[13px] text-muted">
                  <summary className="cursor-pointer">Show the full email</summary>
                  <p className="mt-2 whitespace-pre-line break-words">{m.body}</p>
                </details>
              )}
            </li>
          );
        })}
      </ol>

      {optedOut ? (
        <p className="border-l-2 border-pen bg-pen-soft px-3 py-2 text-sm text-pen">{businessName} asked not to be emailed again.</p>
      ) : last.direction === "in" ? (
        <div>
          <h3 className="mb-2 text-sm font-medium">Reply</h3>
          <EmailComposer
            key={last.id}
            leadId={leadId}
            kind="reply"
            to={to}
            subject={replySubject(last.subject)}
            body=""
            placeholder={`Write your reply to ${businessName}…`}
            sendLabel="Send reply"
          />
        </div>
      ) : unanswered >= MAX_UNANSWERED ? (
        <p className="text-sm text-muted">
          {MAX_UNANSWERED} emails with no reply. Pitchcraft won&apos;t send more, to keep your emails out of spam. Try calling them, or move on to a fresh
          lead.
        </p>
      ) : (
        <div>
          <h3 className="mb-1 text-sm font-medium">{unanswered > 0 ? "Follow up" : "Write to them"}</h3>
          {unanswered > 0 && (
            <p className="mb-3 text-[13px] text-muted">
              Last email {daysAgo(last.createdAt)}, no reply yet. A short nudge after three or four days often gets one.
            </p>
          )}
          <EmailComposer
            key={last.id}
            leadId={leadId}
            kind={unanswered > 0 ? "followup" : "reply"}
            to={to}
            {...(unanswered > 0
              ? followUpDraft({ businessName, freelancerName, problemId, previousSubject: firstOut?.subject ?? null })
              : { subject: replySubject(last.subject), body: "" })}
            sendLabel={unanswered > 0 ? "Send follow-up" : "Send"}
          />
        </div>
      )}
    </div>
  );
}
