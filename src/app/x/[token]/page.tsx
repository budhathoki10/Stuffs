import type { Metadata } from "next";
import { confirmOptOut } from "@/app/actions/outreach";
import { Button } from "@/components/ui";
import { leadByReplyToken } from "@/lib/services/outreach";

export const metadata: Metadata = { title: "Stop emails", robots: { index: false } };

/**
 * Opt-out page linked from every cold email. It asks for a click rather than acting on the
 * GET, so link scanners in mail servers can't opt people out by accident.
 */
export default async function OptOutPage({ params, searchParams }: PageProps<"/x/[token]">) {
  const [{ token }, { done }] = await Promise.all([params, searchParams]);
  const row = await leadByReplyToken(token);
  const finished = done === "1" || !!row?.lead.optedOutAt;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-16">
      {!row ? (
        <>
          <h1 className="font-serif text-3xl font-medium">This link has expired</h1>
          <p className="mt-3 text-muted">Reply &ldquo;stop&rdquo; to the email instead and you won&apos;t hear from them again.</p>
        </>
      ) : finished ? (
        <>
          <h1 className="font-serif text-3xl font-medium">Done. No more emails.</h1>
          <p className="mt-3 text-muted">
            {row.freelancer} won&apos;t email {row.lead.name} again, and neither will anyone else using Pitchcraft.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-serif text-3xl font-medium">Stop emails to {row.lead.name}?</h1>
          <p className="mt-3 text-muted">
            {row.freelancer} contacted you through Pitchcraft. Confirm and neither they nor anyone else using Pitchcraft will email this address
            again.
          </p>
          <form action={confirmOptOut} className="mt-6">
            <input type="hidden" name="token" value={token} />
            <Button type="submit">Stop emails</Button>
          </form>
        </>
      )}
    </main>
  );
}
